import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { callLyra, type LyraError, type LyraTaskMap } from "@/lib/api/lyra-api";
import { lyraStorageKey, readLyraPersisted, writeLyraPersisted } from "@/lib/lyra-persist";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const REFRESH_COOLDOWN_MS = 5 * 60 * 1000;
const RESYNC_COOLDOWN_MS = 15 * 60 * 1000;

type InsightsTask = "insight" | "analytics";

/**
 * Drives an AI Insights surface (task `insight` or `analytics`): initial
 * fetch, a 2h background poll (paused while the tab is hidden — TanStack
 * Query's `refetchIntervalInBackground: false` already gives us Page
 * Visibility-aware pausing for free), a manual Refresh (5 min server
 * cooldown), and a heavier Resync (`options.resync`, 15 min cooldown).
 * The server is the source of truth for cooldowns — a RATE_LIMITED error's
 * `retryAfterSeconds` always overrides our optimistic local countdown.
 */
export function useLyraInsights<K extends InsightsTask>({
  task,
  workspaceId,
  userId,
  input,
  queryKeyExtra = [],
}: {
  task: K;
  workspaceId: string;
  /** Any stable per-account identifier (e.g. email) — scopes persisted state so a relogin as a different account never surfaces stale content. */
  userId?: string | null;
  input: LyraTaskMap[K]["input"];
  queryKeyExtra?: unknown[];
}) {
  const queryClient = useQueryClient();
  const queryKeyExtraJson = JSON.stringify(queryKeyExtra);
  const queryKey = useMemo(
    () => ["lyra-insights", task, workspaceId, ...queryKeyExtra],
    // queryKeyExtra is compared by its serialized form, not identity, since callers pass array literals inline
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [task, workspaceId, queryKeyExtraJson],
  );
  const persistKey = useMemo(
    () => lyraStorageKey(userId, workspaceId, `insights:${task}:${queryKeyExtraJson}`),
    [userId, workspaceId, task, queryKeyExtraJson],
  );

  const query = useQuery<LyraTaskMap[K]["output"], LyraError>({
    queryKey,
    queryFn: async ({ signal }) => {
      const result = await callLyra({ task, input, workspaceId, signal });
      return result.content;
    },
    enabled: Boolean(workspaceId) && workspaceId !== "default",
    staleTime: Infinity,
    refetchInterval: TWO_HOURS_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    retry: false,
    // Shows the last persisted result instantly on mount (refresh/relogin)
    // instead of a blank loading state, while still fetching fresh data in
    // the background — placeholderData never marks the query as "fresh".
    // Cast: TS can't distribute react-query's NonFunctionGuard over the
    // unresolved generic K here; the runtime type is correct via the
    // explicit useQuery<LyraTaskMap[K]["output"], LyraError> above.
    placeholderData: (() =>
      readLyraPersisted<LyraTaskMap[K]["output"]>(persistKey) ?? undefined) as never,
  });

  useEffect(() => {
    if (query.data && !query.isPlaceholderData) {
      writeLyraPersisted(persistKey, query.data);
    }
  }, [query.data, query.isPlaceholderData, persistKey]);

  const [refreshCooldownUntil, setRefreshCooldownUntil] = useState<number | null>(null);
  const [resyncCooldownUntil, setResyncCooldownUntil] = useState<number | null>(null);
  const [isResyncing, setIsResyncing] = useState(false);
  const [resyncError, setResyncError] = useState<LyraError | null>(null);
  const [loadingStartedAt, setLoadingStartedAt] = useState<number | null>(null);
  const [resyncStartedAt, setResyncStartedAt] = useState<number | null>(null);
  const resyncAbortRef = useRef<AbortController | null>(null);

  const isFetching = query.isFetching;
  useEffect(() => {
    setLoadingStartedAt((prev) => (isFetching ? (prev ?? Date.now()) : null));
  }, [isFetching]);

  useEffect(() => {
    if (query.error?.code === "RATE_LIMITED" && query.error.retryAfterSeconds) {
      setRefreshCooldownUntil(Date.now() + query.error.retryAfterSeconds * 1000);
    }
  }, [query.error]);

  const refresh = useCallback(async () => {
    const result = await query.refetch();
    if (!result.error) {
      setRefreshCooldownUntil(Date.now() + REFRESH_COOLDOWN_MS);
    }
  }, [query]);

  const cancelRefresh = useCallback(() => {
    void queryClient.cancelQueries({ queryKey });
  }, [queryClient, queryKey]);

  const resync = useCallback(async () => {
    setResyncError(null);
    setIsResyncing(true);
    setResyncStartedAt(Date.now());
    const controller = new AbortController();
    resyncAbortRef.current = controller;
    try {
      const result = await callLyra({
        task,
        input,
        workspaceId,
        options: { resync: true },
        signal: controller.signal,
      });
      queryClient.setQueryData(queryKey, result.content);
      const now = Date.now();
      setResyncCooldownUntil(now + RESYNC_COOLDOWN_MS);
      setRefreshCooldownUntil(now + REFRESH_COOLDOWN_MS);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const lyraErr = err as LyraError;
      setResyncError(lyraErr);
      if (lyraErr.code === "RATE_LIMITED" && lyraErr.retryAfterSeconds) {
        setResyncCooldownUntil(Date.now() + lyraErr.retryAfterSeconds * 1000);
      }
    } finally {
      setIsResyncing(false);
      setResyncStartedAt(null);
      if (resyncAbortRef.current === controller) resyncAbortRef.current = null;
    }
  }, [task, input, workspaceId, queryClient, queryKey]);

  const cancelResync = useCallback(() => {
    resyncAbortRef.current?.abort();
  }, []);

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isRefreshing: query.isFetching && !query.isLoading,
    isResyncing,
    refreshError: query.error,
    resyncError,
    refreshCooldownUntil,
    resyncCooldownUntil,
    lastUpdatedAt: query.dataUpdatedAt || null,
    loadingStartedAt,
    resyncStartedAt,
    refresh,
    resync,
    cancelRefresh,
    cancelResync,
  };
}
