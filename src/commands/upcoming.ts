import type { ChatInputCommandInteraction } from "discord.js";
import { getUpcomingBirthdays } from "../lib/db.js";

export async function handleUpcoming(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // JS months are 0-indexed

  const entries = getUpcomingBirthdays(currentMonth);

  if (entries.length === 0) {
    const monthName = now.toLocaleString("en", { month: "long" });
    await interaction.reply({
      content: `No birthdays in ${monthName}.`,
      ephemeral: true,
    });
    return;
  }

  const lines = entries.map(
    (e) => `• **${e.username}** — ${e.birthday}`
  );

  const monthName = now.toLocaleString("en", { month: "long" });
  await interaction.reply({
    content: `**Birthdays in ${monthName}:**\n${lines.join("\n")}`,
    ephemeral: true,
  });
}
