import { readFileSync } from "node:fs";

function getCommitHash(): string {
  try {
    return readFileSync("dist/commit.txt", "utf-8").trim();
  } catch {
    return "unknown";
  }
}

export function buildHelpText(): string {
  const commit = getCommitHash();

  return `**Birthday Bot commands:**

\`/birthday @user\` — Look up someone's birthday
\`/list\` — List all stored birthdays (🔒 = locked)
\`/upcoming\` — Birthdays this month
\`/next\` — Show whose birthday is next and when
\`/set-birthday @user MM-DD\` — Add or update a birthday
\`/tags @user\` — Show a user's tags (scraped + manual)
\`/add-tag @user tag\` — Add a single tag
\`/set-tags @user tag1, tag2\` — Replace all tags (admin only)
\`/tag-remove @user tag\` — Remove one tag (admin only)
\`/tags-clear @user\` — Clear all manual tags (admin only)
\`/missing\` — List members without birthdays
\`/test-birthday @user\` — Preview a wish (bot owner only)
\`/trigger\` — Manually run the birthday check (bot owner only)
\`/update\` — Pull latest code and restart (bot owner only)
\`/help\` — Show this list

\`${commit}\``;
}
