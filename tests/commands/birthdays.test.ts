import { describe, it, expect, beforeEach } from "vitest";
import { handleBirthdays } from "../../src/commands/birthdays.js";
import { initDb, upsertBirthday } from "../../src/lib/db.js";
import { mockInteraction } from "./helpers.js";

beforeEach(() => {
  initDb(":memory:");
});

describe("handleBirthdays", () => {
  it("lists all birthdays", async () => {
    upsertBirthday("u1", "Alice", "03-14");
    upsertBirthday("u2", "Bob", "12-25");

    const interaction = mockInteraction();

    await handleBirthdays(interaction);

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
  });

  it("returns empty message when no birthdays", async () => {
    const interaction = mockInteraction();

    await handleBirthdays(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "No birthdays stored yet.",
        ephemeral: true,
      })
    );
  });
});
