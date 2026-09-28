import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/guards";
import { GeneralSettings } from "@/features/settings/pages/workspace-panels";

export const Route = createFileRoute("/_app/settings/general")({
  head: () => ({ meta: [{ title: "General — Settings — Liffio" }] }),
  component: () => (
    <ProtectedRoute module="workspace">
      <GeneralSettings />
    </ProtectedRoute>
  ),
});
