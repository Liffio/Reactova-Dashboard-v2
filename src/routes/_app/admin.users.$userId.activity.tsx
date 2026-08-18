import { createFileRoute } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";

import { AuditTimeline } from "@/components/admin/audit-timeline";
import { getAdminUserAudit } from "@/lib/api/admin-users-api";

/**
 * Activity tab — the user's audit trail (as actor OR on-behalf-of target), keyset-paginated via
 * `useInfiniteQuery`. Rendering is delegated to the shared `<AuditTimeline>` so this and the
 * package-detail Change history read identically: a vertical timeline grouped by day, with
 * per-action icons, the resolved actor name, Toggl-style from→to change pills, and expandable
 * metadata. `pageUserId` lets the timeline label impersonation rows directionally.
 */
export const Route = createFileRoute("/_app/admin/users/$userId/activity")({
  head: () => ({ meta: [{ title: "Activity — User — Admin" }] }),
  component: ActivityTab,
});

const PAGE_SIZE = 25;

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

  return (
    <AuditTimeline
      entries={entries}
      isLoading={auditQuery.isLoading}
      isError={auditQuery.isError}
      error={auditQuery.error}
      hasNextPage={auditQuery.hasNextPage}
      isFetchingNextPage={auditQuery.isFetchingNextPage}
      fetchNextPage={() => void auditQuery.fetchNextPage()}
      onRetry={() => void auditQuery.refetch()}
      pageUserId={userId}
      emptyTitle="No activity recorded"
      emptyHint="Nothing in the audit trail for this user yet."
    />
  );
}
