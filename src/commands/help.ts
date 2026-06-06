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
\`/birthdays\` — List all stored birthdays (🔒 = locked)
\`/upcoming\` — Birthdays this month
\`/set-birthday @user MM-DD\` — Add or update a birthday
\`/set-traits @user trait1, trait2\` — Tag someone for roasting
\`/missing\` — List members without birthdays
\`/help\` — Show this list

\`${commit}\``;
}
