import { describe, it, expect, beforeEach } from "vitest";
import { handleBirthday } from "../../src/commands/birthday.js";
import { initDb, upsertBirthday } from "../../src/lib/db.js";
import { mockInteraction } from "./helpers.js";

beforeEach(() => {
  initDb(":memory:");
});

describe("handleBirthday", () => {
  it("returns birthday for known user", async () => {
    upsertBirthday("u1", "Alice", "03-14");

    const interaction = mockInteraction({
      user: { id: "u1", displayName: "Alice" },
    });

    await handleBirthday(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("03-14"),
        ephemeral: true,
      })
    );
  });

  it("returns not-found message for unknown user", async () => {
    const interaction = mockInteraction({
      user: { id: "u1", displayName: "Alice" },
    });

    await handleBirthday(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("No birthday on file"),
        ephemeral: true,
      })
    );
  });
});
