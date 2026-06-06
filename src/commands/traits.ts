import type { ChatInputCommandInteraction } from "discord.js";
import { getTraits } from "../lib/db.js";

export async function handleTraits(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const user = interaction.options.getUser("user", true);
  const traits = getTraits(user.id);

  if (traits.length === 0) {
    await interaction.reply({
      content: `No traits for **${user.displayName}**.`,
      ephemeral: true,
    });
    return;
  }

  const scraped = traits.filter((t) => t.source === "scraped");
  const manual = traits.filter((t) => t.source === "manual");

  const parts: string[] = [];
  if (scraped.length > 0) {
    parts.push(`**Auto-scraped:**\n${scraped.map((t) => `• ${t.trait}`).join("\n")}`);
  }
  if (manual.length > 0) {
    parts.push(`**Manual:**\n${manual.map((t) => `• ${t.trait}`).join("\n")}`);
  }

  await interaction.reply({
    content: `**${user.displayName}'s traits:**\n\n${parts.join("\n\n")}`,
    ephemeral: true,
  });
}
