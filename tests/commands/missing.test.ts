import { describe, it, expect, beforeEach, vi } from "vitest";
import { handleMissing } from "../../src/commands/missing.js";
import { initDb, upsertBirthday } from "../../src/lib/db.js";
import { mockInteraction } from "./helpers.js";

beforeEach(() => {
  initDb(":memory:");
});

describe("handleMissing", () => {
  it("lists members without birthdays", async () => {
    const fetchMock = vi.fn().mockResolvedValue(undefined);
    const membersCache = new Map([
      ["u1", { id: "u1", displayName: "Alice", user: { bot: false } }],
      ["u2", { id: "u2", displayName: "Bob", user: { bot: false } }],
      ["u3", { id: "u3", displayName: "Carol", user: { bot: false } }],
      ["bot", { id: "bot", displayName: "Botty", user: { bot: true } }],
    ]);

    const guild = {
      members: { fetch: fetchMock, cache: membersCache },
    };

    // Only Alice has a birthday stored
    upsertBirthday("u1", "Alice", "03-14");

    const interaction = mockInteraction({ guild: guild as unknown as Record<string, unknown> });

    await handleMissing(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("2 member(s) missing"),
      })
    );
    const call = (interaction.reply as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.content).toContain("Bob");
    expect(call.content).toContain("Carol");
    expect(call.content).not.toContain("Alice");
    expect(call.content).not.toContain("Botty");
  });

  it("shows celebration when all birthdays are set", async () => {
    const fetchMock = vi.fn().mockResolvedValue(undefined);
    const membersCache = new Map([
      ["u1", { id: "u1", displayName: "Alice", user: { bot: false } }],
    ]);

    const guild = {
      members: { fetch: fetchMock, cache: membersCache },
    };

    upsertBirthday("u1", "Alice", "03-14");

    const interaction = mockInteraction({ guild: guild as unknown as Record<string, unknown> });

    await handleMissing(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("🎉"),
      })
    );
  });

  it("rejects when not in a guild", async () => {
    const interaction = mockInteraction({ guild: null });

    await handleMissing(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("server"),
      })
    );
  });
});
