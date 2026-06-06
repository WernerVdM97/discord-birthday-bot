import type { ChatInputCommandInteraction } from "discord.js";
import { getAllBirthdays } from "../lib/db.js";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parseMMDD(mmdd: string): { month: number; day: number } {
  return {
    month: parseInt(mmdd.slice(0, 2), 10),
    day: parseInt(mmdd.slice(3), 10),
  };
}

function daysUntil(now: Date, target: { month: number; day: number }): number {
  let targetDate = new Date(now.getFullYear(), target.month - 1, target.day);

  if (
    targetDate.getMonth() < now.getMonth() ||
    (targetDate.getMonth() === now.getMonth() &&
      targetDate.getDate() < now.getDate())
  ) {
    targetDate = new Date(now.getFullYear() + 1, target.month - 1, target.day);
  }

  const diff = targetDate.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export async function handleNext(
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

  const now = new Date();

  let minDays = Infinity;
  const upcoming: typeof entries = [];

  for (const entry of entries) {
    const d = daysUntil(now, parseMMDD(entry.birthday));
    if (d < minDays) {
      minDays = d;
      upcoming.length = 0;
      upcoming.push(entry);
    } else if (d === minDays) {
      upcoming.push(entry);
    }
  }

  const { month, day } = parseMMDD(upcoming[0]!.birthday);
  const dateLabel = `${MONTHS[month - 1]} ${day}`;

  let header: string;
  if (minDays === 0) {
    header = `🎉 **Today! ${dateLabel}**`;
  } else if (minDays === 1) {
    header = `📅 **Tomorrow: ${dateLabel}**`;
  } else {
    header = `📅 **${dateLabel}** (in ${minDays} days)`;
  }

  const lines = upcoming.map(
    (e) => `• ${e.tagEmoji} **${e.username}**`
  );

  const suffix = upcoming.length > 1
    ? `\n_${upcoming.length} birthdays on this day_`
    : "";

  await interaction.reply({
    content: `${header}\n${lines.join("\n")}${suffix}`,
    ephemeral: true,
  });
}
