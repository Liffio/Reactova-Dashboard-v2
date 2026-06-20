#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/reactova-dashboard"
LOG_TAG="[deploy]"

echo "$LOG_TAG $(date '+%Y-%m-%d %H:%M:%S') Starting deployment"

cd "$APP_DIR"

# ── 1. Pull latest code ──────────────────────────────────────────────────────
echo "$LOG_TAG Pulling latest code from origin/main"
git fetch origin main
git reset --hard origin/main

# ── 2. Restore .env (GitHub Actions writes it to /tmp/.env.deploy) ──────────
if [ -f /tmp/.env.deploy ]; then
  echo "$LOG_TAG Restoring .env from deploy secret"
  cp /tmp/.env.deploy "$APP_DIR/.env"
  rm -f /tmp/.env.deploy
else
  echo "$LOG_TAG No /tmp/.env.deploy found — using existing .env on server"
fi

# ── 3. Install dependencies ──────────────────────────────────────────────────
echo "$LOG_TAG Installing dependencies"
npm ci --prefer-offline 2>&1 | tail -5

# ── 4. Build ─────────────────────────────────────────────────────────────────
echo "$LOG_TAG Building application"
npm run build

# ── 5. Reload PM2 (zero-downtime reload, falls back to start) ────────────────
echo "$LOG_TAG Reloading PM2 process"
if pm2 id liffio-dashboard | grep -qv '\[\]'; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save

echo "$LOG_TAG $(date '+%Y-%m-%d %H:%M:%S') Deployment complete ✓"
