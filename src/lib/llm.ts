import { getLLMConfig } from "./config.js";
import type { Birthday, Tag } from "../types.js";
import { getTags, getWishCache, setWishCache } from "./db.js";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `You are a Discord bot that posts birthday wishes in a private friend-group server. The tone is:
- Dank, meme-heavy, banter-style
- Borderline offensive but clearly in good fun — roast energy, not mean energy
- Short and punchy (max 2-3 sentences, ~150 characters)
- Include 1-2 emojis, placed naturally — don't overdo it
- Never cruel, never personal attacks, never genuinely hurtful
- Do NOT mention the specific date (e.g. "June 14th") in the wish — focus on the person, not the calendar
- The user's emoji is provided for flavor, but don't force it into the text

Use the provided tags to personalize the roast. Manual tags are most important — they're what the person chose for themselves. Scraped tags are background context only. Ignore any "joined X days ago" tag — it's noise.`;

const AFRIKAANS_INDICATORS = [
  "afrikaans",
  "fok",
  "braai",
  "afr",
  "suid-afrika",
  "boer",
  "springbok",
];

function hasAfrikaansTags(allTags: string[]): boolean {
  const lower = allTags.map((t) => t.toLowerCase());
  return AFRIKAANS_INDICATORS.some((ind) => lower.some((t) => t.includes(ind)));
}

function buildUserPrompt(
  username: string,
  tagEmoji: string,
  tags: Tag[]
): string {
  const manual = tags.filter((t) => t.source === "manual");
  const scraped = tags
    .filter((t) => t.source === "scraped")
    .filter((t) => !t.tag.startsWith("joined:")); // strip join-date noise

  const manualList = manual.length > 0 ? manual.map((t) => t.tag).join(", ") : "none";
  const scrapedList = scraped.length > 0 ? scraped.map((t) => t.tag).join(", ") : "none";

  let prompt = `It's ${username}'s birthday. Emoji: ${tagEmoji}.`;
  prompt += `\nManual tags (important — self-chosen): ${manualList}`;
  prompt += `\nScraped tags (background context only): ${scrapedList}`;
  prompt += `\nWrite a short, dank birthday wish.`;

  if (hasAfrikaansTags(tags.map((t) => t.tag))) {
    prompt += `\n\nLANGUAGE RULES:
- Write the first sentence(s) in English, then follow with a separate sentence or two in Afrikaans.
- Never mix English and Afrikaans inside the same sentence (no "mengels").
- Keep each language's sentences together — English block first, Afrikaans block second.`;
  }

  return prompt;
}

export function buildMessages(
  username: string,
  tagEmoji: string,
  tags: Tag[]
): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserPrompt(username, tagEmoji, tags) },
  ];
}

export async function callLLM(messages: ChatMessage[]): Promise<string> {
  const { apiKey, baseUrl, model } = getLLMConfig();

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 100,
      temperature: 0.9,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `LLM API error ${response.status}: ${body.slice(0, 200)}`
    );
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("LLM returned empty response");
  }

  return content.trim();
}

/**
 * Generate birthday wishes for all given entries. Caches results
 * for the current year. Returns a map of userId → wish.
 */
export async function generateWishes(
  entries: Birthday[]
): Promise<Map<string, string>> {
  const currentYear = new Date().getFullYear();
  const wishes = new Map<string, string>();

  for (const entry of entries) {
    // Check cache first
    const cached = getWishCache(entry.userId, currentYear);
    if (cached) {
      wishes.set(entry.userId, cached.wish);
      continue;
    }

    const tags = getTags(entry.userId);
    const messages = buildMessages(
      entry.username,
      entry.tagEmoji,
      tags
    );

    try {
      const wish = await callLLM(messages);
      setWishCache(entry.userId, wish, currentYear);
      wishes.set(entry.userId, wish);
    } catch (err) {
      console.error(`Failed to generate wish for ${entry.username}:`, err);
      // Fallback: generic message
      const fallback = `Happy birthday ${entry.username}! 🎂`;
      wishes.set(entry.userId, fallback);
    }
  }

  return wishes;
}

/**
 * Regenerate all wishes for the current year. Overwrites cache.
 */
export async function regenerateMonthly(
  entries: Birthday[]
): Promise<Map<string, string>> {
  const currentYear = new Date().getFullYear();

  // Clear existing cache for this year by regenerating fresh
  // (setWishCache upserts, so just generate fresh for all)
  const wishes = new Map<string, string>();

  for (const entry of entries) {
    const tags = getTags(entry.userId);
    const messages = buildMessages(
      entry.username,
      entry.tagEmoji,
      tags
    );

    try {
      const wish = await callLLM(messages);
      setWishCache(entry.userId, wish, currentYear);
      wishes.set(entry.userId, wish);
    } catch (err) {
      console.error(`Failed to regenerate wish for ${entry.username}:`, err);
      // Keep old cache if regeneration fails
      const old = getWishCache(entry.userId, currentYear);
      if (old) {
        wishes.set(entry.userId, old.wish);
      } else {
        wishes.set(entry.userId, `Happy birthday ${entry.username}! 🎂`);
      }
    }
  }

  return wishes;
}
