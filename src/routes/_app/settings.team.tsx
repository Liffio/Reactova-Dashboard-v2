import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/guards";
import { TeamPage } from "@/features/settings/pages/team-page";

export const Route = createFileRoute("/_app/settings/team")({
  head: () => ({ meta: [{ title: "Team — Settings — Liffio" }] }),
  component: () => (
    <ProtectedRoute module="workspace">
      <TeamPage />
    </ProtectedRoute>
  ),
});
