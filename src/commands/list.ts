import type { ChatInputCommandInteraction } from "discord.js";
import { getAllBirthdays } from "../lib/db.js";
import { isPrivileged, isRoleGateActive } from "../lib/roles.js";

const MAX_LENGTH = 1900;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export async function handleList(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const entries = getAllBirthdays();

  if (entries.length === 0) {
    await interaction.reply({
      content: "No birthdays stored yet.",
      ephemeral: true,
    });
    return;
  }

  const showLocks = !isRoleGateActive() || isPrivileged(interaction);

  // Group by month
  const groups = new Map<number, string[]>();
  for (const e of entries) {
    const month = parseInt(e.birthday.slice(0, 2), 10);
    const day = e.birthday.slice(3);

    let line: string;
    if (showLocks) {
      const lock = e.locked ? "🔒" : "🔓";
      line = `${lock} **${day}** ${e.tagEmoji} <@${e.userId}>`;
    } else {
      line = `**${day}** ${e.tagEmoji} <@${e.userId}>`;
    }

    const existing = groups.get(month) ?? [];
    existing.push(line);
    groups.set(month, existing);
  }

  const blocks: string[] = [];
  for (const [month, lines] of groups) {
    blocks.push(
      `**${MONTHS[month - 1]}**\n${lines.map((l) => `• ${l}`).join("\n")}`,
    );
  }

  const content = blocks.join("\n\n");
  if (content.length <= MAX_LENGTH) {
    await interaction.reply({ content, ephemeral: true });
    return;
  }

  // Truncate
  let trimmed = "";
  let shown = 0;
  for (const block of blocks) {
    if (trimmed.length + block.length + 2 > MAX_LENGTH) break;
    trimmed += (trimmed ? "\n\n" : "") + block;
    shown += (block.match(/•/g) ?? []).length;
  }
  if (shown < entries.length) {
    trimmed += `\n\n…and ${entries.length - shown} more`;
  }

  await interaction.reply({ content: trimmed, ephemeral: true });
}
