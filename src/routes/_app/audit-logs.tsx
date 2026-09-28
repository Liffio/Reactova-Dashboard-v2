import { createFileRoute } from "@tanstack/react-router";

import { ProtectedRoute } from "@/components/auth/guards";
import { AuditLogPage } from "@/features/settings/pages/audit-log-page";

/**
 * The workspace audit log, as its own page (its sidebar entry comes from the module registry).
 * It briefly lived inside Settings → Developer; it is not a developer tool, so it moved back.
 */
export const Route = createFileRoute("/_app/audit-logs")({
  head: () => ({ meta: [{ title: "Audit logs — Liffio" }] }),
  component: AuditLogsRoute,
});

function AuditLogsRoute() {
  return (
    <ProtectedRoute module="audit_logs">
      <div className="flex w-full flex-col gap-6 px-4 pb-16 pt-7 sm:px-5 lg:px-8">
        <h1 className="m-0 font-display text-[26px] font-bold tracking-[-0.02em] text-foreground">
          Audit logs
        </h1>
        <AuditLogPage />
      </div>
    </ProtectedRoute>
  );
}
