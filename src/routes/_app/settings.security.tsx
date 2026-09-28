import { createFileRoute } from "@tanstack/react-router";
import { SecurityTab } from "@/features/settings/tabs/security-tab";

export type SecuritySearch = { google?: string; code?: string };

export const Route = createFileRoute("/_app/settings/security")({
  validateSearch: (search: Record<string, unknown>): SecuritySearch => ({
    google: typeof search.google === "string" ? search.google : undefined,
    code: typeof search.code === "string" ? search.code : undefined,
  }),
  head: () => ({ meta: [{ title: "Security — Settings — Liffio" }] }),
  component: SecurityRoute,
});

function SecurityRoute() {
  return <SecurityTab search={Route.useSearch()} />;
}
