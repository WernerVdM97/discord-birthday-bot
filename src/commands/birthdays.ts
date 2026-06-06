import type { ChatInputCommandInteraction } from "discord.js";
import { getAllBirthdays } from "../lib/db.js";

export async function handleBirthdays(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const entries = getAllBirthdays();

  if (entries.length === 0) {
    await interaction.reply({
      content: "No birthdays stored yet.",
      ephemeral: true,
    });
    return;
  }

  const lines = entries.map(
    (e) => `• **${e.username}** — ${e.birthday}${e.locked ? " 🔒" : ""}`
  );

  await interaction.reply({
    content: `**All birthdays:**\n${lines.join("\n")}`,
    ephemeral: true,
  });
}
