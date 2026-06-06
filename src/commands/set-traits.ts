import type { ChatInputCommandInteraction } from "discord.js";
import { clearManualTraits, addTrait } from "../lib/db.js";
import { isMemberOrAbove, isRoleGateActive } from "../lib/roles.js";

export async function handleSetTraits(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (isRoleGateActive() && !isMemberOrAbove(interaction)) {
    await interaction.reply({
      content: "You don't have permission to set traits.",
      ephemeral: true,
    });
    return;
  }

  const user = interaction.options.getUser("user", true);
  const rawTraits = interaction.options.getString("traits", true);

  const traits = rawTraits
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  if (traits.length === 0) {
    await interaction.reply({
      content: "Provide at least one trait, comma-separated.",
      ephemeral: true,
    });
    return;
  }

  // Replace all existing manual traits
  clearManualTraits(user.id);
  for (const trait of traits) {
    addTrait(user.id, trait, "manual");
  }

  await interaction.reply({
    content: `Traits set for **${user.displayName}**: ${traits.join(", ")}`,
    ephemeral: true,
  });
}
