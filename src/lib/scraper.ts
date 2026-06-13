import type { Client, GuildMember } from "discord.js";
import { getDiscordConfig } from "./config.js";
import { addTag, getTags, removeScrapedTags } from "./db.js";

/**
 * Extract tags from a guild member's Discord profile.
 * Returns an array of tag strings.
 */
export function extractTags(member: GuildMember): string[] {
  const tags: string[] = [];

  // Roles (excluding @everyone), sorted by position (highest first), top 5
  const roles = member.roles.cache
    .filter((r) => r.name !== "@everyone")
    .sort((a, b) => b.position - a.position)
    .map((r) => r.name)
    .slice(0, 5);

  for (const role of roles) {
    tags.push(`role:${role}`);
  }

  // Nickname (server-specific display name)
  if (member.nickname && member.nickname !== member.user.displayName) {
    tags.push(`nickname:${member.nickname}`);
  }

  // Join date — how long ago they joined the server
  if (member.joinedAt) {
    const daysAgo = Math.floor(
      (Date.now() - member.joinedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    tags.push(`joined:${daysAgo}d ago`);
  }

  return tags;
}

/**
 * Scrape a single member's profile. Removes old scraped tags
 * and replaces them with fresh ones.
 */
export async function scrapeOneMember(
  client: Client,
  userId: string
): Promise<void> {
  const { guildId } = getDiscordConfig();
  const guild = client.guilds.cache.get(guildId);
  if (!guild) throw new Error(`Bot is not in guild ${guildId}`);

  await guild.members.fetch();
  const member = guild.members.cache.get(userId);
  if (!member) {
    console.warn(`Member ${userId} not found in guild, skipping scrape`);
    return;
  }
  if (member.user.bot) return;

  removeScrapedTags(userId);
  const tags = extractTags(member);
  for (const tag of tags) {
    addTag(userId, tag, "scraped");
  }
}

/**
 * Scrape all members in the configured guild. Idempotent — skips
 * members who already have scraped tags, unless force=true.
 */
export async function scrapeAllMembers(
  client: Client,
  force = false
): Promise<void> {
  const { guildId } = getDiscordConfig();
  const guild = client.guilds.cache.get(guildId);

  if (!guild) {
    throw new Error(`Bot is not in guild ${guildId}`);
  }

  // Ensure member cache is populated
  await guild.members.fetch();

  let added = 0;
  let skipped = 0;

  for (const [, member] of guild.members.cache) {
    // Skip bots
    if (member.user.bot) continue;

    // Check if scraped tags already exist for this user
    const existing = getTags(member.id).filter(
      (t) => t.source === "scraped"
    );

    if (!force && existing.length > 0) {
      skipped++;
      continue;
    }

    // On forced refresh, remove old scraped tags first
    if (force && existing.length > 0) {
      removeScrapedTags(member.id);
    }

    const tags = extractTags(member);
    for (const tag of tags) {
      addTag(member.id, tag, "scraped");
    }
    added++;
  }

  console.log(
    `Scraper: ${added} members populated, ${skipped} already had tags`
  );
}
