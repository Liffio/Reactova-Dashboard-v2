import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/guards";
import { EmbeddedPageContext } from "@/components/dashboard/page-header";
import { SettingsPanel } from "@/features/settings/components";
import { ApiCredentialsSettings } from "@/features/settings/pages/workspace-panels";
import { ApiDocsPage } from "@/features/settings/pages/api-docs-page";

export const Route = createFileRoute("/_app/settings/developer")({
  head: () => ({ meta: [{ title: "Developer — Settings — Liffio" }] }),
  component: DeveloperRoute,
});

/** Key quota + docs link, the API keys table, then the API docs. The audit log is `/audit-logs`. */
function DeveloperRoute() {
  return (
    <ProtectedRoute module="workspace">
      <EmbeddedPageContext.Provider value>
        <SettingsPanel>
          <ApiCredentialsSettings docsHref="#api-docs" />
          <ApiDocsPage />
        </SettingsPanel>
      </EmbeddedPageContext.Provider>
    </ProtectedRoute>
  );
}
