# Discord Birthday Bot

Dank, meme-heavy birthday wishes for a private Discord server (~20 people). Runs on a Raspberry Pi, auto-deploys from GitHub.

## Features

- **Daily check at 7am** — posts a custom LLM-generated roast to `#announcements` on someone's birthday
- **Slash commands:**
  - `/birthday @user` — look up a birthday
  - `/list` — all birthdays grouped by month (🔒 = locked)
  - `/upcoming` — birthdays this month
  - `/set-birthday @user MM-DD` — add or update a birthday (self-set entries are locked)
  - `/set-traits @user trait1, trait2` — tag someone for the LLM to roast them with
  - `/missing` — list members without birthdays (role-gated when configured)
  - `/test-birthday @user` — preview a wish without posting (bot owner only)
  - `/trigger` — manually run the daily birthday check (bot owner only)
  - `/update` — git pull + rebuild + restart (bot owner only)
  - `/help` — show all commands (also reply to any DM)
- **Auto-scraped traits** — pulls roles, nicknames, and join dates from Discord profiles to feed the LLM
- **Monthly wish regeneration** — re-generates all birthday messages on the 1st of each month via DeepSeek API
- **Birthday locking** — self-set birthdays can only be changed by the owner, a server admin, or the bot admin
- **Role-based access** — restrict writing commands (`/set-birthday`, `/set-traits`, `/missing`) to specific Discord roles via `BOT_ADMIN_ROLE_ID` and `BOT_MEMBER_ROLE_ID`
- **Admin notifications** — DM on startup (with commit hash) and on unhandled errors when `BOT_ADMIN_ID` is set
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
4. Enable **Server Members Intent** in the Bot tab (for trait scraping). DMs work by default — no extra toggle needed.

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
sudo cp scripts/birthday-bot-deploy.service /etc/systemd/system/
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

### 5. Seed the initial birthday list

Copy the example file, edit with real Discord user IDs, and run:
```bash
cp scripts/seed.example.json scripts/seed.json
nano scripts/seed.json       # replace placeholder snowflakes, set locked: true for self-set
npx tsx scripts/seed.ts
```

Or add one at a time with slash commands once the bot is online:
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
| `BOT_ADMIN_ID` | (Optional) Your Discord user ID — gets DM notifications on startup/errors + can override locked birthdays |
| `BOT_ADMIN_ROLE_ID` | (Optional) Discord role ID for admins — can set any birthday and override locks |
| `BOT_MEMBER_ROLE_ID` | (Optional) Discord role ID for members — can set their own birthday and traits |
| `DEEPSEEK_API_KEY` | DeepSeek API key |
| `CRON_SCHEDULE` | (Optional) Cron expression for the daily check — defaults to `0 7 * * *` (7am) |

> **Getting role IDs:** Enable Developer Mode in Discord (Settings → Advanced). Then go to Server Settings → Roles → right-click the role → Copy ID.
>
> If no role IDs are set, all commands are open to everyone (backwards compatible). When set, read-only commands stay public but write commands require at least the member role.

## Development

```bash
npm install
npm run dev       # tsx watch — hot reload
npm test          # vitest
npm run build     # tsc
```
