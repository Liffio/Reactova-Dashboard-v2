import { useCallback, useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { apiRequest } from "@/lib/api/http";
import { useDebounced } from "@/hooks/use-debounced";

/**
 * Client half of the server-side list contract.
 *
 * Every searchable list in the product goes through this. The screen holds no dataset — it holds a
 * page, a total, and the controls that produce the next request. There is deliberately no way to
 * ask this hook for "all rows", because that is the pattern the contract exists to remove.
 *
 * ## Why the URL still carries the query
 *
 * The transport is POST, which means the query lives in a request body rather than a URL. Left
 * there, refresh, browser back and shareable links all stop working — you lose your filters every
 * time you reload. So the hook mirrors its state into the route's search params independently of
 * how the request is sent. The URL is a client concern; the transport is a server one, and they do
 * not have to agree.
 */

export type FilterOp =
  | "eq"
  | "ne"
  | "in"
  | "contains"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "isNull";

export type ListFilter = { key: string; op: FilterOp; value?: unknown };

export type SortState = { key: string; dir: "asc" | "desc" };

export type Paged<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  pages: number;
};

export type ListRequestBody = {
  search?: { value: string };
  filters?: ListFilter[];
  sort?: SortState;
  page: number;
  limit: number;
};

/**
 * Persists list state in the address bar.
 *
 * Implemented against `history` rather than the router's typed search params because these screens
 * do not declare a `validateSearch` schema, and adding one to each route just to hold transient UI
 * state would be a lot of ceremony for a string. `replaceState` rather than `pushState`: typing in
 * a search box should not create a history entry per keystroke, or Back becomes unusable.
 */
function useUrlState(storageKey: string, enabled: boolean) {
  const read = useCallback((): Record<string, string> => {
    if (!enabled || typeof window === "undefined") return {};
    const params = new URLSearchParams(window.location.search);
    const raw = params.get(storageKey);
    if (!raw) return {};
    try {
      return JSON.parse(decodeURIComponent(raw)) as Record<string, string>;
    } catch {
      // A hand-edited or truncated URL must not break the page; fall back to defaults.
      return {};
    }
  }, [storageKey, enabled]);

  const write = useCallback(
    (state: Record<string, unknown>) => {
      if (!enabled || typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      const isEmpty = Object.keys(state).length === 0;
      if (isEmpty) params.delete(storageKey);
      else params.set(storageKey, encodeURIComponent(JSON.stringify(state)));

      const qs = params.toString();
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${qs ? `?${qs}` : ""}`,
      );
    },
    [storageKey, enabled],
  );

  return { read, write };
}

export type UseServerListOptions = {
  /** Endpoint path, e.g. `/api/v1/automations/search`. */
  path: string;
  /** react-query cache key prefix. Request state is appended automatically. */
  queryKey: string;
  defaultSort: SortState;
  defaultLimit?: number;
  /** Filters the screen controls rather than the user, e.g. a fixed tab. Not URL-persisted. */
  fixedFilters?: ListFilter[];
  /** Set false for a list embedded in a page that already owns the URL. */
  syncUrl?: boolean;
  enabled?: boolean;
};

export function useServerList<T>({
  path,
  queryKey,
  defaultSort,
  defaultLimit = 25,
  fixedFilters,
  syncUrl = true,
  enabled = true,
}: UseServerListOptions) {
  const url = useUrlState(queryKey, syncUrl);
  const initial = useMemo(() => url.read(), [url]);

  const [search, setSearch] = useState<string>(initial.q ?? "");
  const [filters, setFilters] = useState<ListFilter[]>(() => {
    try {
      return initial.f ? (JSON.parse(initial.f) as ListFilter[]) : [];
    } catch {
      return [];
    }
  });
  const [sort, setSort] = useState<SortState>(() =>
    initial.s && initial.d ? { key: initial.s, dir: initial.d as "asc" | "desc" } : defaultSort,
  );
  const [page, setPage] = useState<number>(Number(initial.p) > 0 ? Number(initial.p) : 1);
  const [limit, setLimit] = useState<number>(defaultLimit);

  const debouncedSearch = useDebounced(search);

  // Any change to what is being asked for resets to page 1. Without this, narrowing a 10-page
  // result to 2 pages while on page 7 shows an empty list that looks like "no results".
  const filterKey = JSON.stringify(filters);
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterKey, sort.key, sort.dir, limit]);

  useEffect(() => {
    url.write({
      ...(debouncedSearch ? { q: debouncedSearch } : {}),
      ...(filters.length ? { f: filterKey } : {}),
      ...(sort.key !== defaultSort.key || sort.dir !== defaultSort.dir
        ? { s: sort.key, d: sort.dir }
        : {}),
      ...(page > 1 ? { p: String(page) } : {}),
    });
    // `filterKey` stands in for `filters`, which is a new array identity each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, filterKey, sort.key, sort.dir, page]);

  const body: ListRequestBody = useMemo(
    () => ({
      ...(debouncedSearch ? { search: { value: debouncedSearch } } : {}),
      filters: [...(fixedFilters ?? []), ...filters],
      sort,
      page,
      limit,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debouncedSearch, filterKey, JSON.stringify(fixedFilters), sort.key, sort.dir, page, limit],
  );

  const query = useQuery({
    queryKey: [queryKey, body],
    queryFn: () => apiRequest<Paged<T>>(path, { method: "POST", body }),
    // Keeps the current page on screen while the next loads, rather than collapsing to a skeleton
    // on every keystroke.
    placeholderData: keepPreviousData,
    enabled,
  });

  /** Sets a filter, replacing any existing one on the same key. Pass `undefined` to clear it. */
  const setFilter = useCallback((key: string, op: FilterOp, value: unknown) => {
    setFilters((prev) => {
      const rest = prev.filter((f) => f.key !== key);
      if (value === undefined || value === null || value === "") return rest;
      return [...rest, { key, op, value }];
    });
  }, []);

  const getFilter = useCallback(
    (key: string) => filters.find((f) => f.key === key)?.value,
    [filters],
  );

  const toggleSort = useCallback((key: string) => {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }, []);

  const clear = useCallback(() => {
    setSearch("");
    setFilters([]);
    setSort(defaultSort);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultSort.key, defaultSort.dir]);

  const data = query.data;

  return {
    // Rows for the current page only. There is no "all items" here by design.
    items: data?.items ?? [],
    total: data?.total ?? 0,
    pages: data?.pages ?? 1,
    page: data?.page ?? page,
    limit: data?.limit ?? limit,

    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: query.refetch,

    search,
    setSearch,
    /** True while the typed term has not yet reached the server — for a subtle pending affordance. */
    searchPending: search !== debouncedSearch,

    filters,
    setFilter,
    getFilter,
    setFilters,

    sort,
    setSort,
    toggleSort,

    setPage,
    setLimit,
    clear,

    /** True when the user has narrowed the list, for "no results" vs "nothing here yet" copy. */
    isNarrowed: Boolean(debouncedSearch) || filters.length > 0,
  };
}
