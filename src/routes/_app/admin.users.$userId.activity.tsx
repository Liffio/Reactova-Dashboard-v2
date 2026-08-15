import { createFileRoute } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { AlertCircle, ChevronRight, History, Loader2, UserCog } from "lucide-react";

import { EmptyState } from "@/components/admin/form-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { ApiError } from "@/lib/api/http";
import { getAdminUserAudit, type AdminUserAuditEntry } from "@/lib/api/admin-users-api";

/**
 * Activity tab — audit trail for this user (as actor OR on-behalf-of target), keyset-paginated
 * via `useInfiniteQuery` — same primitive/shape as the user list's cursor pagination
 * (`getNextPageParam: last => last.nextCursor ?? undefined`), just a "Load more" button instead
 * of scroll-virtualised infinite scroll: this tab's row count doesn't warrant a virtualizer.
 */
export const Route = createFileRoute("/_app/admin/users/$userId/activity")({
  head: () => ({ meta: [{ title: "Activity — User — Admin" }] }),
  component: ActivityTab,
});

const PAGE_SIZE = 25;

function ActorTypeBadge({ entry }: { entry: AdminUserAuditEntry }) {
  // Only shown for impersonation/on-behalf-of actors per task-8-brief.md requirement 3 — a
  // normal USER/PLATFORM_ADMIN/API_KEY/SYSTEM row needs no badge.
  if (entry.actorType === "ADMIN_IMPERSONATION") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-warning/30 bg-warning/10 text-[10px] text-warning"
      >
        <UserCog className="h-3 w-3" /> Impersonation
      </Badge>
    );
  }
  if (entry.onBehalfOfUserId) {
    return (
      <Badge variant="outline" className="gap-1 text-[10px]">
        <UserCog className="h-3 w-3" /> On behalf of
      </Badge>
    );
  }
  return null;
}

function AuditRow({ entry }: { entry: AdminUserAuditEntry }) {
  const hasChanges = Boolean(entry.changes && Object.keys(entry.changes).length > 0);
  const hasMetadata = Boolean(entry.metadata && Object.keys(entry.metadata).length > 0);

  return (
    <div className="rounded-xl border bg-card p-3 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-medium">{entry.action}</span>
          <span className="text-xs text-muted-foreground">
            {entry.resourceType}
            {entry.resourceId ? ` · ${entry.resourceId}` : ""}
          </span>
          <ActorTypeBadge entry={entry} />
        </div>
        <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
          {formatDateTime(entry.createdAt)}
        </span>
      </div>

      {(hasChanges || hasMetadata) && (
        <details className="group mt-2">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
            Changes &amp; metadata
          </summary>
          <div className="mt-2 space-y-2">
            {hasChanges && (
              <pre className="overflow-x-auto rounded-lg bg-muted/40 p-2.5 font-mono text-[11px] leading-relaxed">
                {JSON.stringify(entry.changes, null, 2)}
              </pre>
            )}
            {hasMetadata && (
              <pre className="overflow-x-auto rounded-lg bg-muted/40 p-2.5 font-mono text-[11px] leading-relaxed">
                {JSON.stringify(entry.metadata, null, 2)}
              </pre>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

function ActivityTab() {
  const { userId } = Route.useParams();

  const auditQuery = useInfiniteQuery({
    queryKey: ["admin-user", userId, "audit"],
    queryFn: ({ pageParam, signal }: { pageParam: string | undefined; signal: AbortSignal }) =>
      getAdminUserAudit(userId, { limit: PAGE_SIZE, cursor: pageParam }, { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const entries = auditQuery.data?.pages.flatMap((p) => p.items) ?? [];

  if (auditQuery.isLoading) {
    return (
      <div className="space-y-2 rounded-2xl border bg-card p-4 shadow-soft">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (auditQuery.isError) {
    const requestId = auditQuery.error instanceof ApiError ? auditQuery.error.requestId : undefined;
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-8 text-center">
        <AlertCircle className="mx-auto mb-2 h-6 w-6 text-destructive" />
        <p className="text-sm font-medium text-destructive">Couldn't load activity.</p>
        {requestId && (
          <p className="mt-2 text-xs text-muted-foreground">
            Request ID: <span className="font-mono">{requestId}</span>
          </p>
        )}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState icon={History} title="No activity recorded">
        Nothing in the audit trail for this user yet.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <AuditRow key={entry.id} entry={entry} />
      ))}
      {auditQuery.hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void auditQuery.fetchNextPage()}
            disabled={auditQuery.isFetchingNextPage}
          >
            {auditQuery.isFetchingNextPage ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
