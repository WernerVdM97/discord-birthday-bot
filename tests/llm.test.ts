import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  buildMessages,
  generateWishes,
  regenerateMonthly,
} from "../src/lib/llm.js";
import { initDb, upsertBirthday, addTag, getWishCache } from "../src/lib/db.js";

beforeEach(() => {
  process.env["DEEPSEEK_API_KEY"] = "sk-test";
  process.env["DEEPSEEK_BASE_URL"] = "https://api.deepseek.com";
  process.env["DEEPSEEK_MODEL"] = "deepseek-chat";
  initDb(":memory:");
});

describe("buildMessages", () => {
  it("includes system prompt and user tags", () => {
    const tags = [
      { userId: "u1", tag: "admin", source: "manual" as const },
      { userId: "u1", tag: "memelord", source: "scraped" as const },
    ];
    const messages = buildMessages("Alice", "🔥", tags);

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[0].content.toLowerCase()).toContain("dank");
    expect(messages[1].role).toBe("user");
    expect(messages[1].content).toContain("Alice");
    expect(messages[1].content).toContain("🔥");
    expect(messages[1].content).toContain("admin");
    expect(messages[1].content).toContain("memelord");
    // system prompt should warn about date and weight manual tags
    expect(messages[0].content).toContain("date");
    expect(messages[0].content.toLowerCase()).toContain("manual");
  });

  it("handles empty tags", () => {
    const messages = buildMessages("Bob", "🎂", []);
    expect(messages[1].content).toContain("Bob");
    expect(messages[1].content).toContain("none");
  });
});

describe("generateWishes", () => {
  it("caches generated wishes", async () => {
    // Mock fetch to return a fake LLM response
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "Happy birthday Alice, you absolute legend! 🎂" } }],
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    upsertBirthday("u1", "Alice", "03-14");
    addTag("u1", "admin", "scraped");

    const entries = [{ userId: "u1", username: "Alice", birthday: "03-14", locked: false, tagEmoji: "🎂", updatedAt: "" }];
    const wishes = await generateWishes(entries);

    expect(wishes.get("u1")).toBe("Happy birthday Alice, you absolute legend! 🎂");

    // Should be cached
    const cached = getWishCache("u1", new Date().getFullYear());
    expect(cached).toBeDefined();
    expect(cached!.wish).toBe("Happy birthday Alice, you absolute legend! 🎂");

    vi.unstubAllGlobals();
  });

  it("uses cache on second call", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "Fresh wish!" } }],
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    upsertBirthday("u1", "Alice", "03-14");
    const entries = [{ userId: "u1", username: "Alice", birthday: "03-14", locked: false, tagEmoji: "🎂", updatedAt: "" }];

    // First call populates cache
    await generateWishes(entries);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second call should hit cache, not call API
    const wishes = await generateWishes(entries);
    expect(mockFetch).toHaveBeenCalledTimes(1); // still 1
    expect(wishes.get("u1")).toBe("Fresh wish!");

    vi.unstubAllGlobals();
  });

  it("falls back to generic message on API error", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.stubGlobal("fetch", mockFetch);

    upsertBirthday("u1", "Alice", "03-14");
    const entries = [{ userId: "u1", username: "Alice", birthday: "03-14", locked: false, tagEmoji: "🎂", updatedAt: "" }];

    const wishes = await generateWishes(entries);

    expect(wishes.get("u1")).toContain("Happy birthday Alice");
    expect(wishes.get("u1")).toContain("🎂");

    vi.unstubAllGlobals();
  });

  it("falls back on HTTP error response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve("Rate limited"),
    });
    vi.stubGlobal("fetch", mockFetch);

    upsertBirthday("u1", "Alice", "03-14");
    const entries = [{ userId: "u1", username: "Alice", birthday: "03-14", locked: false, tagEmoji: "🎂", updatedAt: "" }];

    const wishes = await generateWishes(entries);

    expect(wishes.get("u1")).toContain("Happy birthday Alice");
    expect(wishes.get("u1")).toContain("🎂");

    vi.unstubAllGlobals();
  });
});

describe("regenerateMonthly", () => {
  it("overwrites existing cache", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: "V1: happy bday alice!" } }],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: "V2: alice strikes again!" } }],
          }),
      });
    vi.stubGlobal("fetch", mockFetch);

    upsertBirthday("u1", "Alice", "03-14");
    const entries = [{ userId: "u1", username: "Alice", birthday: "03-14", locked: false, tagEmoji: "🎂", updatedAt: "" }];

    // First generation
    const w1 = await regenerateMonthly(entries);
    expect(w1.get("u1")).toBe("V1: happy bday alice!");

    // Second generation should overwrite
    const w2 = await regenerateMonthly(entries);
    expect(w2.get("u1")).toBe("V2: alice strikes again!");

    const cached = getWishCache("u1", new Date().getFullYear());
    expect(cached!.wish).toBe("V2: alice strikes again!");

    vi.unstubAllGlobals();
  });
});
