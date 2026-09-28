import { createFileRoute } from "@tanstack/react-router";
import { NotificationsTab } from "@/features/settings/tabs/notifications-tab";

export const Route = createFileRoute("/_app/settings/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Settings — Liffio" }] }),
  component: NotificationsTab,
});
