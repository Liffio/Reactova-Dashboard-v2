import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * The first test setup in this repository.
 *
 * ⚠️ There is no `pull_request` CI trigger here — `deploy.yml` runs `validate` (a bare `npm run
 * build`) as the first job AFTER merge. So until that changes, `npm test` run locally is the only
 * pre-merge evidence beyond a build, and a build cannot catch a wrong price.
 *
 * Scoped to `src/**` and to plain unit tests: no jsdom, no component rendering. The logic worth
 * pinning here is pure — which price to read, and whether a tier is purchasable — and keeping it
 * that way is what let it be extracted out of a 900-line route component in the first place.
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
