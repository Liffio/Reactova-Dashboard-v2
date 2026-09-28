import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/guards";
import { InstagramSettings } from "@/features/settings/pages/workspace-panels";

export const Route = createFileRoute("/_app/settings/instagram")({
  head: () => ({ meta: [{ title: "Instagram — Settings — Liffio" }] }),
  component: () => (
    <ProtectedRoute module="workspace">
      <InstagramSettings />
    </ProtectedRoute>
  ),
});
