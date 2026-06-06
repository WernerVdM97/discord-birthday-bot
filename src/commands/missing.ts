import type { ChatInputCommandInteraction } from "discord.js";
import { getAllBirthdays } from "../lib/db.js";

export async function handleMissing(
  interaction: ChatInputCommandInteraction
): Promise<void> {
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
  await interaction.reply({
    content: `**${missing.length} member(s) missing birthdays:**\n${lines.join("\n")}`,
    ephemeral: true,
  });
}
