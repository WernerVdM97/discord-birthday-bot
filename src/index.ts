import { createClient, loginClient, registerCommands } from "./lib/discord.js";
import { initDb } from "./lib/db.js";
import { scrapeAllMembers } from "./lib/scraper.js";
import { startScheduler } from "./scheduler/daily-check.js";
import { handleSetBirthday } from "./commands/set-birthday.js";
import { handleSetTraits } from "./commands/set-traits.js";
import { handleBirthday } from "./commands/birthday.js";
import { handleBirthdays } from "./commands/birthdays.js";
import { handleUpcoming } from "./commands/upcoming.js";
import { handleMissing } from "./commands/missing.js";
import type { ChatInputCommandInteraction } from "discord.js";

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
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "Something went wrong. Try again later.",
          ephemeral: true,
        });
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
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
