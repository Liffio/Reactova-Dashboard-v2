import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/guards";
import { EmbeddedPageContext } from "@/components/dashboard/page-header";
import { useCan } from "@/hooks/use-auth";
import { SettingsPanel } from "@/features/settings/components";
import { ApiCredentialsSettings } from "@/features/settings/pages/workspace-panels";
import { ApiDocsPage } from "@/features/settings/pages/api-docs-page";
import { AuditLogPage } from "@/features/settings/pages/audit-log-page";

export const Route = createFileRoute("/_app/settings/developer")({
  head: () => ({ meta: [{ title: "Developer — Settings — Liffio" }] }),
  component: DeveloperRoute,
});

/** Key quota + docs link, API keys, the audit log (only with `audit_logs:read`) and the API docs. */
function DeveloperRoute() {
  const canReadAudit = useCan("audit_logs", "read");
  return (
    <ProtectedRoute module="workspace">
      <EmbeddedPageContext.Provider value>
        <SettingsPanel>
          <ApiCredentialsSettings docsHref="#api-docs" />
          {canReadAudit && <AuditLogPage />}
          <ApiDocsPage />
        </SettingsPanel>
      </EmbeddedPageContext.Provider>
    </ProtectedRoute>
  );
}
