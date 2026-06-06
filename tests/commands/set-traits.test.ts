import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { handleSetTraits } from "../../src/commands/set-traits.js";
import { initDb, getTraits } from "../../src/lib/db.js";
import { mockInteraction } from "./helpers.js";

beforeEach(() => {
  initDb(":memory:");
});

describe("handleSetTraits", () => {
  it("stores manual traits and confirms", async () => {
    const interaction = mockInteraction({
      user: { id: "u1", displayName: "Alice" },
      traits: "admin, memelord",
    });

    await handleSetTraits(interaction);

    const traits = getTraits("u1");
    const manual = traits.filter((t) => t.source === "manual");
    expect(manual).toHaveLength(2);
    expect(manual.map((t) => t.trait)).toContain("admin");
    expect(manual.map((t) => t.trait)).toContain("memelord");

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("admin, memelord"),
        ephemeral: true,
      })
    );
  });

  it("replaces existing manual traits", async () => {
    // Set initial traits
    const first = mockInteraction({
      user: { id: "u1", displayName: "Alice" },
      traits: "admin, memelord",
    });
    await handleSetTraits(first);

    // Replace
    const second = mockInteraction({
      user: { id: "u1", displayName: "Alice" },
      traits: "chaos, gremlin",
    });
    await handleSetTraits(second);

    const manual = getTraits("u1").filter((t) => t.source === "manual");
    expect(manual).toHaveLength(2);
    expect(manual.map((t) => t.trait)).toEqual(["chaos", "gremlin"]);
  });

  it("trims whitespace around traits", async () => {
    const interaction = mockInteraction({
      traits: "  admin ,  memelord  ",
    });

    await handleSetTraits(interaction);

    const manual = getTraits("u1").filter((t) => t.source === "manual");
    expect(manual.map((t) => t.trait)).toEqual(["admin", "memelord"]);
  });

  it("rejects empty traits string", async () => {
    const interaction = mockInteraction({
      traits: "",
    });

    await handleSetTraits(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("at least one trait"),
        ephemeral: true,
      })
    );
  });

  it("rejects blocked traits", async () => {
    const interaction = mockInteraction({
      traits: "admin, nigg",
    });

    await handleSetTraits(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("not allowed"),
        ephemeral: true,
      })
    );
  });
});

describe("handleSetTraits with role gate", () => {
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
      traits: "admin, memelord",
    });

    await handleSetTraits(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("permission"),
      })
    );
  });

  it("allows admin role to set traits", async () => {
    const interaction = mockInteraction({
      roleIds: ["role-admin"],
      traits: "admin, memelord",
    });

    await handleSetTraits(interaction);

    const manual = getTraits("u1").filter((t) => t.source === "manual");
    expect(manual).toHaveLength(2);
  });

  it("rejects member role from replacing traits", async () => {
    const interaction = mockInteraction({
      roleIds: ["role-member"],
      traits: "admin, memelord",
    });

    await handleSetTraits(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining("permission"),
      })
    );
  });
});
