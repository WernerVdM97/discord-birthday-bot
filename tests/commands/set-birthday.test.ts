import { describe, it, expect, beforeEach } from "vitest";
import { handleSetBirthday } from "../../src/commands/set-birthday.js";
import { initDb, getBirthday, isBirthdayLocked } from "../../src/lib/db.js";
import { mockInteraction } from "./helpers.js";

beforeEach(() => {
  process.env["DISCORD_TOKEN"] = "mock";
  process.env["DISCORD_APP_ID"] = "mock";
  process.env["DISCORD_GUILD_ID"] = "mock";
  process.env["ANNOUNCEMENTS_CHANNEL_ID"] = "mock";
  delete process.env["BOT_ADMIN_ID"];
  initDb(":memory:");
});

describe("handleSetBirthday", () => {
  it("stores a valid birthday and confirms", async () => {
    const interaction = mockInteraction({
      user: { id: "u1", displayName: "Alice" },
      date: "03-14",
    });

    await handleSetBirthday(interaction);

    const stored = getBirthday("u1");
    expect(stored).toBeDefined();
    expect(stored!.birthday).toBe("03-14");
    expect(stored!.username).toBe("Alice");

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("03-14"),
        ephemeral: true,
      })
    );
  });

  it("rejects invalid date format", async () => {
    const interaction = mockInteraction({
      date: "3-14",
    });

    await handleSetBirthday(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("MM-DD"),
        ephemeral: true,
      })
    );

    // Should not have stored anything
    expect(getBirthday("u1")).toBeUndefined();
  });

  it("rejects non-numeric date", async () => {
    const interaction = mockInteraction({
      date: "ab-cd",
    });

    await handleSetBirthday(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("MM-DD"),
        ephemeral: true,
      })
    );
  });

  it("rejects out-of-range month", async () => {
    const interaction = mockInteraction({
      date: "13-01",
    });

    await handleSetBirthday(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("01-12"),
        ephemeral: true,
      })
    );
  });

  it("rejects out-of-range day", async () => {
    const interaction = mockInteraction({
      date: "02-99",
    });

    await handleSetBirthday(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("01-31"),
        ephemeral: true,
      })
    );
  });

  it("upserts an existing birthday", async () => {
    // Store initial
    const first = mockInteraction({
      user: { id: "u1", displayName: "Alice" },
      date: "03-14",
    });
    await handleSetBirthday(first);

    // Update
    const second = mockInteraction({
      user: { id: "u1", displayName: "Alice2" },
      date: "05-20",
    });
    await handleSetBirthday(second);

    const stored = getBirthday("u1");
    expect(stored!.birthday).toBe("05-20");
    expect(stored!.username).toBe("Alice2");
  });

  it("locks when user sets their own birthday", async () => {
    const interaction = mockInteraction({
      callerId: "u1",
      user: { id: "u1", displayName: "Alice" },
      date: "03-14",
    });

    await handleSetBirthday(interaction);

    expect(isBirthdayLocked("u1")).toBe(true);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("🔒"),
      })
    );
  });

  it("does not lock when someone else sets your birthday", async () => {
    const interaction = mockInteraction({
      callerId: "caller-1",
      user: { id: "u1", displayName: "Alice" },
      date: "03-14",
    });

    await handleSetBirthday(interaction);

    expect(isBirthdayLocked("u1")).toBe(false);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.not.stringContaining("🔒"),
      })
    );
  });

  it("rejects changes to a locked birthday from someone else", async () => {
    // Alice sets her own birthday → locked
    await handleSetBirthday(
      mockInteraction({
        callerId: "u1",
        user: { id: "u1", displayName: "Alice" },
        date: "03-14",
      })
    );

    // Bob tries to change it
    const bobTry = mockInteraction({
      callerId: "u2",
      user: { id: "u1", displayName: "Alice" },
      date: "05-20",
    });
    await handleSetBirthday(bobTry);

    expect(bobTry.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("locked"),
      })
    );

    // Alice's birthday should be unchanged
    expect(getBirthday("u1")!.birthday).toBe("03-14");
  });

  it("allows the owner to update their own locked birthday", async () => {
    // Alice sets her own → locked
    await handleSetBirthday(
      mockInteraction({
        callerId: "u1",
        user: { id: "u1", displayName: "Alice" },
        date: "03-14",
      })
    );

    // Alice changes her own birthday
    const update = mockInteraction({
      callerId: "u1",
      user: { id: "u1", displayName: "Alice" },
      date: "05-20",
    });
    await handleSetBirthday(update);

    expect(getBirthday("u1")!.birthday).toBe("05-20");
    expect(isBirthdayLocked("u1")).toBe(true); // stays locked
  });

  it("allows an admin to override a locked birthday", async () => {
    // Alice sets her own → locked
    await handleSetBirthday(
      mockInteraction({
        callerId: "u1",
        user: { id: "u1", displayName: "Alice" },
        date: "03-14",
      })
    );

    // Admin changes it
    const adminUpdate = mockInteraction({
      callerId: "admin-1",
      isAdmin: true,
      user: { id: "u1", displayName: "Alice" },
      date: "12-25",
    });
    await handleSetBirthday(adminUpdate);

    // Admin override works — not locked since admin didn't set for themselves
    expect(getBirthday("u1")!.birthday).toBe("12-25");
  });

  it("still rejects non-admin override of locked birthday", async () => {
    // Alice sets her own → locked
    await handleSetBirthday(
      mockInteraction({
        callerId: "u1",
        user: { id: "u1", displayName: "Alice" },
        date: "03-14",
      })
    );

    // Random user (not admin) tries to change it
    const randUpdate = mockInteraction({
      callerId: "u2",
      isAdmin: false,
      user: { id: "u1", displayName: "Alice" },
      date: "05-20",
    });
    await handleSetBirthday(randUpdate);

    expect(randUpdate.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("locked"),
      })
    );
    expect(getBirthday("u1")!.birthday).toBe("03-14");
  });

  it("allows the bot admin to override a locked birthday", async () => {
    process.env["BOT_ADMIN_ID"] = "admin-1";

    // Alice sets her own → locked
    await handleSetBirthday(
      mockInteraction({
        callerId: "u1",
        user: { id: "u1", displayName: "Alice" },
        date: "03-14",
      })
    );

    // Bot admin changes it (no server admin perms, just the env var)
    const adminUpdate = mockInteraction({
      callerId: "admin-1",
      isAdmin: false,
      user: { id: "u1", displayName: "Alice" },
      date: "09-09",
    });
    await handleSetBirthday(adminUpdate);

    expect(getBirthday("u1")!.birthday).toBe("09-09");
  });
});
