import type { Client, TextChannel } from "discord.js";
import cron from "node-cron";
import { getDiscordConfig } from "../lib/config.js";
import { getAllBirthdays, getWishCache, getTags, setWishCache, setTagEmoji } from "../lib/db.js";
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
        `⚠️ Pre-scrape failed: ${String(err).slice(0, 200)}`
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
        `⚠️ Pre-generate failed: ${String(err).slice(0, 200)}`
      ).catch(() => {});
    });
  });

  // Post time: check and post
  const schedule = process.env["CRON_SCHEDULE"] ?? "0 7 * * *";
  cron.schedule(schedule, () => {
    checkAndPostBirthdays(client).catch((err: unknown) =>
      console.error("Daily birthday check failed:", err)
    );
  });

  console.log(
    `Scheduler: daily check at configured time, pre-scrape 1h before, pre-generate 30m before`
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

export async function checkAndPostBirthdays(client: Client): Promise<void> {
  const { announcementsChannelId } = getDiscordConfig();

  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const todayKey = `${month}-${day}`;

  const allEntries = getAllBirthdays();
  const todayBirthdays = allEntries.filter((e) => e.birthday === todayKey);

  if (todayBirthdays.length === 0) {
    console.log(`No birthdays today (${todayKey})`);
    return;
  }

  const channel = client.channels.cache.get(
    announcementsChannelId
  ) as TextChannel | undefined;

  if (!channel) {
    console.error(`Announcements channel ${announcementsChannelId} not found`);
    notifyAdmin(
      client,
      `⚠️ Birthday post failed: announcements channel ${announcementsChannelId} not found`
    ).catch(() => {});
    return;
  }

  const currentYear = new Date().getFullYear();

  for (const entry of todayBirthdays) {
    let wish = getWishCache(entry.userId, currentYear)?.wish;

    if (!wish) {
      // Cache miss: scrape + generate on-the-fly
      console.log(`Cache miss for ${entry.username}, scraping + generating on the fly...`);
      try {
        await scrapeOneMember(client, entry.userId).catch(
          () => {} // best-effort — if scrape fails, use whatever tags exist
        );
        const tags = getTags(entry.userId);
        const messages = buildMessages(
          entry.username,
          entry.tagEmoji,
          tags
        );
        wish = await callLLM(messages);
      } catch (err) {
        console.error(`Failed to generate on-the-fly wish for ${entry.username}:`, err);
        wish = `Happy birthday ${entry.username}! 🎂`;
        notifyAdmin(
          client,
          `⚠️ Failed to generate wish for ${entry.username}: ${String(err).slice(0, 200)}`
        ).catch(() => {});
      }
    }

    try {
      await channel.send(`<@${entry.userId}> ${wish}`);
      console.log(`Posted birthday wish for ${entry.username}`);
    } catch (err) {
      console.error(`Failed to post wish for ${entry.username}:`, err);
      notifyAdmin(
        client,
        `⚠️ Failed to post birthday wish for ${entry.username}: ${String(err).slice(0, 200)}`
      ).catch(() => {});
    }
  }
}
