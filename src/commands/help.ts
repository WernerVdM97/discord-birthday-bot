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
\`/list\` — List all stored birthdays
\`/upcoming\` — Birthdays this month
\`/next\` — Show whose birthday is next and when
\`/set-birthday @user MM-DD\` — Add or update a birthday
\`/tags @user\` — Show a user's tags (scraped + manual)
\`/add-tag @user tag\` — Add a single tag
\`/missing\` — List members without birthdays
\`/help\` — Show this list

🔒 Admin
\`/set-tags @user tag1, tag2\` — Replace all tags
\`/tag-remove @user tag\` — Remove one tag
\`/refresh-emojis\` — Regenerate tag emojis for everyone
\`/tags-clear @user\` — Clear all manual tags

🐛 Owner
\`/trigger\` — Manually run the birthday check
\`/test-birthday @user\` — Preview a wish
\`/update\` — Pull latest code and restart

\`${commit}\``;
}
