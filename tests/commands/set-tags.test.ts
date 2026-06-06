import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { handleSetTags } from "../../src/commands/set-tags.js";
import { initDb, getTags } from "../../src/lib/db.js";
import { mockInteraction } from "./helpers.js";

beforeEach(() => {
  initDb(":memory:");
});

describe("handleSetTags", () => {
  it("stores manual tags and confirms", async () => {
    const interaction = mockInteraction({
      user: { id: "u1", displayName: "Alice" },
      tags: "admin, memelord",
    });

    await handleSetTags(interaction);

    const tags = getTags("u1");
    const manual = tags.filter((t) => t.source === "manual");
    expect(manual).toHaveLength(2);
    expect(manual.map((t) => t.tag)).toContain("admin");
    expect(manual.map((t) => t.tag)).toContain("memelord");

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("admin, memelord"),
        ephemeral: true,
      })
    );
  });

  it("replaces existing manual tags", async () => {
    // Set initial tags
    const first = mockInteraction({
      user: { id: "u1", displayName: "Alice" },
      tags: "admin, memelord",
    });
    await handleSetTags(first);

    // Replace
    const second = mockInteraction({
      user: { id: "u1", displayName: "Alice" },
      tags: "chaos, gremlin",
    });
    await handleSetTags(second);

    const manual = getTags("u1").filter((t) => t.source === "manual");
    expect(manual).toHaveLength(2);
    expect(manual.map((t) => t.tag)).toEqual(["chaos", "gremlin"]);
  });

  it("trims whitespace around tags", async () => {
    const interaction = mockInteraction({
      tags: "  admin ,  memelord  ",
    });

    await handleSetTags(interaction);

    const manual = getTags("u1").filter((t) => t.source === "manual");
    expect(manual.map((t) => t.tag)).toEqual(["admin", "memelord"]);
  });

  it("rejects empty tags string", async () => {
    const interaction = mockInteraction({
      tags: "",
    });

    await handleSetTags(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("at least one tag"),
        ephemeral: true,
      })
    );
  });

  it("rejects blocked tags", async () => {
    const interaction = mockInteraction({
      tags: "admin, nigg",
    });

    await handleSetTags(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("not allowed"),
        ephemeral: true,
      })
    );
  });
});

describe("handleSetTags with role gate", () => {
  beforeEach(() => {
    process.env["BOT_ADMIN_ROLE_ID"] = "role-admin";
    process.env["BOT_MEMBER_ROLE_ID"] = "role-member";
  });

  afterEach(() => {
    delete process.env["BOT_ADMIN_ROLE_ID"];
    delete process.env["BOT_MEMBER_ROLE_ID"];
  });

  it("rejects users without a role", async () => {
    const interaction = mockInteraction({
      tags: "admin, memelord",
    });

    await handleSetTags(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("permission"),
      })
    );
  });

  it("allows admin role to set tags", async () => {
    const interaction = mockInteraction({
      roleIds: ["role-admin"],
      tags: "admin, memelord",
    });

    await handleSetTags(interaction);

    const manual = getTags("u1").filter((t) => t.source === "manual");
    expect(manual).toHaveLength(2);
  });

  it("rejects member role from replacing tags", async () => {
    const interaction = mockInteraction({
      roleIds: ["role-member"],
      tags: "admin, memelord",
    });

    await handleSetTags(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("permission"),
      })
    );
  });
});
