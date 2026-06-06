import { getLLMConfig } from "./config.js";
import type { Birthday } from "../types.js";
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

Use the provided tags to personalize the roast.`;

function buildUserPrompt(
  username: string,
  birthday: string,
  tags: string[]
): string {
  const tagList = tags.length > 0 ? tags.join(", ") : "no known tags";
  return `${username}'s birthday is ${birthday}. Tags: ${tagList}. Write a short, dank birthday wish.`;
}

export function buildMessages(
  username: string,
  birthday: string,
  tags: string[]
): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserPrompt(username, birthday, tags) },
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

    const tags = getTags(entry.userId).map((t) => t.tag);
    const messages = buildMessages(
      entry.username,
      entry.birthday,
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
    const tags = getTags(entry.userId).map((t) => t.tag);
    const messages = buildMessages(
      entry.username,
      entry.birthday,
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
