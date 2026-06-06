import { createClient, loginClient, registerCommands } from "./lib/discord.js";
import { initDb } from "./lib/db.js";
import { scrapeAllMembers } from "./lib/scraper.js";
import { startScheduler } from "./scheduler/daily-check.js";
import { notifyAdmin } from "./lib/notify.js";
import { handleSetBirthday } from "./commands/set-birthday.js";
import { handleSetTraits } from "./commands/set-traits.js";
import { handleBirthday } from "./commands/birthday.js";
import { handleBirthdays } from "./commands/birthdays.js";
import { handleUpcoming } from "./commands/upcoming.js";
import { handleMissing } from "./commands/missing.js";
import { HELP_TEXT } from "./commands/help.js";
import type { ChatInputCommandInteraction } from "discord.js";
import { readFileSync } from "node:fs";

function getCommitHash(): string {
  try {
    return readFileSync("dist/commit.txt", "utf-8").trim();
  } catch {
    return "unknown";
  }
}

async function main(): Promise<void> {
  console.log("Birthday bot starting...");

  // Initialize database
  initDb("data/birthdays.db");
  console.log("Database initialized");

  // Create and login
  const client = createClient();

  // Register slash command handlers
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const handlers: Record<
      string,
      (i: ChatInputCommandInteraction) => Promise<void>
    > = {
      "set-birthday": handleSetBirthday,
      "set-traits": handleSetTraits,
      birthday: handleBirthday,
      birthdays: handleBirthdays,
      upcoming: handleUpcoming,
      missing: handleMissing,
      help: async (i) => {
        await i.reply({ content: HELP_TEXT, ephemeral: true });
      },
    };

    const handler = handlers[interaction.commandName];
    if (!handler) {
      await interaction.reply({
        content: "Unknown command.",
        ephemeral: true,
      });
      return;
    }

    try {
      await handler(interaction);
    } catch (err) {
      console.error(
        `Error handling /${interaction.commandName}:`,
        err
      );

      // Notify admin of the failure
      notifyAdmin(
        client,
        `⚠️ Error in /${interaction.commandName}: ${String(err).slice(0, 300)}`
      ).catch(() => {}); // fire-and-forget

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "Something went wrong. Try again later.",
          ephemeral: true,
        });
      }
    }
  });

  // DM auto-responder: reply with command list when messaged directly
  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.guild) {
      // DM — not in a server
      try {
        await message.reply(HELP_TEXT);
      } catch {
        // User might have DMs disabled
      }
    }
  });

  await loginClient(client);

  // Register slash commands with Discord
  await registerCommands(client);

  // Scrape initial traits
  console.log("Scraping member profiles for traits...");
  await scrapeAllMembers(client);

  // Start scheduler (daily check + monthly regeneration)
  startScheduler(client);

  console.log("Birthday bot is ready!");

  // Notify admin on startup
  const commit = getCommitHash();
  await notifyAdmin(
    client,
    `🟢 Birthday bot online — commit \`${commit}\``
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
