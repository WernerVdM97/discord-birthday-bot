import type { ChatInputCommandInteraction } from "discord.js";
import { isBotAdmin } from "../lib/roles.js";
import { checkAndPostBirthdays } from "../scheduler/daily-check.js";

export async function handleTrigger(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!isBotAdmin(interaction.user.id)) {
    await interaction.reply({
      content: "Only the bot owner can use this command.",
      ephemeral: true,
    });
    return;
  }

  const today = new Date();
  const todayKey = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  await interaction.deferReply({ ephemeral: true });

  try {
    await checkAndPostBirthdays(interaction.client);
    await interaction.editReply(`Triggered birthday check for ${todayKey}. Check #announcements.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await interaction.editReply(`Trigger failed:\n\`\`\`\n${message.slice(0, 1000)}\n\`\`\``);
  }
}
