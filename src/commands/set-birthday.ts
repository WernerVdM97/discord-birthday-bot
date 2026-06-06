import { type ChatInputCommandInteraction } from "discord.js";
import { upsertBirthday, isBirthdayLocked } from "../lib/db.js";
import { isPrivileged, isMemberOrAbove, isRoleGateActive } from "../lib/roles.js";

export async function handleSetBirthday(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const callerId = interaction.user.id;
  const target = interaction.options.getUser("user", true);
  const date = interaction.options.getString("date", true);
  const isSelf = callerId === target.id;

  // Validate MM-DD format
  if (!/^\d{2}-\d{2}$/.test(date)) {
    await interaction.reply({
      content: "Invalid date format. Use `MM-DD` (e.g. `03-14`).",
      ephemeral: true,
    });
    return;
  }

  const [monthStr, dayStr] = date.split("-");
  const month = parseInt(monthStr!, 10);
  const day = parseInt(dayStr!, 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    await interaction.reply({
      content: "Invalid date. Month must be 01-12, day must be 01-31.",
      ephemeral: true,
    });
    return;
  }

  if (isRoleGateActive()) {
    const privileged = isPrivileged(interaction);
    const member = isMemberOrAbove(interaction);

    if (!privileged && !member) {
      await interaction.reply({
        content: "You don't have permission to set birthdays.",
        ephemeral: true,
      });
      return;
    }

    // Members (not privileged) can only set their own birthday
    if (!privileged && !isSelf) {
      await interaction.reply({
        content: "You can only set your own birthday.",
        ephemeral: true,
      });
      return;
    }

    // Members can't override a locked birthday (unless it's their own lock)
    if (!privileged && isBirthdayLocked(target.id) && !isSelf) {
      await interaction.reply({
        content: `**${target.displayName}**'s birthday is locked.`,
        ephemeral: true,
      });
      return;
    }
  } else {
    // No role gate: existing behavior — lock override for owner/server-admin/bot-admin
    const privileged = isPrivileged(interaction);
    if (isBirthdayLocked(target.id) && !isSelf && !privileged) {
      await interaction.reply({
        content: `**${target.displayName}**'s birthday is locked and can only be changed by them (or an admin).`,
        ephemeral: true,
      });
      return;
    }
  }

  // Self-set → lock; privileged setting for someone else → unlocked
  upsertBirthday(target.id, target.displayName, date, isSelf);

  const lockNotice = isSelf ? " 🔒 (locked)" : "";
  await interaction.reply({
    content: `Birthday set: **${target.displayName}** → **${date}**${lockNotice}`,
    ephemeral: true,
  });
}
