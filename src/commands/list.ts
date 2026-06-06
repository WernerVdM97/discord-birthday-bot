import type { ChatInputCommandInteraction } from "discord.js";
import { getAllBirthdays } from "../lib/db.js";

const MAX_LENGTH = 1900;

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

  const content = blocks.join("\n\n");
  if (content.length <= MAX_LENGTH) {
    await interaction.reply({ content, ephemeral: true });
    return;
  }

  // Truncate if over limit
  let trimmed = "";
  let shown = 0;
  for (const block of blocks) {
    if (trimmed.length + block.length + 2 > MAX_LENGTH) break;
    trimmed += (trimmed ? "\n\n" : "") + block;
    shown += (block.match(/•/g) ?? []).length;
  }
  const total = entries.length;
  if (shown < total) {
    trimmed += `\n\n…and ${total - shown} more`;
  }

  await interaction.reply({ content: trimmed, ephemeral: true });
}
