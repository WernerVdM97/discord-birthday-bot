import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { handleUpcoming } from "../../src/commands/upcoming.js";
import { initDb, upsertBirthday, setTagEmoji } from "../../src/lib/db.js";
import { mockInteraction } from "./helpers.js";

beforeEach(() => {
  initDb(":memory:");
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("handleUpcoming", () => {
  it("lists birthdays in current month with day, emoji, and username", async () => {
    vi.setSystemTime(new Date(2026, 5, 6)); // June

    upsertBirthday("u1", "Alice", "06-14", false, "🔥");
    upsertBirthday("u2", "Bob", "06-20");
    upsertBirthday("u3", "Carol", "07-04"); // different month

    const interaction = mockInteraction();
    await handleUpcoming(interaction);

    const call = (interaction.reply as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.content).toContain("Birthdays in June");
    expect(call.content).toContain("**14** 🔥 **Alice**");
    expect(call.content).toContain("**20** 🎂 **Bob**");
    expect(call.content).not.toContain("Carol");
    expect(call.content).not.toContain("06-"); // day only, no month prefix
    expect(call.ephemeral).toBe(true);
  });

  it("shows lock badges when role gate is inactive", async () => {
    vi.setSystemTime(new Date(2026, 5, 6)); // June

    upsertBirthday("u1", "Alice", "06-14", true);  // locked
    upsertBirthday("u2", "Bob", "06-20", false);   // unlocked

    const interaction = mockInteraction();
    await handleUpcoming(interaction);

    const call = (interaction.reply as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.content).toContain("🔒");
    expect(call.content).toContain("🔓");
  });

  it("returns message when no birthdays this month", async () => {
    vi.setSystemTime(new Date(2026, 5, 6)); // June

    const interaction = mockInteraction();
    await handleUpcoming(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("No birthdays in June"),
        ephemeral: true,
      })
    );
  });
});
