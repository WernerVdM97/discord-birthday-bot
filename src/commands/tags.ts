import type { ChatInputCommandInteraction } from "discord.js";
import { getTags } from "../lib/db.js";

export async function handleTags(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const user = interaction.options.getUser("user", true);
  const tags = getTags(user.id);

  if (tags.length === 0) {
    await interaction.reply({
      content: `No tags for **${user.displayName}**.`,
      ephemeral: true,
    });
    return;
  }

  const scraped = tags.filter((t) => t.source === "scraped");
  const manual = tags.filter((t) => t.source === "manual");

  const parts: string[] = [];
  if (scraped.length > 0) {
    parts.push(`**Auto-scraped:**\n${scraped.map((t) => `• ${t.tag}`).join("\n")}`);
  }
  if (manual.length > 0) {
    parts.push(`**Manual:**\n${manual.map((t) => `• ${t.tag}`).join("\n")}`);
  }

  await interaction.reply({
    content: `**${user.displayName}'s tags:**\n\n${parts.join("\n\n")}`,
    ephemeral: true,
  });
}
