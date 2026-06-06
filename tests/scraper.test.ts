import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractTraits, scrapeAllMembers } from "../src/lib/scraper.js";
import { initDb, getTraits } from "../src/lib/db.js";

function setupDb(): void {
  process.env["DISCORD_TOKEN"] = "mock";
  process.env["DISCORD_APP_ID"] = "mock";
  process.env["DISCORD_GUILD_ID"] = "guild-1";
  process.env["ANNOUNCEMENTS_CHANNEL_ID"] = "mock";
  initDb(":memory:");
}

beforeEach(setupDb);

// --- extractTraits tests ---

function makeMockMember(overrides: Record<string, unknown> = {}) {
  const roleNames: string[] =
    (overrides["roleNames"] as string[]) ?? [];

  return {
    id: overrides["id"] ?? "test-user",
    roles: {
      cache: {
        filter: () => ({
          sort: () => ({
            map: () => [...roleNames],
          }),
        }),
      },
    },
    nickname: overrides["nickname"] ?? null,
    user: {
      displayName: overrides["displayName"] ?? "TestUser",
      bot: (overrides["bot"] as boolean) ?? false,
    },
    joinedAt: overrides["joinedAt"] ?? null,
  };
}

describe("extractTraits", () => {
  it("extracts roles as traits", () => {
    const traits = extractTraits(
      makeMockMember({
        roleNames: ["Admin", "Mod", "VIP"],
      }) as Parameters<typeof extractTraits>[0]
    );
    expect(traits).toContain("role:Admin");
    expect(traits).toContain("role:Mod");
    expect(traits).toContain("role:VIP");
  });

  it("caps roles at 5", () => {
    // slice is mocked to actually slice, so if we pass 10 roles it returns first 5.
    // But our mock's slice is a simple array slice. Let's verify it works.
    const roleNames = ["A", "B", "C", "D", "E", "F", "G"];
    const traits = extractTraits(
      makeMockMember({ roleNames }) as Parameters<typeof extractTraits>[0]
    );
    const roleTraits = traits.filter((t) => t.startsWith("role:"));
    expect(roleTraits).toHaveLength(5);
  });

  it("extracts nickname when different from display name", () => {
    const traits = extractTraits(
      makeMockMember({
        nickname: "Memelord420",
        displayName: "TestUser",
      }) as Parameters<typeof extractTraits>[0]
    );
    expect(traits).toContain("nickname:Memelord420");
  });

  it("skips nickname when same as display name", () => {
    const traits = extractTraits(
      makeMockMember({
        nickname: "TestUser",
        displayName: "TestUser",
      }) as Parameters<typeof extractTraits>[0]
    );
    const nickTraits = traits.filter((t) => t.startsWith("nickname:"));
    expect(nickTraits).toHaveLength(0);
  });

  it("skips nickname when null", () => {
    const traits = extractTraits(
      makeMockMember({
        nickname: null,
        displayName: "TestUser",
      }) as Parameters<typeof extractTraits>[0]
    );
    const nickTraits = traits.filter((t) => t.startsWith("nickname:"));
    expect(nickTraits).toHaveLength(0);
  });

  it("extracts join date", () => {
    const joinedAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const traits = extractTraits(
      makeMockMember({ joinedAt }) as Parameters<typeof extractTraits>[0]
    );
    expect(traits).toContain("joined:30d ago");
  });

  it("skips join date when null", () => {
    const traits = extractTraits(
      makeMockMember({ joinedAt: null }) as Parameters<typeof extractTraits>[0]
    );
    const joinTraits = traits.filter((t) => t.startsWith("joined:"));
    expect(joinTraits).toHaveLength(0);
  });
});

// --- scrapeAllMembers tests ---

describe("scrapeAllMembers", () => {
  it("populates scraped traits for members without them", async () => {
    const guild = {
      members: {
        fetch: vi.fn().mockResolvedValue(undefined),
        cache: new Map([
          [
            "u1",
            makeMockMember({
              id: "u1",
              roleNames: ["Admin"],
              nickname: "Boss",
              displayName: "Alice",
              joinedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
              bot: false,
            }),
          ],
          [
            "u2",
            makeMockMember({
              id: "u2",
              roleNames: ["Mod"],
              nickname: null,
              displayName: "Bob",
              joinedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
              bot: false,
            }),
          ],
          [
            "bot-1",
            makeMockMember({
              id: "bot-1",
              roleNames: [],
              bot: true,
            }),
          ],
        ]),
      },
    };

    const client = {
      guilds: {
        cache: {
          get: vi.fn().mockReturnValue(guild),
        },
      },
    };

    await scrapeAllMembers(client as unknown as Parameters<typeof scrapeAllMembers>[0]);

    const u1Traits = getTraits("u1").filter((t) => t.source === "scraped");
    const u2Traits = getTraits("u2").filter((t) => t.source === "scraped");
    const botTraits = getTraits("bot-1").filter((t) => t.source === "scraped");

    expect(u1Traits.length).toBeGreaterThan(0);
    expect(u1Traits.map((t) => t.trait)).toContain("role:Admin");
    expect(u1Traits.map((t) => t.trait)).toContain("nickname:Boss");

    expect(u2Traits.length).toBeGreaterThan(0);
    expect(u2Traits.map((t) => t.trait)).toContain("role:Mod");

    // Bots are skipped
    expect(botTraits).toHaveLength(0);
  });

  it("skips members who already have scraped traits", async () => {
    // Pre-populate scraped traits for u1
    const { addTrait } = await import("../src/lib/db.js");
    addTrait("u1", "role:Admin", "scraped");

    const guild = {
      members: {
        fetch: vi.fn().mockResolvedValue(undefined),
        cache: new Map([
          [
            "u1",
            makeMockMember({
              id: "u1",
              roleNames: ["Admin", "NewRole"],
              nickname: "Updated",
              displayName: "Alice",
              joinedAt: new Date(),
              bot: false,
            }),
          ],
        ]),
      },
    };

    const client = {
      guilds: {
        cache: {
          get: vi.fn().mockReturnValue(guild),
        },
      },
    };

    await scrapeAllMembers(client as unknown as Parameters<typeof scrapeAllMembers>[0]);

    // Should still only have the original role:Admin trait, no new ones added
    const scraped = getTraits("u1").filter((t) => t.source === "scraped");
    expect(scraped).toHaveLength(1);
    expect(scraped[0].trait).toBe("role:Admin");
  });

  it("throws when guild not found", async () => {
    const client = {
      guilds: {
        cache: {
          get: vi.fn().mockReturnValue(undefined),
        },
      },
    };

    await expect(
      scrapeAllMembers(
        client as unknown as Parameters<typeof scrapeAllMembers>[0]
      )
    ).rejects.toThrow("not in guild");
  });
});
