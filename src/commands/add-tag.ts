import type { ChatInputCommandInteraction } from "discord.js";
import { addTag } from "../lib/db.js";
import { isMemberOrAbove, isRoleGateActive } from "../lib/roles.js";
import { findBlockedTag } from "../lib/blocklist.js";

export async function handleAddTag(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (isRoleGateActive() && !isMemberOrAbove(interaction)) {
    await interaction.reply({
      content: "You don't have permission to add tags.",
      ephemeral: true,
    });
    return;
  }

  const user = interaction.options.getUser("user", true);
  const tag = interaction.options.getString("tag", true).trim();

  if (!tag) {
    await interaction.reply({
      content: "Provide a tag to add.",
      ephemeral: true,
    });
    return;
  }

  const blocked = findBlockedTag([tag]);
  if (blocked) {
    await interaction.reply({
      content: `Tag \"${blocked}\" is not allowed.`,
      ephemeral: true,
    });
    return;
  }

  addTag(user.id, tag, "manual");

  await interaction.reply({
    content: `Added \"${tag}\" to **${user.displayName}**.`,
    ephemeral: true,
  });
}
