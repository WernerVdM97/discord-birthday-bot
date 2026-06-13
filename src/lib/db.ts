import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Birthday, Tag, WishCache } from "../types.js";

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

	// --- Migrations (run before CREATE TABLE so renames don't conflict) ---

	// Migration: rename traits table -> tags (from the trait→tag rename)
	try {
		db.exec("ALTER TABLE traits RENAME TO tags");
	} catch {
		// Table already renamed or doesn't exist
	}

	// Migration: rename trait column -> tag in tags table
	try {
		db.exec("ALTER TABLE tags RENAME COLUMN trait TO tag");
	} catch {
		// Column already renamed or doesn't exist
	}

	// Migration: rename trait_emoji column -> tag_emoji in birthdays table
	try {
		db.exec("ALTER TABLE birthdays RENAME COLUMN trait_emoji TO tag_emoji");
	} catch {
		// Column already renamed or doesn't exist
	}

	// --- Create tables (no-ops if already present) ---

	db.exec(`
    CREATE TABLE IF NOT EXISTS birthdays (
      user_id     TEXT PRIMARY KEY,
      username    TEXT NOT NULL,
      birthday    TEXT NOT NULL,
      locked      INTEGER NOT NULL DEFAULT 0,
      tag_emoji TEXT NOT NULL DEFAULT '🎂',
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      user_id     TEXT NOT NULL,
      tag       TEXT NOT NULL,
      source      TEXT NOT NULL CHECK(source IN ('scraped', 'manual')),
      PRIMARY KEY (user_id, tag)
    );

    CREATE TABLE IF NOT EXISTS wish_cache (
      user_id       TEXT PRIMARY KEY,
      wish          TEXT NOT NULL,
      year          INTEGER NOT NULL,
      generated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sent_log (
      user_id   TEXT NOT NULL,
      date      TEXT NOT NULL,
      status    TEXT NOT NULL CHECK(status IN ('sent', 'failed')),
      sent_at   TEXT NOT NULL,
      error     TEXT,
      PRIMARY KEY (user_id, date)
    );
  `);

	// Migration: add tag_emoji column (for fresh DBs or pre-emoji schemas)
	try {
		db.exec(
			"ALTER TABLE birthdays ADD COLUMN tag_emoji TEXT NOT NULL DEFAULT '🎂'",
		);
	} catch {
		// Column already exists
	}

	// Migration: add locked column if upgrading from schema without it
	try {
		db.exec(
			"ALTER TABLE birthdays ADD COLUMN locked INTEGER NOT NULL DEFAULT 0",
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
		tagEmoji: (row["tag_emoji"] as string) ?? "🎂",
		updatedAt: row["updated_at"] as string,
	};
}

function mapTag(row: Record<string, unknown>): Tag {
	return {
		userId: row["user_id"] as string,
		tag: row["tag"] as string,
		source: row["source"] as Tag["source"],
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
				"SELECT * FROM birthdays WHERE birthday LIKE ? ORDER BY birthday ASC",
			)
			.all(`${pad(month)}-%`) as Record<string, unknown>[]
	).map(mapBirthday);
}

export function upsertBirthday(
	userId: string,
	username: string,
	birthday: string,
	locked: boolean = false,
	tagEmoji: string = "🎂",
): void {
	getDb()
		.prepare(
			`INSERT INTO birthdays (user_id, username, birthday, locked, tag_emoji, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         username = excluded.username,
         birthday = excluded.birthday,
         locked = excluded.locked,
         tag_emoji = excluded.tag_emoji,
         updated_at = excluded.updated_at`,
		)
		.run(
			userId,
			username,
			birthday,
			locked ? 1 : 0,
			tagEmoji,
			new Date().toISOString(),
		);
}

export function setTagEmoji(userId: string, emoji: string): void {
	getDb()
		.prepare("UPDATE birthdays SET tag_emoji = ? WHERE user_id = ?")
		.run(emoji, userId);
}

export function isBirthdayLocked(userId: string): boolean {
	const entry = getBirthday(userId);
	return entry?.locked ?? false;
}

// --- Tags ---

export function getTags(userId: string): Tag[] {
	return (
		getDb()
			.prepare("SELECT * FROM tags WHERE user_id = ?")
			.all(userId) as Record<string, unknown>[]
	).map(mapTag);
}

export function getTagsForUsers(userIds: string[]): Map<string, string[]> {
	const map = new Map<string, string[]>();
	if (userIds.length === 0) return map;

	const placeholders = userIds.map(() => "?").join(", ");
	const rows = getDb()
		.prepare(`SELECT user_id, tag FROM tags WHERE user_id IN (${placeholders})`)
		.all(...userIds) as { user_id: string; tag: string }[];

	for (const row of rows) {
		const existing = map.get(row.user_id) ?? [];
		existing.push(row.tag);
		map.set(row.user_id, existing);
	}
	return map;
}

export function addTag(
	userId: string,
	tag: string,
	source: "scraped" | "manual",
): void {
	getDb()
		.prepare(
			"INSERT OR IGNORE INTO tags (user_id, tag, source) VALUES (?, ?, ?)",
		)
		.run(userId, tag, source);
}

export function clearManualTags(userId: string): void {
	getDb()
		.prepare("DELETE FROM tags WHERE user_id = ? AND source = 'manual'")
		.run(userId);
}

export function removeScrapedTags(userId: string): void {
	getDb()
		.prepare("DELETE FROM tags WHERE user_id = ? AND source = 'scraped'")
		.run(userId);
}

// --- Wish Cache ---

export function getWishCache(
	userId: string,
	year: number,
): WishCache | undefined {
	const row = getDb()
		.prepare("SELECT * FROM wish_cache WHERE user_id = ? AND year = ?")
		.get(userId, year) as Record<string, unknown> | undefined;
	return row ? mapWishCache(row) : undefined;
}

export function setWishCache(userId: string, wish: string, year: number): void {
	getDb()
		.prepare(
			`INSERT INTO wish_cache (user_id, wish, year, generated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         wish = excluded.wish,
         year = excluded.year,
         generated_at = excluded.generated_at`,
		)
		.run(userId, wish, year, new Date().toISOString());
}

// --- Sent Log ---

export function markBirthdaySent(userId: string, date: string): void {
	getDb()
		.prepare(
			`INSERT INTO sent_log (user_id, date, status, sent_at)
       VALUES (?, ?, 'sent', ?)
       ON CONFLICT(user_id, date) DO UPDATE SET
         status = 'sent',
         sent_at = excluded.sent_at,
         error = NULL`,
		)
		.run(userId, date, new Date().toISOString());
}

export function markBirthdayFailed(
	userId: string,
	date: string,
	error: string,
): void {
	const truncated = error.slice(0, 500);
	getDb()
		.prepare(
			`INSERT INTO sent_log (user_id, date, status, sent_at, error)
       VALUES (?, ?, 'failed', ?, ?)
       ON CONFLICT(user_id, date) DO UPDATE SET
         status = 'failed',
         sent_at = excluded.sent_at,
         error = excluded.error`,
		)
		.run(userId, date, new Date().toISOString(), truncated);
}

export function isBirthdaySent(userId: string, date: string): boolean {
	const row = getDb()
		.prepare(
			"SELECT status FROM sent_log WHERE user_id = ? AND date = ? AND status = 'sent'",
		)
		.get(userId, date);
	return row !== undefined;
}

export function getUnsentBirthdays(
	date: string,
): { userId: string; username: string }[] {
	return (
		getDb()
			.prepare(
				`SELECT b.user_id, b.username
         FROM birthdays b
         WHERE b.birthday = ?
           AND NOT EXISTS (
             SELECT 1 FROM sent_log s
             WHERE s.user_id = b.user_id
               AND s.date = ?
               AND s.status = 'sent'
           )`,
			)
			.all(date.slice(5), date) as { user_id: string; username: string }[]
	).map((row) => ({ userId: row.user_id, username: row.username }));
}
