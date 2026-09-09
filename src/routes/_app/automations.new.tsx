import { createFileRoute } from "@tanstack/react-router";

import { ProtectedRoute } from "@/components/auth/guards";
import { InstagramRequired } from "@/components/auth/instagram-required";
import { AutomationBuilder } from "@/components/automations/automation-builder";

/**
 * Thin route over the shared builder. The form itself lives in
 * `components/automations/automation-builder.tsx` because the edit route renders the same
 * component with its target locked — see that file for the create/edit differences.
 */
export const Route = createFileRoute("/_app/automations/new")({
  head: () => ({ meta: [{ title: "New automation — Liffio" }] }),
  // `?lyraDraft=true` — arrival from the Ask AI drawer: load the Lyra handoff
  // and prefill the wizard with the step-by-step theater.
  validateSearch: (search: Record<string, unknown>): { lyraDraft?: boolean } => ({
    lyraDraft: search.lyraDraft === true || search.lyraDraft === "true" ? true : undefined,
  }),
  component: AutomationBuilderRoute,
});

function AutomationBuilderRoute() {
  const { lyraDraft } = Route.useSearch();

  return (
    <ProtectedRoute module="automation" action="create">
      <InstagramRequired feature="Automations">
        <AutomationBuilder lyraDraft={Boolean(lyraDraft)} />
      </InstagramRequired>
    </ProtectedRoute>
  );
}
