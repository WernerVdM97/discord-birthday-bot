import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { handleUpcoming } from "../../src/commands/upcoming.js";
import { initDb, upsertBirthday } from "../../src/lib/db.js";
import { mockInteraction } from "./helpers.js";

beforeEach(() => {
  initDb(":memory:");
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("handleUpcoming", () => {
  it("lists birthdays in current month", async () => {
    // Set clock to June 2026
    vi.setSystemTime(new Date(2026, 5, 6)); // month 5 = June

    upsertBirthday("u1", "Alice", "06-14");
    upsertBirthday("u2", "Bob", "06-20");
    upsertBirthday("u3", "Carol", "07-04"); // different month

    const interaction = mockInteraction();

    await handleUpcoming(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("Alice"),
        ephemeral: true,
      })
    );
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("Bob"),
        ephemeral: true,
      })
    );
    // Carol should not appear
    const call = (interaction.reply as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(call.content).not.toContain("Carol");
    expect(call.content).toContain("June");
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
