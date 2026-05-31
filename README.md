# Liffio Client

Vite + React frontend for Liffio.

## Scripts

- `npm run dev` - start the local Vite dev server
- `npm run build` - build production assets into `dist`
- `npm run start` - serve the built `dist` folder on `127.0.0.1:3000` (same as PM2 on the droplet)
- `npm run pm2:start` / `npm run pm2:reload` - PM2 helpers for production (see `DEPLOYMENT.md`)
- `npm run typecheck` - run TypeScript project checks
- `npm run lint` - run ESLint
- `npm run test` - run Vitest

Production deployment is configured in `.github/workflows/deploy-frontend.yml`. On the droplet, Nginx terminates TLS and proxies to **PM2** running `serve` on `127.0.0.1:3000`; see `DEPLOYMENT.md`.
