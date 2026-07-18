# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Install all deps (vite/nitro live in "dependencies" but are build-time tools here)
COPY package*.json ./
RUN npm ci

# Build the TanStack Start app. The committed .env (public VITE_* config only)
# is included by COPY and picked up by vite — exact parity with CI's validate build.
COPY . .
RUN npm run build

# Same output guard the old PM2 deploy script used — fail the image build, not the boot
RUN test -f dist/server/server.js && [ -n "$(ls -A dist/client/assets 2>/dev/null)" ]

# Drop devDeps (eslint/prettier/typescript/@types) — everything left is needed:
# the SSR chunks in dist/server/assets/ still bare-import nitro runtime packages
# (e.g. h3-v2), so node_modules must ship in the runtime image. Verified by
# smoke test: without it, every SSR request 500s with ERR_MODULE_NOT_FOUND.
RUN npm prune --omit=dev

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=build /app/dist/ ./dist/
COPY --from=build /app/node_modules/ ./node_modules/
COPY --from=build /app/package.json ./package.json
COPY server-start.mjs ./server-start.mjs

USER appuser

# server-start.mjs defaults HOST to 127.0.0.1, which is unreachable through a
# published container port — inside the container it must bind all interfaces.
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server-start.mjs"]
