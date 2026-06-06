import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { findBlockedTag } from "../src/lib/blocklist.js";

describe("findBlockedTag", () => {
  it("returns null for clean tags", () => {
    expect(findBlockedTag(["admin", "memelord", "chaos goblin"])).toBeNull();
  });

  it("blocks racial slurs", () => {
    expect(findBlockedTag(["cool", "nigg"]))!.toContain("nigg");
    expect(findBlockedTag(["the fagg"]))!.toContain("fagg");
  });

  it("is case insensitive", () => {
    expect(findBlockedTag(["NiGgA"])).not.toBeNull();
  });

  it("allows regular swearwords", () => {
    expect(findBlockedTag(["fuck", "shit", "asshole"])).toBeNull();
  });

  it("checks custom blocklist from env", () => {
    process.env["BOT_TAG_BLOCKLIST"] = "customslur,badword";
    expect(findBlockedTag(["ok", "customslur"]))!.toContain("customslur");
    expect(findBlockedTag(["ok", "badword"]))!.toContain("badword");
    delete process.env["BOT_TAG_BLOCKLIST"];
  });
});
