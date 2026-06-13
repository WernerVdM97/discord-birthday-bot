import type { Client, TextChannel } from "discord.js";
import cron from "node-cron";
import { getDiscordConfig } from "../lib/config.js";
import {
  getAllBirthdays,
  getWishCache,
  getTags,
  setWishCache,
  setTagEmoji,
  markBirthdaySent,
  markBirthdayFailed,
  isBirthdaySent,
  getUnsentBirthdays,
} from "../lib/db.js";
import { scrapeOneMember } from "../lib/scraper.js";
import { generateTagEmoji } from "../lib/emoji.js";
import { notifyAdmin } from "../lib/notify.js";
import { callLLM, buildMessages } from "../lib/llm.js";

/**
 * Scheduler: scrape at T-1h, generate at T-30m, post at T.
 * Times are relative to CRON_SCHEDULE (default 7am → scrape at 6, generate at 6:30).
 */
export function startScheduler(client: Client): void {
  const postHour = 7; // derived from CRON_SCHEDULE or default

  // 1 hour before post: scrape today's birthday users only
  cron.schedule(`0 ${postHour - 1} * * *`, () => {
    console.log(`Pre-scraping tags for today's birthdays...`);
    scrapeTodaysBirthdayUsers(client).catch((err: unknown) => {
      console.error("Pre-scrape failed:", err);
      notifyAdmin(
        client,
        `⚠️ Pre-scrape failed: ${String(err).slice(0, 200)}`,
      ).catch(() => {});
    });
  });

  // 30 minutes before post: generate wishes for today's birthday users only
  cron.schedule(`30 ${postHour - 1} * * *`, () => {
    console.log(`Pre-generating wishes for today's birthdays...`);
    generateTodaysWishes(client).catch((err: unknown) => {
      console.error("Pre-generate failed:", err);
      notifyAdmin(
        client,
        `⚠️ Pre-generate failed: ${String(err).slice(0, 200)}`,
      ).catch(() => {});
    });
  });

  // Post time: check and post
  const schedule = process.env["CRON_SCHEDULE"] ?? "0 7 * * *";
  cron.schedule(schedule, () => {
    checkAndPostBirthdays(client).catch((err: unknown) =>
      console.error("Daily birthday check failed:", err),
    );
  });

  // 1 hour after post: re-check for unsent birthdays and alert admin
  cron.schedule(`0 ${postHour + 1} * * *`, () => {
    console.log(`Re-checking for missed birthday posts...`);
    recheckUnsentBirthdays(client).catch((err: unknown) => {
      console.error("Re-check failed:", err);
    });
  });

  console.log(
    `Scheduler: daily check at configured time, pre-scrape 1h before, pre-generate 30m before, re-check 1h after`,
  );
}

function getTodayKey(): string {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${month}-${day}`;
}

async function scrapeTodaysBirthdayUsers(client: Client): Promise<void> {
  const todayKey = getTodayKey();
  const entries = getAllBirthdays().filter((e) => e.birthday === todayKey);

  for (const entry of entries) {
    try {
      await scrapeOneMember(client, entry.userId);
      console.log(`  Scraped tags for ${entry.username}`);
    } catch (err) {
      console.error(`  Failed to scrape ${entry.username}:`, err);
    }
  }
}

async function generateTodaysWishes(client: Client): Promise<void> {
  const todayKey = getTodayKey();
  const entries = getAllBirthdays().filter((e) => e.birthday === todayKey);

  for (const entry of entries) {
    try {
      // Refresh tags before generating, so nickname is current
      await scrapeOneMember(client, entry.userId).catch(() => {});

      const tags = getTags(entry.userId);
      const messages = buildMessages(entry.username, entry.tagEmoji, tags);
      const wish = await callLLM(messages);
      const currentYear = new Date().getFullYear();
      setWishCache(entry.userId, wish, currentYear);

      // Also refresh tag emoji for today's birthday users
      try {
        const emoji = await generateTagEmoji(tags);
        setTagEmoji(entry.userId, emoji);
      } catch {
        // Emoji refresh is best-effort
      }

      console.log(`  Generated wish for ${entry.username}`);
    } catch (err) {
      console.error(`  Failed to generate wish for ${entry.username}:`, err);
    }
  }
}

/** Retry delays for failed sends: 1 minute, 5 minutes, 30 minutes. */
const RETRY_DELAYS = [60_000, 300_000, 1_800_000];

function getTodayISODate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Send a message with retry backoff. On success, marks the birthday
 * as sent in the DB. On final failure, marks it as failed and throws.
 */
async function sendWithRetry(
  channel: TextChannel,
  content: string,
  userId: string,
  todayIso: string,
): Promise<void> {
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      await channel.send(content);
      markBirthdaySent(userId, todayIso);
      return;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (attempt < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[attempt];
        console.warn(
          `Send failed for ${userId} (attempt ${attempt + 1}/${RETRY_DELAYS.length + 1}), retrying in ${delay / 1000}s: ${errMsg.slice(0, 120)}`,
        );
        await new Promise((r) => setTimeout(r, delay));
      } else {
        markBirthdayFailed(userId, todayIso, errMsg);
        throw err;
      }
    }
  }
}

/**
 * Re-check 1 hour after the main post: if any today-birthday users
 * still have no sent entry, DM the bot admin with the list.
 */
async function recheckUnsentBirthdays(client: Client): Promise<void> {
  const todayIso = getTodayISODate();

  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const todayKey = `${month}-${day}`;

  const allEntries = getAllBirthdays();
  const birthdayToday = allEntries.find((e) => e.birthday === todayKey);
  if (!birthdayToday) {
    console.log(`Re-check: no birthdays today (${todayKey}), nothing to check`);
    return;
  }

  const unsent = getUnsentBirthdays(todayIso);

  if (unsent.length === 0) {
    console.log(`Re-check: all birthdays sent for ${todayIso}`);
    return;
  }

  const names = unsent
    .map((u) => `• <@${u.userId}> (**${u.username}**)`)
    .join("\n");
  await notifyAdmin(
    client,
    `⚠️ **${unsent.length} birthday message(s) still unsent** as of ${new Date().toLocaleTimeString()}:\n${names}`,
  );
}

export async function checkAndPostBirthdays(client: Client): Promise<void> {
  const { announcementsChannelId } = getDiscordConfig();

  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const todayKey = `${month}-${day}`;
  const todayIso = getTodayISODate();

  const allEntries = getAllBirthdays();
  const todayBirthdays = allEntries.filter((e) => e.birthday === todayKey);

  if (todayBirthdays.length === 0) {
    console.log(`No birthdays today (${todayKey})`);
    return;
  }

  // Skip users whose birthday was already sent today (safe re-runs)
  const unsent = todayBirthdays.filter(
    (e) => !isBirthdaySent(e.userId, todayIso),
  );

  if (unsent.length === 0) {
    console.log(
      `All ${todayBirthdays.length} birthday(s) already sent today, nothing to do`,
    );
    return;
  }

  console.log(
    `Posting ${unsent.length} birthday(s) (${todayBirthdays.length - unsent.length} already sent, skipped)`,
  );

  const channel = client.channels.cache.get(announcementsChannelId) as
    | TextChannel
    | undefined;

  if (!channel) {
    console.error(`Announcements channel ${announcementsChannelId} not found`);
    notifyAdmin(
      client,
      `⚠️ Birthday post failed: announcements channel ${announcementsChannelId} not found`,
    ).catch(() => {});
    return;
  }

  const currentYear = new Date().getFullYear();

  // Resolve wishes for all unsent users first
  const wishes: {
    userId: string;
    username: string;
    text: string;
    tagEmoji: string;
  }[] = [];
  for (const entry of unsent) {
    let wish = getWishCache(entry.userId, currentYear)?.wish;

    if (!wish) {
      console.log(
        `Cache miss for ${entry.username}, scraping + generating on the fly...`,
      );
      try {
        await scrapeOneMember(client, entry.userId).catch(() => {});
        const tags = getTags(entry.userId);
        const messages = buildMessages(entry.username, entry.tagEmoji, tags);
        wish = await callLLM(messages);
      } catch (err) {
        console.error(
          `Failed to generate on-the-fly wish for ${entry.username}:`,
          err,
        );
        wish = `Happy birthday ${entry.username}! ${entry.tagEmoji}`;
        notifyAdmin(
          client,
          `⚠️ Failed to generate wish for ${entry.username}: ${String(err).slice(0, 200)}`,
        ).catch(() => {});
      }
    }

    wishes.push({
      userId: entry.userId,
      username: entry.username,
      text: wish,
      tagEmoji: entry.tagEmoji,
    });
  }

  // Send all concurrently — each message retries independently
  const results = await Promise.allSettled(
    wishes.map((w) =>
      sendWithRetry(
        channel,
        `<@${w.userId}> ${w.tagEmoji} ${w.text}`,
        w.userId,
        todayIso,
      ),
    ),
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  console.log(`Birthday posts: ${succeeded} sent, ${failed} failed`);

  if (failed > 0) {
    notifyAdmin(
      client,
      `⚠️ ${failed} birthday message(s) failed to send today after all retries.`,
    ).catch(() => {});
  }
}
