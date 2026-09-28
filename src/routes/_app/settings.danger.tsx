import { createFileRoute } from "@tanstack/react-router";
import { DangerTab } from "@/features/settings/tabs/danger-tab";

export const Route = createFileRoute("/_app/settings/danger")({
  head: () => ({ meta: [{ title: "Danger zone — Settings — Liffio" }] }),
  component: DangerTab,
});
