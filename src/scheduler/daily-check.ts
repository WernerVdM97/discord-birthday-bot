import type { Client, TextChannel } from "discord.js";
import cron from "node-cron";
import { getDiscordConfig } from "../lib/config.js";
import { getAllBirthdays, getWishCache, getTraits } from "../lib/db.js";
import { generateWishes, regenerateMonthly } from "../lib/llm.js";
import { callLLM, buildMessages } from "../lib/llm.js";

/**
 * Check if today is someone's birthday and post a wish.
 * Runs daily at 7:00 AM server time.
 */
export function startScheduler(client: Client): void {
  // Daily birthday check at 7:00 AM
  cron.schedule("0 7 * * *", () => {
    checkAndPostBirthdays(client).catch((err) =>
      console.error("Daily birthday check failed:", err)
    );
  });

  // Monthly wish regeneration on the 1st at 6:00 AM
  cron.schedule("0 6 1 * *", () => {
    console.log("Running monthly wish regeneration...");
    const entries = getAllBirthdays();
    regenerateMonthly(entries)
      .then(() => console.log("Monthly wish regeneration complete"))
      .catch((err) =>
        console.error("Monthly wish regeneration failed:", err)
      );
  });

  console.log("Scheduler started: daily check @ 7:00, monthly regen @ 6:00 on 1st");
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
    return;
  }

  const currentYear = new Date().getFullYear();

  for (const entry of todayBirthdays) {
    let wish = getWishCache(entry.userId, currentYear)?.wish;

    if (!wish) {
      // Generate on the fly if cache miss (shouldn't happen with monthly regen,
      // but safe fallback)
      console.log(`Cache miss for ${entry.username}, generating on the fly...`);
      try {
        const traits = getTraits(entry.userId).map((t) => t.trait);
        const messages = buildMessages(
          entry.username,
          entry.birthday,
          traits
        );
        wish = await callLLM(messages);
      } catch (err) {
        console.error(`Failed to generate on-the-fly wish for ${entry.username}:`, err);
        wish = `Happy birthday ${entry.username}! 🎂`;
      }
    }

    try {
      await channel.send(`<@${entry.userId}> ${wish}`);
      console.log(`Posted birthday wish for ${entry.username}`);
    } catch (err) {
      console.error(`Failed to post wish for ${entry.username}:`, err);
    }
  }
}
