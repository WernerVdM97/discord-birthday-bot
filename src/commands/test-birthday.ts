import type { ChatInputCommandInteraction } from "discord.js";
import { getBirthday, getTags, getWishCache } from "../lib/db.js";
import { buildMessages, callLLM } from "../lib/llm.js";
import { isBotAdmin } from "../lib/roles.js";

export async function handleTestBirthday(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!isBotAdmin(interaction.user.id)) {
    await interaction.reply({
      content: "Only the bot owner can use this command.",
      ephemeral: true,
    });
    return;
  }

  const user = interaction.options.getUser("user", true);
  const entry = getBirthday(user.id);

  if (!entry) {
    await interaction.reply({
      content: `No birthday on file for **${user.displayName}**.`,
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  // Try cached wish first, then generate fresh
  const currentYear = new Date().getFullYear();
  let wish = getWishCache(user.id, currentYear)?.wish;

  if (!wish) {
    const tags = getTags(user.id);
    const messages = buildMessages(
      entry.username,
      entry.tagEmoji,
      tags
    );
    try {
      wish = await callLLM(messages);
    } catch {
      wish = `Happy birthday ${entry.username}! 🎂`;
    }
  }

  await interaction.editReply(
    `**[TEST]** Birthday wish for **${entry.username}** (${entry.birthday}):\n\n<@${user.id}> ${wish}`
  );
}
