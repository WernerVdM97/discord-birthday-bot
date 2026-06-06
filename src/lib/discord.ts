import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";
import { getDiscordConfig } from "./config.js";

export function createClient(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.DirectMessages,
    ],
  });

  client.once("ready", () => {
    console.log(`Logged in as ${client.user?.tag ?? "unknown"}`);
  });

  return client;
}

export async function loginClient(client: Client): Promise<void> {
  const { token } = getDiscordConfig();
  await client.login(token);
}

export async function registerCommands(client: Client): Promise<void> {
  const { token, appId, guildId } = getDiscordConfig();

  const commands = [
    new SlashCommandBuilder()
      .setName("birthday")
      .setDescription("Get a user's birthday")
      .addUserOption((opt) =>
        opt
          .setName("user")
          .setDescription("The user to look up")
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("birthdays")
      .setDescription("List all stored birthdays"),
    new SlashCommandBuilder()
      .setName("upcoming")
      .setDescription("List birthdays in the current month"),
    new SlashCommandBuilder()
      .setName("set-birthday")
      .setDescription("Add or update a birthday")
      .addUserOption((opt) =>
        opt
          .setName("user")
          .setDescription("The user")
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("date")
          .setDescription("Birthday in MM-DD format (e.g. 03-14)")
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("set-traits")
      .setDescription("Add trait tags for a user (replaces any previous manual traits)")
      .addUserOption((opt) =>
        opt
          .setName("user")
          .setDescription("The user")
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("traits")
          .setDescription("Comma-separated traits (e.g. admin,meme lord)")
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("missing")
      .setDescription("List server members whose birthdays haven't been set"),
    new SlashCommandBuilder()
      .setName("help")
      .setDescription("Show all available commands"),
  ];

  const rest = new REST({ version: "10" }).setToken(token);

  console.log("Registering slash commands...");
  await rest.put(Routes.applicationGuildCommands(appId, guildId), {
    body: commands,
  });
  console.log(`Registered ${commands.length} slash commands`);
}
