import type { ChatInputCommandInteraction } from "discord.js";
import { isPrivileged } from "../lib/roles.js";
import { getAllBirthdays, getTags, setTagEmoji } from "../lib/db.js";
import { generateTagEmoji } from "../lib/emoji.js";
import { scrapeOneMember } from "../lib/scraper.js";

export async function handleRefreshEmojis(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!isPrivileged(interaction)) {
    await interaction.reply({
      content: "Only admins can use this command.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const entries = getAllBirthdays();
  let updated = 0;
  let failed = 0;

  for (const entry of entries) {
    try {
      // Re-scrape to get fresh tags (nickname, roles, etc.)
      await scrapeOneMember(interaction.client, entry.userId).catch(() => {});

      const tags = getTags(entry.userId);
      const emoji = await generateTagEmoji(tags);
      setTagEmoji(entry.userId, emoji);
      updated++;
    } catch {
      failed++;
    }
  }

  await interaction.editReply(
    `Refreshed emojis: ${updated} updated, ${failed} failed.`
  );
}
