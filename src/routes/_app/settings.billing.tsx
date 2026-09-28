import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/guards";
import { EmbeddedPageContext } from "@/components/dashboard/page-header";
import { BillingPage, type BillingSearch } from "@/features/settings/pages/billing-page";

export const Route = createFileRoute("/_app/settings/billing")({
  validateSearch: (search: Record<string, unknown>): BillingSearch => ({
    status: typeof search.status === "string" ? search.status : undefined,
    highlight: typeof search.highlight === "string" ? search.highlight : undefined,
  }),
  head: () => ({ meta: [{ title: "Billing — Settings — Liffio" }] }),
  component: BillingRoute,
});

function BillingRoute() {
  const search = Route.useSearch();
  return (
    <ProtectedRoute module="workspace">
      <EmbeddedPageContext.Provider value>
        <BillingPage search={search} />
      </EmbeddedPageContext.Provider>
    </ProtectedRoute>
  );
}
