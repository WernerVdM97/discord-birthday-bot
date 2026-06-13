import type { ChatInputCommandInteraction } from "discord.js";
import { clearManualTags, addTag } from "../lib/db.js";
import { isPrivileged, isRoleGateActive } from "../lib/roles.js";
import { findBlockedTag } from "../lib/blocklist.js";

export async function handleSetTags(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (isRoleGateActive() && !isPrivileged(interaction)) {
    await interaction.reply({
      content: "You don't have permission to set tags.",
      ephemeral: true,
    });
    return;
  }

  const user = interaction.options.getUser("user", true);
  const rawTags = interaction.options.getString("tags", true);

  const tags = rawTags
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  if (tags.length === 0) {
    await interaction.reply({
      content: "Provide at least one tag, comma-separated.",
      ephemeral: true,
    });
    return;
  }

  // Block offensive tags
  const blocked = findBlockedTag(tags);
  if (blocked) {
    await interaction.reply({
      content: `Tag "${blocked}" is not allowed.`,
      ephemeral: true,
    });
    return;
  }

  // Replace all existing manual tags
  clearManualTags(user.id);
  for (const tag of tags) {
    addTag(user.id, tag, "manual");
  }

  await interaction.reply({
    content: `Tags set for **${user.displayName}**: ${tags.join(", ")}`,
    ephemeral: true,
  });
}
