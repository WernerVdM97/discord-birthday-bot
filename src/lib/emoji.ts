import { callLLM } from "./llm.js";

const EMOJI_PROMPT = `You are picking ONE emoji that summarizes a Discord user's vibe based on their tags. Rules:
- Return exactly ONE emoji character, nothing else — no text, no punctuation
- The emoji should roast them lightly but be recognizable
- Example tags "admin, joined:2018d ago, nickname:BossMan" → 🗿
- Example tags "role:Memelord, account:2016" → 🤡
- Example tags "role:Booster" → 💎
- No tags → 🎂
- Be creative, current, and meme-aware`;

export async function generateTagEmoji(tags: string[]): Promise<string> {
  if (tags.length === 0) return "🎂";

  const tagList = tags.join(", ");
  const messages = [
    { role: "system" as const, content: EMOJI_PROMPT },
    { role: "user" as const, content: `Tags: ${tagList}` },
  ];

  try {
    const result = await callLLM(messages);
    // Extract just the first emoji character from the response
    const emoji = result.trim().slice(0, 2); // emojis are 1-2 chars
    // Validate it's actually an emoji
    if (/[\p{Emoji}]/u.test(emoji)) return emoji;
    return "🎂";
  } catch {
    return "🎂";
  }
}
