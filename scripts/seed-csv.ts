/**
 * Seed birthdays from a CSV file by matching Discord display names.
 *
 * CSV format: username,birthday
 *   - birthday is MM-DD (optional — skipped if empty)
 *   - all entries are inserted as locked
 *
 * Usage:
 *   1. cp scripts/seed.csv.example scripts/seed.csv
 *   2. Edit seed.csv with your data
 *   3. sudo systemctl stop birthday-bot
 *   4. npx tsx scripts/seed-csv.ts
 *   5. sudo systemctl start birthday-bot
 */

import { Client, GatewayIntentBits } from "discord.js";
import { initDb, upsertBirthday } from "../src/lib/db.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

async function main() {
  const token = process.env["DISCORD_TOKEN"];
  const guildId = process.env["DISCORD_GUILD_ID"];
  if (!token || !guildId) {
    console.error("DISCORD_TOKEN and DISCORD_GUILD_ID must be set in .env");
    process.exit(1);
  }

  // Read CSV
  const csvPath = resolve(process.cwd(), "scripts", "seed.csv");
  let csv: string;
  try {
    csv = readFileSync(csvPath, "utf-8");
  } catch {
    console.error(`seed.csv not found at ${csvPath}`);
    console.error("Copy seed.csv.example → seed.csv and fill it in.");
    process.exit(1);
  }

  const lines = csv.trim().split("\n");
  const header = lines.shift();
  if (!header || !header.startsWith("username")) {
    console.error("CSV must have header: username,birthday");
    process.exit(1);
  }

  const entries: { name: string; birthday?: string }[] = [];
  for (const line of lines) {
    const [name, birthday] = line.split(",").map((s) => s.trim());
    if (!name) continue;
    entries.push({
      name,
      birthday: birthday || undefined,
    });
  }

  if (entries.length === 0) {
    console.error("No entries found in seed.csv");
    process.exit(1);
  }

  console.log(`Loaded ${entries.length} entries from CSV. Connecting to Discord...`);
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
  await client.login(token);

  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    console.error(`Guild ${guildId} not found.`);
    process.exit(1);
  }

  await guild.members.fetch();
  console.log(`Fetched ${guild.members.cache.size} members.\n`);

  initDb("data/birthdays.db");

  let inserted = 0;
  let skipped = 0;
  let unmatched = 0;

  for (const { name, birthday } of entries) {
    const lower = name.toLowerCase();
    const matches: { id: string; displayName: string }[] = [];
    for (const [, member] of guild.members.cache) {
      if (member.user.bot) continue;
      if (member.displayName.toLowerCase() === lower) {
        matches.push({ id: member.id, displayName: member.displayName });
      }
    }

    if (matches.length === 0) {
      console.warn(`  ⚠️  No match for "${name}"`);
      unmatched++;
      continue;
    }
    if (matches.length > 1) {
      console.warn(`  ⚠️  Multiple matches for "${name}": ${matches.map((m) => m.displayName).join(", ")}`);
      unmatched++;
      continue;
    }

    const match = matches[0]!;
    if (!birthday) {
      console.log(`  📋 ${match.displayName} — no birthday, skipped`);
      skipped++;
      continue;
    }

    upsertBirthday(match.id, match.displayName, birthday, true);
    console.log(`  ✅ ${match.displayName} → ${birthday} 🔒`);
    inserted++;
  }

  console.log(`\nInserted: ${inserted} | Skipped (no date): ${skipped} | Unmatched: ${unmatched}`);
  await client.destroy();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
