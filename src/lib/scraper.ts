import type { Client, GuildMember } from "discord.js";
import { getDiscordConfig } from "./config.js";
import { addTrait, getTraits } from "./db.js";

/**
 * Extract traits from a guild member's Discord profile.
 * Returns an array of tag strings.
 */
export function extractTraits(member: GuildMember): string[] {
  const traits: string[] = [];

  // Roles (excluding @everyone), sorted by position (highest first), top 5
  const roles = member.roles.cache
    .filter((r) => r.name !== "@everyone")
    .sort((a, b) => b.position - a.position)
    .map((r) => r.name)
    .slice(0, 5);

  for (const role of roles) {
    traits.push(`role:${role}`);
  }

  // Nickname (server-specific display name)
  if (member.nickname && member.nickname !== member.user.displayName) {
    traits.push(`nickname:${member.nickname}`);
  }

  // Join date — how long ago they joined the server
  if (member.joinedAt) {
    const daysAgo = Math.floor(
      (Date.now() - member.joinedAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    traits.push(`joined:${daysAgo}d ago`);
  }

  return traits;
}

/**
 * Scrape all members in the configured guild. For each member without
 * existing scraped traits, extract and store them. Non-destructive
 * (will not touch existing scraped traits on re-run).
 */
export async function scrapeAllMembers(client: Client): Promise<void> {
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

    // Check if scraped traits already exist for this user
    const existing = getTraits(member.id).filter(
      (t) => t.source === "scraped"
    );
    if (existing.length > 0) {
      skipped++;
      continue;
    }

    const traits = extractTraits(member);
    for (const trait of traits) {
      addTrait(member.id, trait, "scraped");
    }
    added++;
  }

  console.log(
    `Scraper: ${added} members populated, ${skipped} already had traits`
  );
}
