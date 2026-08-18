import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Archive, History } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { ProtectedRoute } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { AuditTimeline } from "@/components/admin/audit-timeline";
import { getAuditLogs, getAuditLogsArchive } from "@/lib/api/audit-logs-api";
import { useApp } from "@/state/app-context";

/**
 * Workspace Audit Logs — the tenant-facing activity trail. Rendering is delegated to the shared
 * `<AuditTimeline>` (same component the admin trails use), fed by a keyset `useInfiniteQuery`. The
 * live feed caps at the 500 most-recent entries within 7 days; when the server flags
 * `archiveAvailable`, a header action switches the timeline to the archive query for older entries.
 */
export const Route = createFileRoute("/_app/audit-logs")({
  head: () => ({ meta: [{ title: "Audit Logs — Liffio" }] }),
  component: AuditLogsRoute,
});

function AuditLogsRoute() {
  return (
    <ProtectedRoute module="audit_logs">
      <AuditLogsPage />
    </ProtectedRoute>
  );
}

const PAGE_SIZE = 50;

function AuditLogsPage() {
  const { current } = useApp();
  const workspaceId = current.id;
  const [view, setView] = useState<"live" | "archive">("live");

  const query = useInfiniteQuery({
    queryKey: ["audit-logs", workspaceId, view],
    queryFn: ({ pageParam, signal }: { pageParam: string | undefined; signal: AbortSignal }) =>
      (view === "archive" ? getAuditLogsArchive : getAuditLogs)(
        { limit: PAGE_SIZE, cursor: pageParam },
        { signal },
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(workspaceId) && workspaceId !== "default",
  });

  const entries = query.data?.pages.flatMap((p) => p.items) ?? [];
  const archiveAvailable = query.data?.pages.some((p) => p.archiveAvailable) ?? false;

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Audit Logs"
        description="Recent activity across your workspace — who did what, and when."
        actions={
          view === "live" ? (
            archiveAvailable ? (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => setView("archive")}
              >
                <Archive className="h-4 w-4" />
                View archive
              </Button>
            ) : null
          ) : (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setView("live")}>
              <History className="h-4 w-4" />
              Back to recent
            </Button>
          )
        }
      />

      <div className="space-y-5 p-4 sm:p-6 md:p-10">
        <AuditTimeline
          entries={entries}
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          hasNextPage={query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          fetchNextPage={() => void query.fetchNextPage()}
          onRetry={() => void query.refetch()}
          emptyTitle={view === "archive" ? "No archived entries" : "No activity yet"}
          emptyHint={
            view === "archive"
              ? "There are no entries beyond the most recent 500."
              : "Workspace actions will appear here as they happen."
          }
        />
      </div>
    </div>
  );
}
