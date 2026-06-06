import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { findBlockedTrait } from "../src/lib/blocklist.js";

describe("findBlockedTrait", () => {
  it("returns null for clean traits", () => {
    expect(findBlockedTrait(["admin", "memelord", "chaos goblin"])).toBeNull();
  });

  it("blocks racial slurs", () => {
    expect(findBlockedTrait(["cool", "nigg"]))!.toContain("nigg");
    expect(findBlockedTrait(["the fagg"]))!.toContain("fagg");
  });

  it("is case insensitive", () => {
    expect(findBlockedTrait(["NiGgA"])).not.toBeNull();
  });

  it("allows regular swearwords", () => {
    expect(findBlockedTrait(["fuck", "shit", "asshole"])).toBeNull();
  });

  it("checks custom blocklist from env", () => {
    process.env["BOT_TRAIT_BLOCKLIST"] = "customslur,badword";
    expect(findBlockedTrait(["ok", "customslur"]))!.toContain("customslur");
    expect(findBlockedTrait(["ok", "badword"]))!.toContain("badword");
    delete process.env["BOT_TRAIT_BLOCKLIST"];
  });
});
