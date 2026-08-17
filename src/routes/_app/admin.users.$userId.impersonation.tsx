import { createFileRoute } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2, UserCog } from "lucide-react";

import { EmptyState } from "@/components/admin/form-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { ApiError } from "@/lib/api/http";
import {
  getUserImpersonationHistory,
  type ImpersonationEndedReason,
  type ImpersonationHistoryEntry,
} from "@/lib/api/admin-impersonation-api";

/**
 * Impersonation tab (Task 18 requirement 5) — history of every session run against this user AS
 * TARGET. Keyset-paginated via `useInfiniteQuery`, same primitive/shape as the Activity tab
 * (`getNextPageParam: last => last.nextCursor ?? undefined`, a "Load more" button rather than
 * scroll virtualisation — this tab's row count doesn't warrant it either).
 *
 * Gated by the shell's existing `platform:user_manage` guard, NOT `platform:impersonate`
 * (task-16-report §3.6: this is a read-only tab, same axis as Activity/Sessions — starting a new
 * session is the only thing that needs the impersonate permission, and that's the separate
 * `ImpersonateAction` button in the action bar).
 */
export const Route = createFileRoute("/_app/admin/users/$userId/impersonation")({
  head: () => ({ meta: [{ title: "Impersonation — User — Admin" }] }),
  component: ImpersonationTab,
});

const PAGE_SIZE = 25;

const ENDED_REASON_LABEL: Record<ImpersonationEndedReason, string> = {
  EXPIRED: "Expired",
  MANUAL_EXIT: "Exited",
  REVOKED: "Revoked",
  TARGET_PASSWORD_CHANGED: "Ended — password changed",
};

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function ModeBadge({ mode }: { mode: "VIEW_ONLY" | "WRITE" }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px]",
        mode === "WRITE"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-warning/30 bg-warning/10 text-warning",
      )}
    >
      {mode === "WRITE" ? "WRITE" : "VIEW ONLY"}
    </Badge>
  );
}

function StatusBadge({ entry }: { entry: ImpersonationHistoryEntry }) {
  if (entry.endedAt === null) {
    return (
      <Badge variant="outline" className="border-success/30 bg-success/10 text-[10px] text-success">
        Live
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-muted-foreground/30 text-[10px] text-muted-foreground"
    >
      {entry.endedReason ? ENDED_REASON_LABEL[entry.endedReason] : "Ended"}
    </Badge>
  );
}

function HistoryRow({ entry }: { entry: ImpersonationHistoryEntry }) {
  return (
    <div className="rounded-xl border bg-card p-3 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <UserCog className="h-3.5 w-3.5 text-muted-foreground" />
            {entry.adminName || entry.adminEmail}
          </span>
          <ModeBadge mode={entry.mode} />
          <StatusBadge entry={entry} />
        </div>
        <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
          {formatDateTime(entry.startedAt)}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{entry.reason}</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>Duration: {formatDuration(entry.durationSeconds)}</span>
        <span>Actions: {entry.actionsCount}</span>
        {entry.escalatedAt && <span>Escalated: {formatDateTime(entry.escalatedAt)}</span>}
        {entry.ticketRef && <span>Ticket: {entry.ticketRef}</span>}
      </div>
    </div>
  );
}

function ImpersonationTab() {
  const { userId } = Route.useParams();

  const historyQuery = useInfiniteQuery({
    queryKey: ["admin-user", userId, "impersonations"],
    queryFn: ({ pageParam, signal }: { pageParam: string | undefined; signal: AbortSignal }) =>
      getUserImpersonationHistory(userId, { limit: PAGE_SIZE, cursor: pageParam }, { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const entries = historyQuery.data?.pages.flatMap((p) => p.items) ?? [];

  if (historyQuery.isLoading) {
    return (
      <div className="space-y-2 rounded-2xl border bg-card p-4 shadow-soft">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (historyQuery.isError) {
    const requestId =
      historyQuery.error instanceof ApiError ? historyQuery.error.requestId : undefined;
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-8 text-center">
        <AlertCircle className="mx-auto mb-2 h-6 w-6 text-destructive" />
        <p className="text-sm font-medium text-destructive">Couldn't load impersonation history.</p>
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
      <EmptyState icon={UserCog} title="No impersonation sessions">
        No platform admin has impersonated this user yet.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <HistoryRow key={entry.id} entry={entry} />
      ))}
      {historyQuery.hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void historyQuery.fetchNextPage()}
            disabled={historyQuery.isFetchingNextPage}
          >
            {historyQuery.isFetchingNextPage ? (
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
