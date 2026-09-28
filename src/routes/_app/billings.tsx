import { createFileRoute, redirect } from "@tanstack/react-router";

/** Moved into Settings (plan/settings-revamp.md). Checkout's `?status=` return and `?highlight=`
 *  are carried over. */
export const Route = createFileRoute("/_app/billings")({
  validateSearch: (search: Record<string, unknown>): { status?: string; highlight?: string } => ({
    status: typeof search.status === "string" ? search.status : undefined,
    highlight: typeof search.highlight === "string" ? search.highlight : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/settings/billing", search, replace: true });
  },
});
