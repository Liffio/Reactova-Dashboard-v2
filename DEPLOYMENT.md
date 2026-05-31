# Frontend Deployment



This repo deploys the React dashboard for `app.liffio.com` to the frontend droplet.



## GitHub Actions



Workflows live in `.github/workflows/` inside this `client` repo:



- `ci.yml`: typecheck, lint, test, and build

- `deploy-frontend.yml`: validates the dashboard, then deploys over SSH



Add these repository secrets in the GitHub repo for the client:



- `FRONTEND_DROPLET_IP`: frontend droplet IP address

- `FRONTEND_DROPLET_PASSWORD`: SSH password for the `root` user

- `FRONTEND_DROPLET_PORT`: optional SSH port, usually `22`

- `FRONTEND_DEPLOY_PATH`: optional absolute path on the droplet (defaults to `/var/www/liffio-dashboard` if unset)

- `SLACK_WEBHOOK_URL`: optional deploy notification webhook



The deployment expects this path on the frontend droplet (unless overridden by `FRONTEND_DEPLOY_PATH`):



- `/var/www/liffio-dashboard`



The production build uses:



```env

VITE_API_URL=https://api.liffio.com

```



## Nginx + PM2



Runtime on the droplet:



1. **PM2** runs `serve` against `./dist` on `127.0.0.1:3000` (see `ecosystem.config.cjs`, app name `liffio-dashboard`).

2. **Nginx** terminates TLS (Cloudflare Origin cert) and reverse-proxies to that upstream.



Repo templates:



- `deploy/nginx/liffio-frontend.conf` — copy to `/etc/nginx/sites-available/` and enable (see below).

- `deploy/nginx/cloudflare-ips.conf` — copy to `/etc/nginx/cloudflare-ips.conf`.



### One-time droplet setup



1. Install Cloudflare Origin cert on the droplet (paths must match the nginx `ssl_certificate` directives):



   ```bash

   mkdir -p /etc/ssl/cloudflare

   # paste cert + key from Cloudflare → SSL/TLS → Origin Server

   nano /etc/ssl/cloudflare/liffio.pem

   nano /etc/ssl/cloudflare/liffio.key

   chmod 600 /etc/ssl/cloudflare/liffio.key

   ```



2. Install nginx site + Cloudflare IP allowlist:



   ```bash

   DEPLOY="/var/www/liffio-dashboard"

   cp "$DEPLOY/deploy/nginx/cloudflare-ips.conf" /etc/nginx/cloudflare-ips.conf

   cp "$DEPLOY/deploy/nginx/liffio-frontend.conf" /etc/nginx/sites-available/liffio-frontend.conf

   ln -sf /etc/nginx/sites-available/liffio-frontend.conf /etc/nginx/sites-enabled/liffio-frontend.conf

   rm -f /etc/nginx/sites-enabled/default

   nginx -t && systemctl reload nginx

   systemctl enable nginx

   ```



3. After the first successful deploy (or `npm ci && VITE_API_URL=https://api.liffio.com npm run build` on the droplet), start PM2 once and enable resurrection on reboot:



   ```bash

   cd /var/www/liffio-dashboard

   npm ci

   VITE_API_URL=https://api.liffio.com npm run build

   npm install -g pm2

   npm run pm2:start

   pm2 save

   pm2 startup    # run the printed sudo command once

   pm2 save

   ```



## Surviving a droplet reboot



Both **nginx** and **PM2** should start on boot:



- `systemctl enable nginx` — nginx serves TLS and proxies to Node.

- `pm2 startup` + `pm2 save` — PM2 restores `liffio-dashboard` after reboot.



Verify after reboot:



```bash

systemctl is-enabled nginx

systemctl status nginx --no-pager

pm2 status

curl -kI https://127.0.0.1 -H 'Host: app.liffio.com'

```



If you change `ecosystem.config.cjs` (rename app, add processes), run `pm2 save` again so the saved process list matches.



## Cloudflare



In Cloudflare → SSL/TLS, use **Full (strict)** with the Origin certificate installed on the droplet. DNS for `app.liffio.com` should be **proxied** (orange cloud).

