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

if [ ! -f "$APP_DIR/dist/server/server.js" ] || [ -z "$(ls -A "$APP_DIR/dist/client/assets" 2>/dev/null)" ]; then
  echo "$LOG_TAG Build output missing (dist/server/server.js or dist/client/assets empty) — aborting"
  exit 1
fi

# ── 5. Reload PM2 (zero-downtime reload, falls back to start) ────────────────
echo "$LOG_TAG Reloading PM2 process"

PRE_UPTIME=$(pm2 jlist | jq -r '.[] | select(.name=="liffio-dashboard") | .pm2_env.pm_uptime // empty')

if pm2 jlist | jq -e '.[] | select(.name=="liffio-dashboard")' > /dev/null; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save

# ── 6. Verify the reload actually took effect ────────────────────────────────
# pm2 reload can exit 0 without actually replacing the worker (e.g. if it silently
# no-ops). Confirm the process is online AND its pm_uptime moved forward, so a
# stale build (old JS/CSS hashes still loaded in memory) never lingers behind
# freshly built (and old-file-deleting) assets on disk.
echo "$LOG_TAG Verifying PM2 picked up the new build"
sleep 2
POST_STATUS=$(pm2 jlist | jq -r '.[] | select(.name=="liffio-dashboard") | .pm2_env.status // empty')
POST_UPTIME=$(pm2 jlist | jq -r '.[] | select(.name=="liffio-dashboard") | .pm2_env.pm_uptime // empty')

if [ "$POST_STATUS" != "online" ]; then
  echo "$LOG_TAG PM2 process is not online (status=$POST_STATUS) — deploy failed"
  pm2 logs liffio-dashboard --lines 30 --nostream
  exit 1
fi

if [ -n "$PRE_UPTIME" ] && [ "$POST_UPTIME" = "$PRE_UPTIME" ]; then
  echo "$LOG_TAG PM2 worker did not restart (pm_uptime unchanged) — reload silently no-opped"
  pm2 logs liffio-dashboard --lines 30 --nostream
  exit 1
fi

echo "$LOG_TAG $(date '+%Y-%m-%d %H:%M:%S') Deployment complete ✓"
