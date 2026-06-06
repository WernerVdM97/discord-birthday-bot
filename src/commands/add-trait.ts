import type { ChatInputCommandInteraction } from "discord.js";
import { addTrait } from "../lib/db.js";
import { isMemberOrAbove, isRoleGateActive } from "../lib/roles.js";
import { findBlockedTrait } from "../lib/blocklist.js";

export async function handleAddTrait(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (isRoleGateActive() && !isMemberOrAbove(interaction)) {
    await interaction.reply({
      content: "You don't have permission to add traits.",
      ephemeral: true,
    });
    return;
  }

  const user = interaction.options.getUser("user", true);
  const trait = interaction.options.getString("trait", true).trim();

  if (!trait) {
    await interaction.reply({
      content: "Provide a trait to add.",
      ephemeral: true,
    });
    return;
  }

  const blocked = findBlockedTrait([trait]);
  if (blocked) {
    await interaction.reply({
      content: `Trait \"${blocked}\" is not allowed.`,
      ephemeral: true,
    });
    return;
  }

  addTrait(user.id, trait, "manual");

  await interaction.reply({
    content: `Added \"${trait}\" to **${user.displayName}**.`,
    ephemeral: true,
  });
}
