import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  initDb,
  getBirthday,
  getAllBirthdays,
  getUpcomingBirthdays,
  upsertBirthday,
  isBirthdayLocked,
  getTraits,
  getTraitsForUsers,
  addTrait,
  clearManualTraits,
  getWishCache,
  setWishCache,
} from "../src/lib/db.js";

let counter = 0;

function setupDb(): void {
  counter++;
  // Each test gets its own DB by using a unique temp file, then deleting it.
  // Plain :memory: is per-connection, but initDb replaces module-level `db`,
  // and multiple calls to new Database(":memory:") always create fresh DBs.
  initDb(":memory:");
}

beforeEach(setupDb);

describe("birthdays", () => {
  it("returns undefined for unknown user", () => {
    expect(getBirthday("u1")).toBeUndefined();
  });

  it("upserts and retrieves a birthday", () => {
    upsertBirthday("u1", "Alice", "03-14");
    const entry = getBirthday("u1");
    expect(entry).toMatchObject({
      userId: "u1",
      username: "Alice",
      birthday: "03-14",
    });
    expect(entry!.updatedAt).toBeTruthy();
  });

  it("upsert updates existing birthday", () => {
    upsertBirthday("u1", "Alice", "03-14");
    upsertBirthday("u1", "Alice2", "05-20");
    const entry = getBirthday("u1");
    expect(entry!.username).toBe("Alice2");
    expect(entry!.birthday).toBe("05-20");
  });

  it("getAllBirthdays returns sorted by birthday", () => {
    upsertBirthday("u2", "Bob", "12-25");
    upsertBirthday("u1", "Alice", "01-01");
    const all = getAllBirthdays();
    expect(all).toHaveLength(2);
    expect(all[0].birthday).toBe("01-01");
    expect(all[1].birthday).toBe("12-25");
  });

  it("getUpcomingBirthdays filters by month", () => {
    upsertBirthday("u1", "Alice", "03-14");
    upsertBirthday("u2", "Bob", "03-02");
    upsertBirthday("u3", "Carol", "04-10");

    const march = getUpcomingBirthdays(3);
    expect(march).toHaveLength(2);
    expect(march[0].birthday).toBe("03-02");
    expect(march[1].birthday).toBe("03-14");

    const april = getUpcomingBirthdays(4);
    expect(april).toHaveLength(1);
    expect(april[0].username).toBe("Carol");
  });

  it("getUpcomingBirthdays returns empty for month with no birthdays", () => {
    expect(getUpcomingBirthdays(7)).toHaveLength(0);
  });

  it("is not locked by default", () => {
    upsertBirthday("u1", "Alice", "03-14");
    expect(isBirthdayLocked("u1")).toBe(false);
  });

  it("stores locked flag", () => {
    upsertBirthday("u1", "Alice", "03-14", true);
    expect(isBirthdayLocked("u1")).toBe(true);
    const entry = getBirthday("u1");
    expect(entry!.locked).toBe(true);
  });

  it("upsert can change lock state", () => {
    upsertBirthday("u1", "Alice", "03-14", false);
    upsertBirthday("u1", "Alice", "03-14", true);
    expect(isBirthdayLocked("u1")).toBe(true);
  });

  it("isBirthdayLocked returns false for unknown user", () => {
    expect(isBirthdayLocked("nonexistent")).toBe(false);
  });
});

describe("traits", () => {
  it("returns empty array for unknown user", () => {
    expect(getTraits("u1")).toEqual([]);
  });

  it("adds and retrieves traits", () => {
    addTrait("u1", "admin", "scraped");
    addTrait("u1", "memelord", "manual");
    const traits = getTraits("u1");
    expect(traits).toHaveLength(2);
    expect(traits).toContainEqual({
      userId: "u1",
      trait: "admin",
      source: "scraped",
    });
    expect(traits).toContainEqual({
      userId: "u1",
      trait: "memelord",
      source: "manual",
    });
  });

  it("addTrait ignores duplicate", () => {
    addTrait("u1", "admin", "scraped");
    addTrait("u1", "admin", "manual");
    expect(getTraits("u1")).toHaveLength(1);
    // first insert wins (scraped), manual ignored
    expect(getTraits("u1")[0].source).toBe("scraped");
  });

  it("clearManualTraits only removes manual", () => {
    addTrait("u1", "admin", "scraped");
    addTrait("u1", "memelord", "manual");
    addTrait("u1", "chaos", "manual");

    clearManualTraits("u1");
    const traits = getTraits("u1");
    expect(traits).toHaveLength(1);
    expect(traits[0].trait).toBe("admin");
    expect(traits[0].source).toBe("scraped");
  });

  it("getTraitsForUsers returns map of traits", () => {
    addTrait("u1", "admin", "scraped");
    addTrait("u1", "memelord", "manual");
    addTrait("u2", "newbie", "scraped");

    const map = getTraitsForUsers(["u1", "u2", "u3"]);
    expect(map.get("u1")).toEqual(["admin", "memelord"]);
    expect(map.get("u2")).toEqual(["newbie"]);
    expect(map.get("u3")).toBeUndefined();
  });

  it("getTraitsForUsers with empty array returns empty map", () => {
    expect(getTraitsForUsers([]).size).toBe(0);
  });
});

describe("wish_cache", () => {
  it("returns undefined for uncached user", () => {
    expect(getWishCache("u1", 2026)).toBeUndefined();
  });

  it("sets and retrieves cached wish", () => {
    setWishCache("u1", "happy bday Alice!", 2026);
    const cached = getWishCache("u1", 2026);
    expect(cached).toMatchObject({
      userId: "u1",
      wish: "happy bday Alice!",
      year: 2026,
    });
    expect(cached!.generatedAt).toBeTruthy();
  });

  it("upserts wish cache", () => {
    setWishCache("u1", "v1", 2026);
    setWishCache("u1", "v2", 2026);
    expect(getWishCache("u1", 2026)!.wish).toBe("v2");
  });

  it("returns undefined for wrong year", () => {
    setWishCache("u1", "wish", 2026);
    expect(getWishCache("u1", 2025)).toBeUndefined();
  });
});
