import { type ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import { upsertBirthday, isBirthdayLocked } from "../lib/db.js";

export async function handleSetBirthday(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const callerId = interaction.user.id;
  const target = interaction.options.getUser("user", true);
  const date = interaction.options.getString("date", true);
  const isAdmin =
    interaction.memberPermissions?.has(
      PermissionFlagsBits.Administrator
    ) ?? false;

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

  // Lock check: only the birthday owner or a server admin can override
  const isSelf = callerId === target.id;
  if (isBirthdayLocked(target.id) && !isSelf && !isAdmin) {
    await interaction.reply({
      content: `**${target.displayName}**'s birthday is locked and can only be changed by them (or an admin).`,
      ephemeral: true,
    });
    return;
  }

  // Self-set → lock; others setting for someone else → unlocked
  upsertBirthday(target.id, target.displayName, date, isSelf);

  const lockNotice = isSelf ? " 🔒 (locked)" : "";
  await interaction.reply({
    content: `Birthday set: **${target.displayName}** → **${date}**${lockNotice}`,
    ephemeral: true,
  });
}
