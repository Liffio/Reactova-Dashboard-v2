# Frontend Deployment

Docker-based deploy to the `reactova-frontend-main` droplet, mirroring the backend's pipeline. Every push to `main` (or a manual `workflow_dispatch`) builds the image in CI, pushes it to GHCR, and swaps the container on the droplet over SSH.

## Architecture

- **Image**: multi-stage `Dockerfile` — stage 1 runs `npm ci && npm run build` (the committed `.env` supplies the public `VITE_*` config) then prunes devDeps; stage 2 ships Node 20 + `dist/` + production `node_modules` + `server-start.mjs`. The SSR chunks bare-import nitro runtime packages (e.g. `h3-v2`), so `node_modules` must be present at runtime — verified by smoke test.
- **Runtime**: one `web` service (`docker-compose.yml`), listening on `0.0.0.0:3000` inside the container, published on the droplet's loopback only (`127.0.0.1:3000`). Nginx keeps proxying `app.liffio.com → 127.0.0.1:3000` exactly as it did under PM2 — no nginx changes needed.
- **Registry**: `ghcr.io/<owner>/liffio-frontend`, tagged with the git SHA and `latest`.

## Pipeline (`.github/workflows/deploy.yml`)

1. Discord "started" notification.
2. **Validate** — `npm ci && npm run build` on the runner.
3. **Deploy** — build+push image to GHCR → scp `docker-compose.yml` to the droplet → SSH script:
   - installs Docker if missing (first run only),
   - `docker login ghcr.io` with `GHCR_PAT`,
   - pulls the new image,
   - one-time: deletes the legacy `liffio-dashboard` PM2 process so the container can bind port 3000,
   - `docker compose up -d --force-recreate --remove-orphans`,
   - waits up to 120s for the container healthcheck, then runs the stale-asset check (fetches `/`, resolves a referenced `/assets/*` file from the new container),
   - prunes dangling images.
4. Cloudflare cache purge.
5. Discord "finished" notification.

## Required repo secrets

| Secret | Purpose |
|---|---|
| `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_PASSWORD` / `DEPLOY_PORT` | SSH to the frontend droplet (already set for the old pipeline) |
| `DEPLOY_PATH` | Directory on the droplet holding `docker-compose.yml` (the old app dir works fine) |
| `GHCR_PAT` | **New** — GitHub classic PAT with `read:packages`, used by the droplet to pull from GHCR |
| `DISCORD_WEBHOOK_URL` / `DISCORD_ALERT_ROLE_ID` | Deploy notifications (optional) |
| `CF_API_TOKEN` / `CF_ZONE_ID` | Cloudflare cache purge (optional) |

## Rollback

SSH into the droplet:

```bash
cd $DEPLOY_PATH
export LIFFIO_IMAGE=ghcr.io/<owner>/liffio-frontend
export IMAGE_TAG=<previous-git-sha>
docker compose up -d
```

Previous SHA-tagged images stay on the droplet until pruned, and every pushed SHA remains in GHCR.

## Notes

- `deploy/deploy.sh` and `ecosystem.config.cjs` are the retired PM2 pipeline — kept for reference, no longer invoked by CI.
- Runtime env: the SSR server only reads `NODE_ENV` (set in compose). All `VITE_*` values are baked at image build time from the committed `.env` — changing them requires a rebuild, not a restart.
