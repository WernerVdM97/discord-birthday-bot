import type { DiscordConfig, LLMConfig } from "../types.js";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function getDiscordConfig(): DiscordConfig {
  return {
    token: requireEnv("DISCORD_TOKEN"),
    appId: requireEnv("DISCORD_APP_ID"),
    guildId: requireEnv("DISCORD_GUILD_ID"),
    announcementsChannelId: requireEnv("ANNOUNCEMENTS_CHANNEL_ID"),
    botAdminId: process.env["BOT_ADMIN_ID"] || undefined,
    adminRoleId: process.env["BOT_ADMIN_ROLE_ID"] || undefined,
    memberRoleId: process.env["BOT_MEMBER_ROLE_ID"] || undefined,
  };
}

export function getLLMConfig(): LLMConfig {
  return {
    apiKey: requireEnv("DEEPSEEK_API_KEY"),
    baseUrl: process.env["DEEPSEEK_BASE_URL"] ?? "https://api.deepseek.com",
    model: process.env["DEEPSEEK_MODEL"] ?? "deepseek-chat",
  };
}
