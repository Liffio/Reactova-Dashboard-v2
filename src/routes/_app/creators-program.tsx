import { createFileRoute } from "@tanstack/react-router";

import { ProtectedRoute } from "@/components/auth/guards";
import { CreatorProgramPage } from "@/features/creator-program/creator-program-page";

export const Route = createFileRoute("/_app/creators-program")({
  head: () => ({ meta: [{ title: "Creator Program — Liffio" }] }),
  component: CreatorsProgramRoute,
});

/**
 * One page inside the existing dashboard — the sidebar and top bar are already
 * there and are not in scope. `creator-program` scopes the page's own `--cp-*`
 * design tokens (styles.css); everything inside reads from those rather than
 * the app's theme tokens.
 *
 * There is no PageHeader here on purpose: each frame owns its own hero, and a
 * standing "Creator Program" header above a takeover would frame a broken
 * connection as a section of a working dashboard.
 */
function CreatorsProgramRoute() {
  return (
    <ProtectedRoute>
      <div className="creator-program p-4 sm:p-6 md:p-10">
        <CreatorProgramPage />
      </div>
    </ProtectedRoute>
  );
}
