/**
 * Notification data layer — one hook set, both surfaces (plan/NOTIFICATIONS,
 * Phase 5 / D8). The panel and the page differ only in `limit` and their
 * default filters; the pagination, caching and mutation logic is shared so the
 * two cannot drift.
 *
 * Rules encoded here:
 *  - The filter shape is part of the query key, so changing a filter is a NEW
 *    query. React Query then gives cache, dedupe and in-flight cancellation for
 *    free — none of that is hand-rolled (§5.1).
 *  - Counts never come from a loaded page. The badge reads `/unread-count`, the
 *    category counts read `/facets` (§0.2).
 *  - Mutations are optimistic with rollback AND a surfaced message; a silent
 *    revert is indistinguishable from a no-op (§0.2).
 *  - On settle we invalidate facets and the unread count, never the list —
 *    invalidating the list would discard every loaded page and snap the user
 *    back to the top (§5.4).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryKey,
} from "@tanstack/react-query";
import {
  archiveNotification,
  bulkNotificationAction,
  getNotificationFacets,
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unarchiveNotification,
  type BulkNotificationAction,
  type NotificationFacets,
  type NotificationFilters,
  type NotificationItem,
  type NotificationPage,
} from "@/lib/api/notifications-api";
import { getSocket } from "@/lib/socket";
import { useAuthState } from "@/lib/auth/auth-store";
import { toast } from "@/lib/toast";

/** Panel and page limits, named so neither is a literal at a call site (§2.4). */
export const PANEL_PAGE_SIZE = 20;
export const PAGE_PAGE_SIZE = 40;

/**
 * Fallback poll for the badge. The socket is the primary signal, but
 * notifications raised inside the BullMQ worker never emit (the worker process
 * has no Socket.io server — see PHASE-0-FINDINGS.md §7), so without this a
 * published-post or AI-insight notification would not surface until a refetch.
 */
const UNREAD_POLL_MS = 120_000;

const listKey = (workspaceId: string, filters: NotificationFilters, limit: number): QueryKey => [
  "notifications",
  "list",
  workspaceId,
  filters,
  limit,
];

/** Facets describe the result set MINUS its own category axis, so the category
 *  selection is stripped from the key — otherwise every category click would
 *  refetch counts that are defined not to change (§4.2, §5.3). */
const facetsKey = (workspaceId: string, filters: NotificationFilters): QueryKey => [
  "notifications",
  "facets",
  workspaceId,
  { status: filters.status, since: filters.since, archived: filters.archived, q: filters.q },
];

const unreadKey = (workspaceId: string): QueryKey => ["notifications", "unread-count", workspaceId];

const workspaceEnabled = (workspaceId: string) => Boolean(workspaceId) && workspaceId !== "default";

/* ────────────────────────────── date bucketing ────────────────────────────── */

export type NotificationGroup = { label: string; items: NotificationItem[] };

const BUCKETS = ["Today", "Yesterday", "This week", "Earlier"] as const;

function bucketOf(iso: string, now: Date): (typeof BUCKETS)[number] {
  const d = new Date(iso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (d >= startOfToday) return "Today";
  if (d >= new Date(startOfToday.getTime() - 86_400_000)) return "Yesterday";
  if (d >= new Date(startOfToday.getTime() - 7 * 86_400_000)) return "This week";
  return "Earlier";
}

/**
 * Groups the FLATTENED list, never per page — a bucket that straddles a page
 * boundary must not render its header twice (§5.2).
 */
export function groupByDate(items: NotificationItem[]): NotificationGroup[] {
  const now = new Date();
  const map = new Map<string, NotificationItem[]>();
  for (const item of items) {
    const label = bucketOf(item.createdAt, now);
    const bucket = map.get(label);
    if (bucket) bucket.push(item);
    else map.set(label, [item]);
  }
  return BUCKETS.filter((label) => map.has(label)).map((label) => ({
    label,
    items: map.get(label)!,
  }));
}

/* ─────────────────────────────── queries ──────────────────────────────────── */

export function useNotifications(
  workspaceId: string,
  filters: NotificationFilters,
  options: { limit: number; enabled?: boolean },
) {
  const query = useInfiniteQuery({
    queryKey: listKey(workspaceId, filters, options.limit),
    queryFn: ({ pageParam, signal }: { pageParam: string | undefined; signal: AbortSignal }) =>
      listNotifications({ filters, cursor: pageParam, limit: options.limit }, { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: NotificationPage) => last.nextCursor ?? undefined,
    enabled: workspaceEnabled(workspaceId) && options.enabled !== false,
  });

  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);
  const groups = useMemo(() => groupByDate(items), [items]);

  return { ...query, items, groups };
}

export function useNotificationFacets(
  workspaceId: string,
  filters: NotificationFilters,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: facetsKey(workspaceId, filters),
    queryFn: ({ signal }) => getNotificationFacets(filters, { signal }),
    enabled: workspaceEnabled(workspaceId) && options.enabled !== false,
  });
}

export function useUnreadCount(workspaceId: string) {
  return useQuery({
    queryKey: unreadKey(workspaceId),
    queryFn: ({ signal }) => getUnreadCount({ signal }),
    enabled: workspaceEnabled(workspaceId),
    refetchInterval: UNREAD_POLL_MS,
  });
}

/* ────────────────────────────── mutations ─────────────────────────────────── */

type ListCache = InfiniteData<NotificationPage, string | undefined>;

/** Applies `patch` to one row across every loaded page of every list query for
 *  this workspace, and returns the snapshots needed to undo it. */
function patchRowEverywhere(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string,
  id: string,
  patch: (item: NotificationItem) => NotificationItem,
): [QueryKey, ListCache | undefined][] {
  const entries = queryClient.getQueriesData<ListCache>({
    queryKey: ["notifications", "list", workspaceId],
  });
  for (const [key, data] of entries) {
    if (!data) continue;
    queryClient.setQueryData<ListCache>(key, {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        items: page.items.map((item) => (item.id === id ? patch(item) : item)),
      })),
    });
  }
  return entries;
}

function adjustUnread(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string,
  delta: number,
) {
  queryClient.setQueryData<{ count: number }>(unreadKey(workspaceId), (prev) =>
    prev ? { count: Math.max(0, prev.count + delta) } : prev,
  );
  const facetEntries = queryClient.getQueriesData<NotificationFacets>({
    queryKey: ["notifications", "facets", workspaceId],
  });
  for (const [key, data] of facetEntries) {
    if (!data) continue;
    queryClient.setQueryData<NotificationFacets>(key, {
      ...data,
      unreadTotal: Math.max(0, data.unreadTotal + delta),
    });
  }
}

/**
 * Invalidate the *derived* queries only. The list keeps its loaded pages: a
 * refetch would drop everything below the fold and jump the reader to the top
 * for what was a one-row change.
 */
function useSettleInvalidation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["notifications", "facets", workspaceId] });
    void queryClient.invalidateQueries({ queryKey: unreadKey(workspaceId) });
  }, [queryClient, workspaceId]);
}

export function useNotificationMutations(workspaceId: string) {
  const queryClient = useQueryClient();
  const settle = useSettleInvalidation(workspaceId);

  const restore = (snapshots: [QueryKey, ListCache | undefined][]) => {
    for (const [key, data] of snapshots) queryClient.setQueryData(key, data);
  };

  const markRead = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["notifications", "list", workspaceId] });
      const wasUnread = findItem(queryClient, workspaceId, id)?.readAt === null;
      const snapshots = patchRowEverywhere(queryClient, workspaceId, id, (item) =>
        item.readAt ? item : { ...item, readAt: new Date().toISOString() },
      );
      if (wasUnread) adjustUnread(queryClient, workspaceId, -1);
      return { snapshots, wasUnread };
    },
    onError: (error, _id, context) => {
      if (context) {
        restore(context.snapshots);
        if (context.wasUnread) adjustUnread(queryClient, workspaceId, 1);
      }
      toast.error(`Could not mark as read: ${(error as Error).message}`);
    },
    onSettled: settle,
  });

  const archive = useMutation({
    mutationFn: (id: string) => archiveNotification(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["notifications", "list", workspaceId] });
      const wasUnread = findItem(queryClient, workspaceId, id)?.readAt === null;
      const now = new Date().toISOString();
      const snapshots = patchRowEverywhere(queryClient, workspaceId, id, (item) => ({
        ...item,
        archivedAt: item.archivedAt ?? now,
        readAt: item.readAt ?? now,
      }));
      if (wasUnread) adjustUnread(queryClient, workspaceId, -1);
      return { snapshots, wasUnread };
    },
    onError: (error, _id, context) => {
      if (context) {
        restore(context.snapshots);
        if (context.wasUnread) adjustUnread(queryClient, workspaceId, 1);
      }
      toast.error(`Could not archive: ${(error as Error).message}`);
    },
    onSettled: settle,
  });

  const unarchive = useMutation({
    mutationFn: (id: string) => unarchiveNotification(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["notifications", "list", workspaceId] });
      const snapshots = patchRowEverywhere(queryClient, workspaceId, id, (item) => ({
        ...item,
        archivedAt: null,
      }));
      return { snapshots };
    },
    onError: (error, _id, context) => {
      if (context) restore(context.snapshots);
      toast.error(`Could not restore: ${(error as Error).message}`);
    },
    onSettled: settle,
  });

  /** Scoped to the CURRENT filter — the server marks exactly what the user can see. */
  const markAllRead = useMutation({
    mutationFn: (filters: NotificationFilters) => markAllNotificationsRead(filters),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications", "list", workspaceId] });
    },
    onError: (error) => toast.error(`Could not mark all as read: ${(error as Error).message}`),
    onSettled: settle,
  });

  /** Explicit ids. Partial failure is surfaced, never swallowed (§4). */
  const bulk = useMutation({
    mutationFn: (input: { ids: string[]; action: BulkNotificationAction }) =>
      bulkNotificationAction(input.ids, input.action),
    onSuccess: (result) => {
      const failed = result.results.filter((r) => !r.ok).length;
      if (failed > 0) {
        toast.warning(`${result.results.length - failed} updated, ${failed} could not be updated.`);
      }
      void queryClient.invalidateQueries({ queryKey: ["notifications", "list", workspaceId] });
    },
    onError: (error) => toast.error(`Bulk action failed: ${(error as Error).message}`),
    onSettled: settle,
  });

  return { markRead, archive, unarchive, markAllRead, bulk };
}

function findItem(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string,
  id: string,
): NotificationItem | undefined {
  for (const [, data] of queryClient.getQueriesData<ListCache>({
    queryKey: ["notifications", "list", workspaceId],
  })) {
    for (const page of data?.pages ?? []) {
      const hit = page.items.find((item) => item.id === id);
      if (hit) return hit;
    }
  }
  return undefined;
}

/* ────────────────────────────── realtime ──────────────────────────────────── */

/**
 * Live inserts (D9). A pushed row is prepended ONLY when the reader is on the
 * first page with no filters applied — splicing into a filtered or paginated
 * list corrupts the cursor window, so every other case increments a counter and
 * the UI offers "N new" instead.
 *
 * Listener registration and teardown are paired in one effect (§0.3.7).
 */
export function useNotificationRealtime(
  workspaceId: string,
  args: { filters: NotificationFilters; limit: number; canPrepend: boolean },
) {
  const queryClient = useQueryClient();
  const accessToken = useAuthState((s) => s.accessToken);
  const [newSinceLoad, setNewSinceLoad] = useState(0);

  // Read through a ref so the socket subscription does not re-register on every
  // filter keystroke — re-subscribing per render is its own leak.
  const latest = useRef(args);
  latest.current = args;

  useEffect(() => {
    if (!accessToken || !workspaceEnabled(workspaceId)) return;
    const socket = getSocket();
    if (!socket) return;

    const onNew = (payload: Record<string, unknown>) => {
      queryClient.setQueryData<{ count: number }>(unreadKey(workspaceId), (prev) =>
        prev ? { count: prev.count + 1 } : prev,
      );
      void queryClient.invalidateQueries({ queryKey: ["notifications", "facets", workspaceId] });

      const { filters, limit, canPrepend } = latest.current;
      const unfiltered =
        filters.categories.length === 0 &&
        filters.status === "all" &&
        !filters.since &&
        !filters.archived &&
        !filters.q;

      if (!canPrepend || !unfiltered) {
        setNewSinceLoad((n) => n + 1);
        return;
      }

      // The socket payload carries the same fields the feed returns, so a
      // pushed row renders without a refetch.
      const item = payload as unknown as NotificationItem;
      if (!item?.id || (payload.workspaceId as string) !== workspaceId) {
        setNewSinceLoad((n) => n + 1);
        return;
      }

      queryClient.setQueryData<ListCache>(listKey(workspaceId, filters, limit), (data) => {
        if (!data || data.pages.length === 0) return data;
        const [first, ...rest] = data.pages;
        if (first.items.some((existing) => existing.id === item.id)) return data;
        return {
          ...data,
          pages: [{ ...first, items: [item, ...first.items] }, ...rest],
        };
      });
    };

    socket.on("notification:new", onNew);
    return () => {
      socket.off("notification:new", onNew);
    };
  }, [accessToken, workspaceId, queryClient]);

  /** Clicking "N new" resets to a fresh first page. */
  const flushNew = useCallback(() => {
    setNewSinceLoad(0);
    void queryClient.invalidateQueries({ queryKey: ["notifications", "list", workspaceId] });
  }, [queryClient, workspaceId]);

  return { newSinceLoad, flushNew };
}
