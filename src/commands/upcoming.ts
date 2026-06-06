import type { ChatInputCommandInteraction } from "discord.js";
import { getUpcomingBirthdays } from "../lib/db.js";
import { isPrivileged, isRoleGateActive } from "../lib/roles.js";

export async function handleUpcoming(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // JS months are 0-indexed

  const entries = getUpcomingBirthdays(currentMonth);
  const monthName = now.toLocaleString("en", { month: "long" });

  if (entries.length === 0) {
    await interaction.reply({
      content: `No birthdays in ${monthName}.`,
      ephemeral: true,
    });
    return;
  }

  const showLocks = !isRoleGateActive() || isPrivileged(interaction);

  const lines = entries.map((e) => {
    const day = e.birthday.slice(3);
    const lock = showLocks ? (e.locked ? "🔒 " : "🔓 ") : "";
    return `• ${lock}**${day}** ${e.tagEmoji} **${e.username}**`;
  });

  await interaction.reply({
    content: `**Birthdays in ${monthName}:**\n${lines.join("\n")}`,
    ephemeral: true,
  });
}
