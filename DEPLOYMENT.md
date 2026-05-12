# Frontend Deployment

This repo deploys the React dashboard to the frontend droplet.

## GitHub Actions

Workflows live in `.github/workflows/` inside this `client` repo:

- `ci.yml`: typecheck, lint, test, and build
- `deploy-frontend.yml`: validates the dashboard, then deploys over SSH

Add these repository secrets in the GitHub repo for the client:

- `FRONTEND_DROPLET_IP`: frontend droplet IP address
- `FRONTEND_DROPLET_PASSWORD`: SSH password for the `reactova` user
- `FRONTEND_DROPLET_PORT`: optional SSH port, usually `22`
- `SLACK_WEBHOOK_URL`: optional deploy notification webhook

The deployment expects this path on the frontend droplet:

- `/var/www/reactova-dashboard`

The production build uses:

```env
VITE_API_URL=https://api.reactova.com
```

## Nginx

- `deploy/nginx/reactova-frontend.conf` serves `app.reactova.com` from `/var/www/reactova-dashboard/dist` and proxies `reactova.com` / `www.reactova.com` to the optional Next.js marketing process on port `3002`.
- `deploy/nginx/cloudflare-ips.conf` contains the Cloudflare allowlist used by the Nginx config.

## Optional Marketing App

If `/var/www/reactova-marketing` exists on the frontend droplet, the workflow also pulls, builds, and reloads the `reactova-marketing` PM2 process. The PM2 template is in `deploy/pm2/reactova-marketing.ecosystem.config.cjs`.
