import { createFileRoute } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { AlertCircle, ChevronRight, History, Loader2, UserCog } from "lucide-react";

import { EmptyState } from "@/components/admin/form-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { ApiError } from "@/lib/api/http";
import {
  getAdminUserAudit,
  type AdminUserAuditActorType,
  type AdminUserAuditEntry,
} from "@/lib/api/admin-users-api";

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

/** Humanized labels for the server's exact (lowercase) actor-type union — see
 *  `AdminUserAuditActorType`'s doc comment in `admin-users-api.ts` for the source of truth
 *  (`server/src/services/auditService.ts`). */
const ACTOR_TYPE_LABEL: Record<AdminUserAuditActorType, string> = {
  user: "User",
  platform_admin: "Platform admin",
  super_admin: "Super admin",
  impersonation: "Impersonation",
  api_key: "API key",
  system: "System",
};

/** First 8 chars of a uuid — this tab has no name lookup for an arbitrary counterpart id (the
 *  admin on the other side of an impersonation row isn't necessarily this page's user), so a
 *  short, copyable-looking fragment plus a full-id tooltip is the honest thing to render rather
 *  than guessing at a display name. */
function shortId(id: string | null): string {
  return id ? id.slice(0, 8) : "—";
}

/**
 * T16 carry-in (task-21-brief.md item 5): `auditService.actorFromRequest` was corrected in
 * task-16-report.md §5.5/§7 — during impersonation, `actorUserId` is the ADMIN (the human
 * responsible) and `onBehalfOfUserId` is the CUSTOMER whose account it was done to/for. This
 * tab's own query matches `actor_user_id = pageUserId OR on_behalf_of_user_id = pageUserId`, so
 * an impersonation row can appear here from EITHER side depending on whether this page's user was
 * the acting admin or the affected customer — the label below distinguishes the two rather than
 * showing one static "Impersonation"/"On behalf of" string regardless of direction, which is what
 * this component did before this fix (and would have been actively misleading under the pre-fix
 * — backwards — attribution this component was originally written against).
 */
function ActorTypeBadge({ entry, pageUserId }: { entry: AdminUserAuditEntry; pageUserId: string }) {
  // Impersonation/on-behalf-of rows are the ones an operator most needs to notice — amber, per
  // task-8-brief.md requirement 3. `platform_admin`/`super_admin` rows get a distinct muted badge
  // so an ordinary admin-performed action reads as "an admin did this," not as impersonation. A
  // plain `user`/`api_key`/`system` row needs no badge at all.
  if (entry.actorType === "impersonation" || entry.onBehalfOfUserId) {
    const pageUserIsTheAdmin = entry.actorUserId === pageUserId;
    const counterpart = pageUserIsTheAdmin
      ? `→ on behalf of ${shortId(entry.onBehalfOfUserId)}`
      : `by admin ${shortId(entry.actorUserId)}`;
    const title = pageUserIsTheAdmin
      ? `This user (${entry.actorUserId}) was impersonating ${entry.onBehalfOfUserId ?? "unknown"} when this action happened.`
      : `Admin ${entry.actorUserId ?? "unknown"} performed this action while impersonating this user.`;
    return (
      <span className="inline-flex items-center gap-1.5" title={title}>
        <Badge
          variant="outline"
          className="gap-1 border-warning/30 bg-warning/10 text-[10px] text-warning"
        >
          <UserCog className="h-3 w-3" /> {ACTOR_TYPE_LABEL.impersonation}
        </Badge>
        <span className="font-mono text-[10px] text-muted-foreground">{counterpart}</span>
      </span>
    );
  }
  if (entry.actorType === "platform_admin" || entry.actorType === "super_admin") {
    return (
      <Badge
        variant="outline"
        className="border-muted-foreground/30 text-[10px] text-muted-foreground"
      >
        {ACTOR_TYPE_LABEL[entry.actorType]}
      </Badge>
    );
  }
  return null;
}

function AuditRow({ entry, pageUserId }: { entry: AdminUserAuditEntry; pageUserId: string }) {
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
          <ActorTypeBadge entry={entry} pageUserId={pageUserId} />
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
        <AuditRow key={entry.id} entry={entry} pageUserId={userId} />
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
