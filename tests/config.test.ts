import { describe, it, expect, beforeEach } from "vitest";
import { getDiscordConfig, getLLMConfig } from "../src/lib/config.js";

beforeEach(() => {
  delete process.env["DISCORD_TOKEN"];
  delete process.env["DISCORD_APP_ID"];
  delete process.env["DISCORD_GUILD_ID"];
  delete process.env["ANNOUNCEMENTS_CHANNEL_ID"];
  delete process.env["OPENROUTER_API_KEY"];
  delete process.env["OPENROUTER_MODEL"];
});

describe("getDiscordConfig", () => {
  it("returns config when all vars are set", () => {
    process.env["DISCORD_TOKEN"] = "tok";
    process.env["DISCORD_APP_ID"] = "123";
    process.env["DISCORD_GUILD_ID"] = "456";
    process.env["ANNOUNCEMENTS_CHANNEL_ID"] = "789";

    const config = getDiscordConfig();

    expect(config).toEqual({
      token: "tok",
      appId: "123",
      guildId: "456",
      announcementsChannelId: "789",
    });
  });

  it("throws when DISCORD_TOKEN is missing", () => {
    process.env["DISCORD_APP_ID"] = "123";
    process.env["DISCORD_GUILD_ID"] = "456";
    process.env["ANNOUNCEMENTS_CHANNEL_ID"] = "789";

    expect(() => getDiscordConfig()).toThrow("DISCORD_TOKEN");
  });

  it("throws when DISCORD_APP_ID is missing", () => {
    process.env["DISCORD_TOKEN"] = "tok";
    process.env["DISCORD_GUILD_ID"] = "456";
    process.env["ANNOUNCEMENTS_CHANNEL_ID"] = "789";

    expect(() => getDiscordConfig()).toThrow("DISCORD_APP_ID");
  });

  it("throws when DISCORD_GUILD_ID is missing", () => {
    process.env["DISCORD_TOKEN"] = "tok";
    process.env["DISCORD_APP_ID"] = "123";
    process.env["ANNOUNCEMENTS_CHANNEL_ID"] = "789";

    expect(() => getDiscordConfig()).toThrow("DISCORD_GUILD_ID");
  });

  it("throws when ANNOUNCEMENTS_CHANNEL_ID is missing", () => {
    process.env["DISCORD_TOKEN"] = "tok";
    process.env["DISCORD_APP_ID"] = "123";
    process.env["DISCORD_GUILD_ID"] = "456";

    expect(() => getDiscordConfig()).toThrow("ANNOUNCEMENTS_CHANNEL_ID");
  });
});

describe("getLLMConfig", () => {
  it("returns config with defaults when only key is set", () => {
    process.env["OPENROUTER_API_KEY"] = "sk-or-key";

    const config = getLLMConfig();

    expect(config).toEqual({
      apiKey: "sk-or-key",
      model: "deepseek/deepseek-v4.1-flash",
    });
  });

  it("returns custom model when set", () => {
    process.env["OPENROUTER_API_KEY"] = "sk-or-key";
    process.env["OPENROUTER_MODEL"] = "deepseek/deepseek-chat";

    const config = getLLMConfig();

    expect(config).toEqual({
      apiKey: "sk-or-key",
      model: "deepseek/deepseek-chat",
    });
  });

  it("throws when OPENROUTER_API_KEY is missing", () => {
    expect(() => getLLMConfig()).toThrow("OPENROUTER_API_KEY");
  });
});
