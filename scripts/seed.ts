/**
 * Seed script — populate the birthdays table from a JSON file.
 *
 * Usage:
 *   1. cp scripts/seed.example.json scripts/seed.json
 *   2. Edit seed.json with your data (userId = Discord snowflake)
 *   3. npx tsx scripts/seed.ts
 */

import { initDb, upsertBirthday, getAllBirthdays } from "../src/lib/db.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface SeedEntry {
  username: string;
  userId: string;
  birthday: string;
  locked: boolean;
}

const seedPath = resolve(import.meta.dirname ?? __dirname, "seed.json");

let data: SeedEntry[];
try {
  data = JSON.parse(readFileSync(seedPath, "utf-8"));
} catch {
  console.error(`seed.json not found at ${seedPath}`);
  console.error("Copy seed.example.json → seed.json and fill it in.");
  process.exit(1);
}

if (!Array.isArray(data) || data.length === 0) {
  console.error("seed.json is empty or not an array.");
  process.exit(1);
}

initDb("data/birthdays.db");

for (const entry of data) {
  if (!entry.userId || entry.userId === "PUT_DISCORD_SNOWFLAKE_HERE") {
    console.warn(`Skipping ${entry.username}: no valid userId`);
    continue;
  }
  upsertBirthday(entry.userId, entry.username, entry.birthday, entry.locked);
  console.log(`  ${entry.username} → ${entry.birthday}${entry.locked ? " 🔒" : ""}`);
}

console.log(`\nSeeded ${data.length} entries.`);

const all = getAllBirthdays();
console.log(`Database now has ${all.length} total birthdays.`);
