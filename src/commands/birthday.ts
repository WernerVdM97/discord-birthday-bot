import type { ChatInputCommandInteraction } from "discord.js";
import { getBirthday } from "../lib/db.js";

export async function handleBirthday(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const user = interaction.options.getUser("user", true);

  const entry = getBirthday(user.id);

  if (!entry) {
    await interaction.reply({
      content: `No birthday on file for **${user.displayName}**.`,
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    content: `${user.displayName}'s birthday is **${entry.birthday}**.`,
    ephemeral: true,
  });
}
