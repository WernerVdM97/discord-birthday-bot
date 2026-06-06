import type { ChatInputCommandInteraction } from "discord.js";
import { getAllBirthdays } from "../lib/db.js";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export async function handleList(
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

  // Group by month
  const groups = new Map<number, string[]>();
  for (const e of entries) {
    const month = parseInt(e.birthday.slice(0, 2), 10);
    const existing = groups.get(month) ?? [];
    existing.push(
      `${e.birthday.slice(3)} — **${e.username}**${e.locked ? " 🔒" : ""}`
    );
    groups.set(month, existing);
  }

  const blocks: string[] = [];
  for (const [month, lines] of groups) {
    blocks.push(`**${MONTHS[month - 1]}**\n${lines.map((l) => `• ${l}`).join("\n")}`);
  }

  await interaction.reply({
    content: blocks.join("\n\n"),
    ephemeral: true,
  });
}
