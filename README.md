# Reactova Client

Vite + React frontend for Reactova.

## Scripts

- `npm run dev` - start the local Vite dev server
- `npm run build` - build production assets into `dist`
- `npm run start` - serve the built `dist` folder on `127.0.0.1:3000`
- `npm run typecheck` - run TypeScript project checks
- `npm run lint` - run ESLint
- `npm run test` - run Vitest

Production deployment is configured in `.github/workflows/deploy-frontend.yml`. The dashboard is served as static files by Nginx; see `DEPLOYMENT.md`.
