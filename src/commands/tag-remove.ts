import type { ChatInputCommandInteraction } from "discord.js";
import { getTags, addTag, clearManualTags } from "../lib/db.js";
import { isPrivileged, isMemberOrAbove, isRoleGateActive } from "../lib/roles.js";

function checkAccess(interaction: ChatInputCommandInteraction): boolean {
  if (isRoleGateActive()) return isPrivileged(interaction);
  return true;
}

function reject(interaction: ChatInputCommandInteraction) {
  return interaction.reply({
    content: "Only admins can manage tags.",
    ephemeral: true,
  });
}

export async function handleTagRemove(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!checkAccess(interaction)) {
    await reject(interaction);
    return;
  }

  const user = interaction.options.getUser("user", true);
  const tagToRemove = interaction.options.getString("tag", true).trim().toLowerCase();

  const allTags = getTags(user.id);
  const manualTags = allTags
    .filter((t) => t.source === "manual")
    .filter((t) => t.tag.toLowerCase() !== tagToRemove)
    .map((t) => t.tag);

  // Rebuild manual tags without the removed one
  clearManualTags(user.id);
  for (const tag of manualTags) {
    addTag(user.id, tag, "manual");
  }

  await interaction.reply({
    content: `Removed \"${tagToRemove}\" from **${user.displayName}**'s tags.`,
    ephemeral: true,
  });
}

export async function handleTagsClear(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!checkAccess(interaction)) {
    await reject(interaction);
    return;
  }

  const user = interaction.options.getUser("user", true);

  clearManualTags(user.id);

  await interaction.reply({
    content: `Cleared all manual tags for **${user.displayName}**.`,
    ephemeral: true,
  });
}
