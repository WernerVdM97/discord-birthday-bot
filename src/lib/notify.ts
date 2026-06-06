import type { Client } from "discord.js";
import { getDiscordConfig } from "./config.js";

/**
 * Send a DM to the configured bot admin. Silently no-ops if
 * BOT_ADMIN_ID is not set or the user can't be reached.
 */
export async function notifyAdmin(
  client: Client,
  message: string
): Promise<void> {
  const { botAdminId } = getDiscordConfig();
  if (!botAdminId) return;

  try {
    const user = await client.users.fetch(botAdminId);
    await user.send(message);
  } catch (err) {
    console.error("Failed to notify admin:", err);
  }
}
