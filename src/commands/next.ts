import type { ChatInputCommandInteraction } from "discord.js";
import { getAllBirthdays } from "../lib/db.js";

function parseMMDD(mmdd: string): { month: number; day: number } {
  return {
    month: parseInt(mmdd.slice(0, 2), 10),
    day: parseInt(mmdd.slice(3), 10),
  };
}

function daysUntil(now: Date, target: { month: number; day: number }): number {
  // First try this year
  let targetDate = new Date(now.getFullYear(), target.month - 1, target.day);

  // If already past (or today), try next year
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

  // Find entries with the minimum days-until
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

  const names = upcoming.map((e) => `**${e.username}**`).join(", ");

  let when: string;
  if (minDays === 0) {
    when = "today 🎉";
  } else if (minDays === 1) {
    when = "tomorrow";
  } else {
    when = `in ${minDays} days`;
  }

  const date = upcoming[0]!.birthday;
  await interaction.reply({
    content: `Next up: ${names} — **${date}** (${when})`,
    ephemeral: true,
  });
}
