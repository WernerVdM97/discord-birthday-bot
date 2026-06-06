import type { ChatInputCommandInteraction } from "discord.js";
import { getAllBirthdays } from "../lib/db.js";
import { isMemberOrAbove, isRoleGateActive } from "../lib/roles.js";

/** Discord message limit is 2000 chars. Keep some padding. */
const MAX_LENGTH = 1900;

function truncate(lines: string[], suffix: string): string {
  let result = "";
  let count = 0;
  for (const line of lines) {
    if (result.length + line.length + 1 > MAX_LENGTH) break;
    result += (result ? "\n" : "") + line;
    count++;
  }
  if (count < lines.length) {
    result += `\n\n${suffix.replace("{n}", String(lines.length - count))}`;
  }
  return result;
}

export async function handleMissing(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (isRoleGateActive() && !isMemberOrAbove(interaction)) {
    await interaction.reply({
      content: "You don't have permission to use this command.",
      ephemeral: true,
    });
    return;
  }

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({
      content: "This command can only be used in a server.",
      ephemeral: true,
    });
    return;
  }

  // Fetch members to ensure cache is fresh
  await guild.members.fetch();

  const birthdayEntries = getAllBirthdays();
  const userIdsWithBirthdays = new Set(
    birthdayEntries.map((b) => b.userId)
  );

  const missing: string[] = [];
  for (const [, member] of guild.members.cache) {
    if (member.user.bot) continue;
    if (!userIdsWithBirthdays.has(member.id)) {
      missing.push(member.displayName);
    }
  }

  if (missing.length === 0) {
    await interaction.reply({
      content: "Everyone has their birthday set! 🎉",
      ephemeral: true,
    });
    return;
  }

  const lines = missing.map((name) => `• **${name}**`);
  const body = truncate(
    lines,
    `…and {n} more.`
  );
  await interaction.reply({
    content: `**${missing.length} member(s) missing birthdays:**\n${body}`,
    ephemeral: true,
  });
}
