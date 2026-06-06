import { callLLM } from "./llm.js";

const EMOJI_PROMPT = `You are picking ONE emoji that summarizes a Discord user's vibe based on their traits. Rules:
- Return exactly ONE emoji character, nothing else — no text, no punctuation
- The emoji should roast them lightly but be recognizable
- Example traits "admin, joined:2018d ago, nickname:BossMan" → 🗿
- Example traits "role:Memelord, account:2016" → 🤡
- Example traits "role:Booster" → 💎
- No traits → 🎂
- Be creative, current, and meme-aware`;

export async function generateTraitEmoji(traits: string[]): Promise<string> {
  if (traits.length === 0) return "🎂";

  const traitList = traits.join(", ");
  const messages = [
    { role: "system" as const, content: EMOJI_PROMPT },
    { role: "user" as const, content: `Traits: ${traitList}` },
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
