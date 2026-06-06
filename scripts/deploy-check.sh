#!/usr/bin/env bash
# deploy-check.sh — run by systemd timer every N minutes.
# Fetches origin/main, compares to local HEAD, and restarts the
# bot service if there's a new commit.

set -euo pipefail

PROJECT_DIR="/root/discord-birthday-bot"
SERVICE_NAME="birthday-bot"

cd "$PROJECT_DIR"

# Ensure we're on main and no local changes would interfere
git checkout main
git fetch origin

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    exit 0
fi

echo "[deploy] New commit detected: ${REMOTE:0:7}"
echo "[deploy] Pulling..."
git pull origin main

echo "[deploy] Installing dependencies..."
npm ci --production=false

echo "[deploy] Building..."
npm run build

echo "[deploy] Restarting bot..."
systemctl restart "$SERVICE_NAME"

echo "[deploy] Done — now running ${REMOTE:0:7}"
