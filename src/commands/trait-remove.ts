import type { ChatInputCommandInteraction } from "discord.js";
import { getTraits, addTrait, clearManualTraits } from "../lib/db.js";
import { isPrivileged, isMemberOrAbove, isRoleGateActive } from "../lib/roles.js";

function checkAccess(interaction: ChatInputCommandInteraction): boolean {
  if (isRoleGateActive()) return isPrivileged(interaction);
  return true;
}

function reject(interaction: ChatInputCommandInteraction) {
  return interaction.reply({
    content: "Only admins can manage traits.",
    ephemeral: true,
  });
}

export async function handleTraitRemove(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!checkAccess(interaction)) {
    await reject(interaction);
    return;
  }

  const user = interaction.options.getUser("user", true);
  const traitToRemove = interaction.options.getString("trait", true).trim().toLowerCase();

  const allTraits = getTraits(user.id);
  const manualTraits = allTraits
    .filter((t) => t.source === "manual")
    .filter((t) => t.trait.toLowerCase() !== traitToRemove)
    .map((t) => t.trait);

  // Rebuild manual traits without the removed one
  clearManualTraits(user.id);
  for (const trait of manualTraits) {
    addTrait(user.id, trait, "manual");
  }

  await interaction.reply({
    content: `Removed \"${traitToRemove}\" from **${user.displayName}**'s traits.`,
    ephemeral: true,
  });
}

export async function handleTraitsClear(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!checkAccess(interaction)) {
    await reject(interaction);
    return;
  }

  const user = interaction.options.getUser("user", true);

  clearManualTraits(user.id);

  await interaction.reply({
    content: `Cleared all manual traits for **${user.displayName}**.`,
    ephemeral: true,
  });
}
