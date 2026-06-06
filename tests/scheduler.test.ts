import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkAndPostBirthdays } from "../src/scheduler/daily-check.js";
import { initDb, upsertBirthday, addTag, setWishCache } from "../src/lib/db.js";

beforeEach(() => {
  process.env["DISCORD_TOKEN"] = "mock";
  process.env["DISCORD_APP_ID"] = "mock";
  process.env["DISCORD_GUILD_ID"] = "mock";
  process.env["ANNOUNCEMENTS_CHANNEL_ID"] = "chan-1";
  process.env["DEEPSEEK_API_KEY"] = "sk-test";
  initDb(":memory:");
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("checkAndPostBirthdays", () => {
  it("posts wish when there is a birthday today", async () => {
    // Set date to June 14
    vi.setSystemTime(new Date(2026, 5, 14)); // month 5 = June

    const sendMock = vi.fn().mockResolvedValue(undefined);
    const channel = { send: sendMock };
    const client = {
      channels: {
        cache: {
          get: vi.fn().mockReturnValue(channel),
        },
      },
    };

    upsertBirthday("u1", "Alice", "06-14");
    setWishCache("u1", "happy bday Alice, you legend! 🎂", 2026);

    await checkAndPostBirthdays(client as unknown as Parameters<typeof checkAndPostBirthdays>[0]);

    expect(sendMock).toHaveBeenCalledWith(
      expect.stringContaining("<@u1>")
    );
    expect(sendMock).toHaveBeenCalledWith(
      expect.stringContaining("happy bday Alice")
    );

  });

  it("does nothing when no birthdays today", async () => {
    vi.setSystemTime(new Date(2026, 5, 14));

    const sendMock = vi.fn();
    const channel = { send: sendMock };
    const client = {
      channels: {
        cache: {
          get: vi.fn().mockReturnValue(channel),
        },
      },
    };

    // No birthdays at all
    await checkAndPostBirthdays(client as unknown as Parameters<typeof checkAndPostBirthdays>[0]);

    expect(sendMock).not.toHaveBeenCalled();
  });

  it("does nothing when birthday exists but on different date", async () => {
    vi.setSystemTime(new Date(2026, 5, 14)); // June 14

    const sendMock = vi.fn();
    const channel = { send: sendMock };
    const client = {
      channels: {
        cache: {
          get: vi.fn().mockReturnValue(channel),
        },
      },
    };

    upsertBirthday("u1", "Alice", "12-25"); // December, not June

    await checkAndPostBirthdays(client as unknown as Parameters<typeof checkAndPostBirthdays>[0]);

    expect(sendMock).not.toHaveBeenCalled();
  });

  it("handles missing channel gracefully", async () => {
    vi.setSystemTime(new Date(2026, 5, 14));

    upsertBirthday("u1", "Alice", "06-14");

    const client = {
      channels: {
        cache: {
          get: vi.fn().mockReturnValue(undefined),
        },
      },
    };

    // Should not throw
    await checkAndPostBirthdays(client as unknown as Parameters<typeof checkAndPostBirthdays>[0]);
  });

  it("falls back to on-the-fly generation on cache miss", async () => {
    vi.setSystemTime(new Date(2026, 5, 14));

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: "on the fly wish!" } }],
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const sendMock = vi.fn().mockResolvedValue(undefined);
    const channel = { send: sendMock };
    const client = {
      channels: {
        cache: {
          get: vi.fn().mockReturnValue(channel),
        },
      },
    };

    upsertBirthday("u1", "Alice", "06-14");
    // No wish cache set — triggers on-the-fly generation

    await checkAndPostBirthdays(client as unknown as Parameters<typeof checkAndPostBirthdays>[0]);

    expect(mockFetch).toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalledWith(
      expect.stringContaining("on the fly wish!")
    );
  });
});
