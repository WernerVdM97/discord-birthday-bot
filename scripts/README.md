# Scripts

## Seed script

| Script | Input | Usage |
|---|---|---|
| `seed.ts` | `seed.json` (Discord snowflakes) | `npx tsx scripts/seed.ts` — manual IDs, no matching |
| `seed-csv.ts` | `seed.csv` (username,MM-DD) | `npx tsx scripts/seed-csv.ts` — spreadsheet-friendly, auto-matches display names |

Requires the bot to be stopped first:
```bash
sudo systemctl stop birthday-bot
npx tsx scripts/seed.ts
sudo systemctl start birthday-bot
```

Copy the example file to get started:
```bash
cp scripts/seed.example.json scripts/seed.json
# Edit seed.json with real user IDs
```

## Systemd units

| File | Purpose |
|---|---|
| `birthday-bot.service` | Runs the bot as a daemon. Restarts on crash. |
| `birthday-bot-deploy.service` | Oneshot service that runs `deploy-check.sh`. Triggered by the timer. |
| `birthday-bot-deploy.timer` | Fires every 5 minutes to check for GitHub updates. |

Install:
```bash
sudo cp scripts/birthday-bot*.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now birthday-bot.service birthday-bot-deploy.timer
```

## Deploy

| Script | What it does |
|---|---|
| `deploy-check.sh` | `git fetch` → new commits? → `git pull` → `npm ci` → `npm run build` → `systemctl restart` |
