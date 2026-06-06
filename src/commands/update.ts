import type { ChatInputCommandInteraction } from "discord.js";
import { isBotAdmin } from "../lib/roles.js";
import { execSync } from "node:child_process";

export async function handleUpdate(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!isBotAdmin(interaction.user.id)) {
    await interaction.reply({
      content: "Only the bot owner can use this command.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const gitPull = execSync("git pull origin main", {
      encoding: "utf-8",
      timeout: 30_000,
    });

    if (gitPull.includes("Already up to date")) {
      await interaction.editReply("Already up to date. Nothing to update.");
      return;
    }

    execSync("npm ci --production=false", {
      encoding: "utf-8",
      timeout: 120_000,
      stdio: "pipe",
    });

    execSync("npm run build", {
      encoding: "utf-8",
      timeout: 60_000,
      stdio: "pipe",
    });

    const commit = execSync("git rev-parse --short HEAD", {
      encoding: "utf-8",
    }).trim();

    await interaction.editReply(
      `Updated to commit \`${commit}\`. Restarting...`
    );

    // Exit — systemd Restart=always will bring it back
    process.exit(0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await interaction.editReply(`Update failed:\n\`\`\`\n${message.slice(0, 1500)}\n\`\`\``);
  }
}
