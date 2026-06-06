/**
 * Blocklist of prohibited substrings for tags.
 * Matches case-insensitive. Covers slurs and hate speech.
 * Swearwords (fuck, shit, etc.) are NOT blocked — the bot is dank.
 *
 * Extend via BOT_TAG_BLOCKLIST in .env (comma-separated substrings).
 */

const DEFAULT_BLOCKLIST = [
  // Racial slurs
  "nigg", "nigr", "niga", "chink", "kike", "spic", "gook",
  "wetback", "paki", "coon", "raghead", "towelhead",
  // Homophobic / transphobic slurs
  "fagg", "fag", "trann",
  // Ableist slurs
  "retard",
  // Hate speech terms
  "jihad", "heil hitler", "white power", "nazi",
];

export function getBlocklist(): RegExp[] {
  const env = process.env["BOT_TAG_BLOCKLIST"];
  const extras = env
    ? env.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
    : [];

  const all = [...DEFAULT_BLOCKLIST, ...extras];
  return all.map((term) => new RegExp(term, "i"));
}

/**
 * Returns the first blocked term found, or null if clean.
 */
export function findBlockedTag(tags: string[]): string | null {
  const patterns = getBlocklist();
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    for (const pattern of patterns) {
      if (pattern.test(lower)) return tag;
    }
  }
  return null;
}
