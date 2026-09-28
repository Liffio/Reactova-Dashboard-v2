import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Archive, History } from "lucide-react";

import { AuditTimeline } from "@/components/admin/audit-timeline";
import { getAuditLogs, getAuditLogsArchive } from "@/lib/api/audit-logs-api";
import { isWorkspaceReady } from "@/lib/api/active-workspace";
import { useApp } from "@/state/app-context";
import { SettingsButton, SettingsCard } from "../components";

/**
 * Workspace Audit Logs — the tenant-facing activity trail, shown as the "Audit log" card of
 * Settings → Developer. Rendering is delegated to the shared `<AuditTimeline>` (same component the
 * admin trails use, which carries the per-entry change diff), fed by a keyset `useInfiniteQuery`.
 * The live feed caps at the 500 most-recent entries within 7 days; when the server flags
 * `archiveAvailable`, the card action switches the timeline to the archive query for older entries.
 */

const PAGE_SIZE = 50;

export function AuditLogPage() {
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
    enabled: isWorkspaceReady(workspaceId),
  });

  const entries = query.data?.pages.flatMap((p) => p.items) ?? [];
  const archiveAvailable = query.data?.pages.some((p) => p.archiveAvailable) ?? false;

  return (
    <SettingsCard
      title="Audit log"
      description={
        view === "archive"
          ? `Older activity in ${current.name}, from the archive.`
          : `Every change in ${current.name}, kept 7 days.`
      }
      actions={
        view === "live" ? (
          archiveAvailable ? (
            <SettingsButton onClick={() => setView("archive")}>
              <Archive />
              <span>View archive</span>
            </SettingsButton>
          ) : null
        ) : (
          <SettingsButton onClick={() => setView("live")}>
            <History />
            <span>Back to recent</span>
          </SettingsButton>
        )
      }
    >
      <div className="px-5 py-5 sm:px-6">
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
    </SettingsCard>
  );
}
