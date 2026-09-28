import { createFileRoute } from "@tanstack/react-router";
import { ProfileTab } from "@/features/settings/tabs/profile-tab";

export const Route = createFileRoute("/_app/settings/profile")({
  head: () => ({ meta: [{ title: "Profile — Settings — Liffio" }] }),
  component: ProfileTab,
});
