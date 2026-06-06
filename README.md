# Discord Birthday Bot

Dank, meme-heavy birthday wishes for a private Discord server (~20 people). Runs on a Raspberry Pi, auto-deploys from GitHub.

## Features

- **Daily check at 7am** — posts a custom LLM-generated roast to `#announcements` on someone's birthday
- **Slash commands:**
  - `/birthday @user` — look up a birthday
  - `/birthdays` — list all stored birthdays
  - `/upcoming` — birthdays this month
  - `/set-birthday @user MM-DD` — add or update a birthday (self-set entries are locked)
  - `/set-traits @user trait1, trait2` — tag someone for the LLM to roast them with
  - `/missing` — list members without birthdays
- **Auto-scraped traits** — pulls roles, nicknames, and join dates from Discord profiles to feed the LLM
- **Monthly wish regeneration** — re-generates all birthday messages on the 1st of each month via DeepSeek API
- **Birthday locking** — self-set birthdays can only be changed by the owner or a server admin
- **Auto-deployment** — Pi polls GitHub every 5 min for new commits on `main`, pulls, builds, restarts

## Tech Stack

- [discord.js](https://discord.js.org/) v14 — Discord gateway + slash commands
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — zero-config local DB
- [node-cron](https://github.com/node-cron/node-cron) — daily scheduler
- [DeepSeek API](https://api-docs.deepseek.com/) — LLM for wish generation
- [Vitest](https://vitest.dev/) — test runner
- TypeScript, systemd

## Setup

### 1. Create a Discord bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications) → New Application
2. Go to **Bot** tab → Add Bot → copy the **Token**
3. Go to **OAuth2** → URL Generator:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Use Slash Commands`
   - Use the generated URL to invite the bot to your server
4. Enable **Gateway Intents** in the Bot tab: `Server Members Intent`

### 2. Get a DeepSeek API key

1. Sign up at [platform.deepseek.com](https://platform.deepseek.com/)
2. Create an API key

### 3. Clone and configure on the Pi

```bash
cd ~
git clone https://github.com/YOUR_USERNAME/discord-birthday-bot.git
cd discord-birthday-bot

# Create .env from template
cp .env.example .env
# Edit .env with your Discord + DeepSeek credentials
nano .env

npm ci
npm run build
```

### 4. Install systemd units

```bash
sudo cp scripts/birthday-bot.service /etc/systemd/system/
sudo cp scripts/birthday-bot-deploy.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now birthday-bot.service
sudo systemctl enable --now birthday-bot-deploy.timer
```

Check status:
```bash
sudo systemctl status birthday-bot
journalctl -u birthday-bot -f
```

### 5. Seed birthdays

Once the bot is online, use slash commands in Discord:
```
/set-birthday @yourself 03-14
```

## Environment Variables

| Variable | Description |
|---|---|
| `DISCORD_TOKEN` | Bot token from Discord Developer Portal |
| `DISCORD_APP_ID` | Application ID from General Information |
| `DISCORD_GUILD_ID` | Your server's ID (right-click server → Copy ID) |
| `ANNOUNCEMENTS_CHANNEL_ID` | Channel ID for birthday posts |
| `DEEPSEEK_API_KEY` | DeepSeek API key |

## Development

```bash
npm install
npm run dev       # tsx watch — hot reload
npm test          # vitest
npm run build     # tsc
```
