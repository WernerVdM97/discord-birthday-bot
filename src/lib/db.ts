import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Birthday, Trait, WishCache } from "../types.js";

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error("Database not initialized. Call initDb() first.");
  }
  return db;
}

export function initDb(path: string = "data/birthdays.db"): void {
  mkdirSync(dirname(path), { recursive: true });
  db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS birthdays (
      user_id     TEXT PRIMARY KEY,
      username    TEXT NOT NULL,
      birthday    TEXT NOT NULL,
      locked      INTEGER NOT NULL DEFAULT 0,
      trait_emoji TEXT NOT NULL DEFAULT '🎂',
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS traits (
      user_id     TEXT NOT NULL,
      trait       TEXT NOT NULL,
      source      TEXT NOT NULL CHECK(source IN ('scraped', 'manual')),
      PRIMARY KEY (user_id, trait)
    );

    CREATE TABLE IF NOT EXISTS wish_cache (
      user_id       TEXT PRIMARY KEY,
      wish          TEXT NOT NULL,
      year          INTEGER NOT NULL,
      generated_at  TEXT NOT NULL
    );
  `);

  // Migration: add trait_emoji column
  try {
    db.exec(
      "ALTER TABLE birthdays ADD COLUMN trait_emoji TEXT NOT NULL DEFAULT '🎂'"
    );
  } catch {
    // Column already exists
  }

  // Migration: add locked column if upgrading from schema without it
  try {
    db.exec(
      "ALTER TABLE birthdays ADD COLUMN locked INTEGER NOT NULL DEFAULT 0"
    );
  } catch {
    // Column already exists — fine
  }
}

// --- Mapping helpers ---

function mapBirthday(row: Record<string, unknown>): Birthday {
  return {
    userId: row["user_id"] as string,
    username: row["username"] as string,
    birthday: row["birthday"] as string,
    locked: (row["locked"] as number) === 1,
    traitEmoji: (row["trait_emoji"] as string) ?? "🎂",
    updatedAt: row["updated_at"] as string,
  };
}

function mapTrait(row: Record<string, unknown>): Trait {
  return {
    userId: row["user_id"] as string,
    trait: row["trait"] as string,
    source: row["source"] as Trait["source"],
  };
}

function mapWishCache(row: Record<string, unknown>): WishCache {
  return {
    userId: row["user_id"] as string,
    wish: row["wish"] as string,
    year: row["year"] as number,
    generatedAt: row["generated_at"] as string,
  };
}

// --- Birthdays ---

export function getBirthday(userId: string): Birthday | undefined {
  const row = getDb()
    .prepare("SELECT * FROM birthdays WHERE user_id = ?")
    .get(userId) as Record<string, unknown> | undefined;
  return row ? mapBirthday(row) : undefined;
}

export function getAllBirthdays(): Birthday[] {
  return (
    getDb()
      .prepare("SELECT * FROM birthdays ORDER BY birthday ASC")
      .all() as Record<string, unknown>[]
  ).map(mapBirthday);
}

export function getUpcomingBirthdays(month: number): Birthday[] {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    getDb()
      .prepare(
        "SELECT * FROM birthdays WHERE birthday LIKE ? ORDER BY birthday ASC"
      )
      .all(`${pad(month)}-%`) as Record<string, unknown>[]
  ).map(mapBirthday);
}

export function upsertBirthday(
  userId: string,
  username: string,
  birthday: string,
  locked: boolean = false,
  traitEmoji: string = "🎂"
): void {
  getDb()
    .prepare(
      `INSERT INTO birthdays (user_id, username, birthday, locked, trait_emoji, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         username = excluded.username,
         birthday = excluded.birthday,
         locked = excluded.locked,
         trait_emoji = excluded.trait_emoji,
         updated_at = excluded.updated_at`
    )
    .run(userId, username, birthday, locked ? 1 : 0, traitEmoji, new Date().toISOString());
}

export function setTraitEmoji(userId: string, emoji: string): void {
  getDb()
    .prepare("UPDATE birthdays SET trait_emoji = ? WHERE user_id = ?")
    .run(emoji, userId);
}

export function isBirthdayLocked(userId: string): boolean {
  const entry = getBirthday(userId);
  return entry?.locked ?? false;
}

// --- Traits ---

export function getTraits(userId: string): Trait[] {
  return (
    getDb()
      .prepare("SELECT * FROM traits WHERE user_id = ?")
      .all(userId) as Record<string, unknown>[]
  ).map(mapTrait);
}

export function getTraitsForUsers(userIds: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (userIds.length === 0) return map;

  const placeholders = userIds.map(() => "?").join(", ");
  const rows = getDb()
    .prepare(
      `SELECT user_id, trait FROM traits WHERE user_id IN (${placeholders})`
    )
    .all(...userIds) as { user_id: string; trait: string }[];

  for (const row of rows) {
    const existing = map.get(row.user_id) ?? [];
    existing.push(row.trait);
    map.set(row.user_id, existing);
  }
  return map;
}

export function addTrait(
  userId: string,
  trait: string,
  source: "scraped" | "manual"
): void {
  getDb()
    .prepare(
      "INSERT OR IGNORE INTO traits (user_id, trait, source) VALUES (?, ?, ?)"
    )
    .run(userId, trait, source);
}

export function clearManualTraits(userId: string): void {
  getDb()
    .prepare("DELETE FROM traits WHERE user_id = ? AND source = 'manual'")
    .run(userId);
}

export function removeScrapedTraits(userId: string): void {
  getDb()
    .prepare("DELETE FROM traits WHERE user_id = ? AND source = 'scraped'")
    .run(userId);
}

// --- Wish Cache ---

export function getWishCache(
  userId: string,
  year: number
): WishCache | undefined {
  const row = getDb()
    .prepare("SELECT * FROM wish_cache WHERE user_id = ? AND year = ?")
    .get(userId, year) as Record<string, unknown> | undefined;
  return row ? mapWishCache(row) : undefined;
}

export function setWishCache(
  userId: string,
  wish: string,
  year: number
): void {
  getDb()
    .prepare(
      `INSERT INTO wish_cache (user_id, wish, year, generated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         wish = excluded.wish,
         year = excluded.year,
         generated_at = excluded.generated_at`
    )
    .run(userId, wish, year, new Date().toISOString());
}
