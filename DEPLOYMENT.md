# Frontend Deployment

This repo deploys the React dashboard for `app.reactova.com` to the frontend droplet.

## GitHub Actions

Workflows live in `.github/workflows/` inside this `client` repo:

- `ci.yml`: typecheck, lint, test, and build
- `deploy-frontend.yml`: validates the dashboard, then deploys over SSH

Add these repository secrets in the GitHub repo for the client:

- `FRONTEND_DROPLET_IP`: frontend droplet IP address
- `FRONTEND_DROPLET_PASSWORD`: SSH password for the `root` user
- `FRONTEND_DROPLET_PORT`: optional SSH port, usually `22`
- `SLACK_WEBHOOK_URL`: optional deploy notification webhook

The deployment expects this path on the frontend droplet:

- `/var/www/reactova-dashboard`

The production build uses:

```env
VITE_API_URL=https://api.reactova.com
```

## Nginx

- `deploy/nginx/reactova-frontend.conf` serves `app.reactova.com` from `/var/www/reactova-dashboard/dist`.
- `deploy/nginx/cloudflare-ips.conf` contains the Cloudflare allowlist used by the Nginx config.
