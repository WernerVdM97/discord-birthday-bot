import type { ChatInputCommandInteraction } from "discord.js";
import { isPrivileged } from "../lib/roles.js";
import { getAllBirthdays, getTraits, setTraitEmoji } from "../lib/db.js";
import { generateTraitEmoji } from "../lib/emoji.js";

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
      const traits = getTraits(entry.userId).map((t) => t.trait);
      const emoji = await generateTraitEmoji(traits);
      setTraitEmoji(entry.userId, emoji);
      updated++;
    } catch {
      failed++;
    }
  }

  await interaction.editReply(
    `Refreshed emojis: ${updated} updated, ${failed} failed.`
  );
}
