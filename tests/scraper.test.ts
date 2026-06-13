import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractTags, scrapeAllMembers } from "../src/lib/scraper.js";
import { initDb, getTags } from "../src/lib/db.js";

function setupDb(): void {
  process.env["DISCORD_TOKEN"] = "mock";
  process.env["DISCORD_APP_ID"] = "mock";
  process.env["DISCORD_GUILD_ID"] = "guild-1";
  process.env["ANNOUNCEMENTS_CHANNEL_ID"] = "mock";
  initDb(":memory:");
}

beforeEach(setupDb);

// --- extractTags tests ---

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

describe("extractTags", () => {
  it("extracts roles as tags", () => {
    const tags = extractTags(
      makeMockMember({
        roleNames: ["Admin", "Mod", "VIP"],
      }) as Parameters<typeof extractTags>[0]
    );
    expect(tags).toContain("role:Admin");
    expect(tags).toContain("role:Mod");
    expect(tags).toContain("role:VIP");
  });

  it("caps roles at 5", () => {
    // slice is mocked to actually slice, so if we pass 10 roles it returns first 5.
    // But our mock's slice is a simple array slice. Let's verify it works.
    const roleNames = ["A", "B", "C", "D", "E", "F", "G"];
    const tags = extractTags(
      makeMockMember({ roleNames }) as Parameters<typeof extractTags>[0]
    );
    const roleTags = tags.filter((t) => t.startsWith("role:"));
    expect(roleTags).toHaveLength(5);
  });

  it("extracts nickname when different from display name", () => {
    const tags = extractTags(
      makeMockMember({
        nickname: "Memelord420",
        displayName: "TestUser",
      }) as Parameters<typeof extractTags>[0]
    );
    expect(tags).toContain("nickname:Memelord420");
  });

  it("skips nickname when same as display name", () => {
    const tags = extractTags(
      makeMockMember({
        nickname: "TestUser",
        displayName: "TestUser",
      }) as Parameters<typeof extractTags>[0]
    );
    const nickTags = tags.filter((t) => t.startsWith("nickname:"));
    expect(nickTags).toHaveLength(0);
  });

  it("skips nickname when null", () => {
    const tags = extractTags(
      makeMockMember({
        nickname: null,
        displayName: "TestUser",
      }) as Parameters<typeof extractTags>[0]
    );
    const nickTags = tags.filter((t) => t.startsWith("nickname:"));
    expect(nickTags).toHaveLength(0);
  });

  it("extracts join date", () => {
    const joinedAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const tags = extractTags(
      makeMockMember({ joinedAt }) as Parameters<typeof extractTags>[0]
    );
    expect(tags).toContain("joined:30d ago");
  });

  it("skips join date when null", () => {
    const tags = extractTags(
      makeMockMember({ joinedAt: null }) as Parameters<typeof extractTags>[0]
    );
    const joinTags = tags.filter((t) => t.startsWith("joined:"));
    expect(joinTags).toHaveLength(0);
  });
});

// --- scrapeAllMembers tests ---

describe("scrapeAllMembers", () => {
  it("populates scraped tags for members without them", async () => {
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

    const u1Tags = getTags("u1").filter((t) => t.source === "scraped");
    const u2Tags = getTags("u2").filter((t) => t.source === "scraped");
    const botTags = getTags("bot-1").filter((t) => t.source === "scraped");

    expect(u1Tags.length).toBeGreaterThan(0);
    expect(u1Tags.map((t) => t.tag)).toContain("role:Admin");
    expect(u1Tags.map((t) => t.tag)).toContain("nickname:Boss");

    expect(u2Tags.length).toBeGreaterThan(0);
    expect(u2Tags.map((t) => t.tag)).toContain("role:Mod");

    // Bots are skipped
    expect(botTags).toHaveLength(0);
  });

  it("skips members who already have scraped tags", async () => {
    // Pre-populate scraped tags for u1
    const { addTag } = await import("../src/lib/db.js");
    addTag("u1", "role:Admin", "scraped");

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

    // Should still only have the original role:Admin tag, no new ones added
    const scraped = getTags("u1").filter((t) => t.source === "scraped");
    expect(scraped).toHaveLength(1);
    expect(scraped[0].tag).toBe("role:Admin");
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
