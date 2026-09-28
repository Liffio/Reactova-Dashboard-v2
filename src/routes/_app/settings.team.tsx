import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/guards";
import { EmbeddedPageContext } from "@/components/dashboard/page-header";
import { TeamPage } from "@/features/settings/pages/team-page";

export const Route = createFileRoute("/_app/settings/team")({
  head: () => ({ meta: [{ title: "Team — Settings — Liffio" }] }),
  component: () => (
    <ProtectedRoute module="workspace">
      <EmbeddedPageContext.Provider value>
        <TeamPage />
      </EmbeddedPageContext.Provider>
    </ProtectedRoute>
  ),
});
