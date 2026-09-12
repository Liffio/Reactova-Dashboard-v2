import { useCallback, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { ProtectedRoute } from "@/components/auth/guards";
import { InstagramRequired } from "@/components/auth/instagram-required";
import { AutomationBuilder } from "@/components/automations/automation-builder";
import { templateBuilderForm } from "@/components/automations/automation-form";
import { templateById, type TemplateId } from "@/lib/onboarding/templates";
import { useApp } from "@/state/app-context";
import { useOnboardingState, useSaveOnboarding } from "@/hooks/use-onboarding";

const TEMPLATE_IDS: TemplateId[] = ["link", "resource", "code", "prices"];

/**
 * Thin route over the shared builder. The form itself lives in
 * `components/automations/automation-builder.tsx` because the edit route renders the same
 * component with its target locked — see that file for the create/edit differences.
 */
export const Route = createFileRoute("/_app/automations/new")({
  head: () => ({ meta: [{ title: "New automation — Liffio" }] }),
  // `?lyraDraft=true` — arrival from the Ask AI drawer: load the Lyra handoff
  // and prefill the wizard with the step-by-step theater.
  //
  // `?template=<id>` — arrival from the onboarding suggestion on Home. Prefills the reply, DM and
  // button label from the client-side template registry and shows the template's keyword as a
  // placeholder. Only the **id** travels; all copy is resolved here, which is why nothing about a
  // template is ever stored server-side.
  validateSearch: (
    search: Record<string, unknown>,
  ): { lyraDraft?: boolean; template?: TemplateId } => ({
    lyraDraft: search.lyraDraft === true || search.lyraDraft === "true" ? true : undefined,
    template: TEMPLATE_IDS.includes(search.template as TemplateId)
      ? (search.template as TemplateId)
      : undefined,
  }),
  component: AutomationBuilderRoute,
});

function AutomationBuilderRoute() {
  const { lyraDraft, template } = Route.useSearch();
  const navigate = useNavigate();
  const { current } = useApp();
  const workspaceId = current.id !== "default" ? current.id : null;
  const { state } = useOnboardingState(workspaceId);
  const { save } = useSaveOnboarding(workspaceId);

  const resolved = useMemo(() => (template ? templateById(template) : null), [template]);

  /**
   * "Skip for now" — creates nothing, records the decision, goes Home.
   *
   * `skippedAt` is what drops the automation steps from the dashboard checklist and stops the
   * suggestion reappearing. It is written against whatever `suggestedTemplate` the workspace
   * already holds; if there is none (a user who reached this page some other way), one is written
   * from the template in the URL so the skip still has something to attach to.
   */
  const skip = useCallback(() => {
    const now = new Date().toISOString();
    const existing = state.suggestedTemplate;
    if (existing) {
      save({ suggestedTemplate: { ...existing, skippedAt: now } });
    } else if (template) {
      save({ suggestedTemplate: { id: template, version: 1, skippedAt: now } });
    }
    void navigate({ to: "/dashboard" });
  }, [navigate, save, state.suggestedTemplate, template]);

  return (
    <ProtectedRoute module="automation" action="create">
      <InstagramRequired feature="Automations">
        <AutomationBuilder
          lyraDraft={Boolean(lyraDraft)}
          initialForm={resolved ? templateBuilderForm(resolved) : undefined}
          keywordPlaceholder={resolved?.keywordPlaceholder}
          onSkip={resolved ? skip : undefined}
        />
      </InstagramRequired>
    </ProtectedRoute>
  );
}
