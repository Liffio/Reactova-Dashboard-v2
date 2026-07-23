import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  Loader2,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Search,
  Stethoscope,
} from "lucide-react";
import { toast } from "@/lib/toast";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformAdminRoute } from "@/components/auth/guards";
import { PageErrorBoundary } from "@/components/error-boundary";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  bulkAdminCreatorAction,
  exportAdminCreators,
  getAdminCreatorAnalytics,
  getAdminCreatorOverview,
  listAdminCreatorsManaged,
  parseRate,
  type AdminCreatorListItem,
  type BulkCreatorAction,
} from "@/lib/api/admin-creator-eligibility-api";
import { stateStyles } from "@/components/admin/creator-detail-shared";

export const Route = createFileRoute("/_app/admin/creator-management")({
  validateSearch: (search: Record<string, unknown>): { search?: string; state?: string } => ({
    search: typeof search.search === "string" ? search.search : undefined,
    state: typeof search.state === "string" ? search.state : undefined,
  }),
  head: () => ({ meta: [{ title: "Creator Management — Admin" }] }),
  component: AdminCreatorManagementRoute,
});

function AdminCreatorManagementRoute() {
  return (
    <PlatformAdminRoute>
      <PageErrorBoundary label="admin-creator-management">
        <AdminCreatorManagementPage />
      </PageErrorBoundary>
    </PlatformAdminRoute>
  );
}

const STATES = ["NotEligible", "Eligible", "Active", "NeedsAttention", "Paused"];

/** Analytics rate/percentage fields arrive as numeric strings from the live API — coerce before formatting. */
function pct(v: number | string | null | undefined): string {
  return parseRate(v).toFixed(1);
}

function AdminCreatorManagementPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Platform admin"
        title="Creator Management"
        description="Search, filter, and manage every creator profile — additive to the Review Queue, not a replacement for it."
      />
      <div className="space-y-6 p-4 sm:p-6 md:p-10">
        <OverviewCards />
        <Tabs defaultValue="creators">
          <TabsList className="mb-4">
            <TabsTrigger value="creators">Creators</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
          <TabsContent value="creators">
            <CreatorTable />
          </TabsContent>
          <TabsContent value="analytics">
            <AnalyticsView />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function OverviewCards() {
  const overviewQuery = useQuery({
    queryKey: ["admin-creator-overview"],
    queryFn: getAdminCreatorOverview,
    refetchInterval: 60_000,
  });
  const analyticsQuery = useQuery({
    queryKey: ["admin-creator-analytics"],
    queryFn: getAdminCreatorAnalytics,
  });

  if (overviewQuery.isLoading) {
    return <Skeleton className="h-24 w-full rounded-2xl" />;
  }

  if (overviewQuery.isError) {
    return (
      <div className="rounded-2xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        Overview stats aren't available right now
        {(overviewQuery.error as Error)?.message
          ? ` — ${(overviewQuery.error as Error).message}`
          : "."}
      </div>
    );
  }

  // Defensive: don't assume the response shape is exactly as documented — a
  // truthy body missing `profilesByState` (a differently-shaped or partial
  // response) shouldn't crash the page, just render as zeros.
  const o = overviewQuery.data;
  const profilesByState: Partial<Record<string, number>> = o?.profilesByState ?? {};
  const snapshot = analyticsQuery.data?.snapshot;
  const total = Object.values(profilesByState).reduce((a: number, b) => a + (b ?? 0), 0);

  return (
    <div className="space-y-2">
      <section className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Total creators" value={String(total)} icon={Database} />
        <StatCard label="Active" value={String(profilesByState.Active ?? 0)} />
        <StatCard label="Needs attention" value={String(profilesByState.NeedsAttention ?? 0)} />
        <StatCard label="Paused" value={String(profilesByState.Paused ?? 0)} />
        <StatCard label="Not eligible" value={String(profilesByState.NotEligible ?? 0)} />
        <StatCard label="Pending reviews" value={String(o?.pendingReviewCount ?? 0)} />
        <StatCard
          label="Auto-approval rate"
          value={snapshot ? `${pct(snapshot.approvalRate)}%` : "—"}
        />
        <StatCard
          label="Manual review rate"
          value={snapshot ? `${pct(snapshot.manualReviewPct)}%` : "—"}
        />
      </section>
      <p className="text-xs text-muted-foreground">
        "Applications today" isn't in ENDPOINT-CONTRACT.md's overview or analytics response —
        omitted rather than computed client-side.
      </p>
    </div>
  );
}

const QUERY_KEY = "admin-creators-managed";

function CreatorTable() {
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState(search.search ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<BulkCreatorAction | null>(null);
  const [enumerating, setEnumerating] = useState(false);

  // Debounce free-text search into the URL (shareable/bookmarkable per spec 6.3).
  useEffect(() => {
    const handle = setTimeout(() => {
      if (searchInput !== (search.search ?? "")) {
        void navigate({ search: (prev) => ({ ...prev, search: searchInput || undefined }) });
      }
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const listQuery = useInfiniteQuery({
    queryKey: [QUERY_KEY, search.search, search.state],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      listAdminCreatorsManaged({
        limit: 25,
        cursor: pageParam,
        search: search.search,
        state: search.state,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  // Defensive against a page coming back without a well-formed `items` array
  // (e.g. a differently-shaped response) — treat it as empty rather than
  // crashing the whole table on `.map`.
  const rows: AdminCreatorListItem[] = useMemo(
    () => listQuery.data?.pages.flatMap((p) => (Array.isArray(p?.items) ? p.items : [])) ?? [],
    [listQuery.data],
  );

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    void queryClient.invalidateQueries({ queryKey: ["admin-creator-overview"] });
  };

  const bulkMutation = useMutation({
    mutationFn: (action: BulkCreatorAction) => bulkAdminCreatorAction(action, Array.from(selected)),
    onSuccess: (res, action) => {
      const results = Array.isArray(res?.results) ? res.results : [];
      const okCount = results.filter((r) => r.ok).length;
      const failCount = results.length - okCount;
      if (failCount === 0) {
        toast.success(`${actionLabel(action)}: ${okCount} succeeded`);
      } else {
        toast.warning(`${actionLabel(action)}: ${okCount} succeeded, ${failCount} failed`, {
          description: results
            .filter((r) => !r.ok)
            .slice(0, 3)
            .map((r) => r.error)
            .join(" · "),
        });
      }
      setSelected(new Set());
      setConfirmAction(null);
      invalidateAll();
    },
    onError: (e) => {
      toast.error((e as Error).message);
      setConfirmAction(null);
    },
  });

  const exportMutation = useMutation({
    mutationFn: () => exportAdminCreators({ state: search.state, search: search.search }),
    onSuccess: (res) => {
      const items = Array.isArray(res?.items) ? res.items : [];
      downloadCsv(items);
      toast.success(`Exported ${items.length} creator${items.length === 1 ? "" : "s"}`);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allLoadedSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAllLoaded = () => {
    setSelected((prev) => {
      if (allLoadedSelected) return new Set();
      const next = new Set(prev);
      rows.forEach((r) => next.add(r.id));
      return next;
    });
  };

  // No total-count / list-all primitive in the contract's cursor pagination — enumerate
  // pages up to a safety cap rather than assume the API can answer "how many match".
  const SELECT_ALL_PAGE_CAP = 20;
  const selectAllMatchingFilter = async () => {
    setEnumerating(true);
    try {
      const ids = new Set<string>();
      let cursor: string | undefined;
      let pages = 0;
      do {
        const page = await listAdminCreatorsManaged({
          limit: 100,
          cursor,
          search: search.search,
          state: search.state,
        });
        (Array.isArray(page?.items) ? page.items : []).forEach((it) => ids.add(it.id));
        cursor = page?.nextCursor ?? undefined;
        pages += 1;
      } while (cursor && pages < SELECT_ALL_PAGE_CAP);
      setSelected(ids);
      if (cursor) {
        toast.warning(
          `Selected first ${ids.size} matching creators (stopped at ${SELECT_ALL_PAGE_CAP} pages — more may match)`,
        );
      } else {
        toast.success(`Selected all ${ids.size} matching creators`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnumerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name or email…"
            className="h-8 w-64 pl-8 text-xs"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <Select
          value={search.state ?? "all"}
          onValueChange={(v) =>
            void navigate({ search: (prev) => ({ ...prev, state: v === "all" ? undefined : v }) })
          }
        >
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="All states" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All states</SelectItem>
            {STATES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs"
          disabled={enumerating}
          onClick={() => void selectAllMatchingFilter()}
        >
          {enumerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Select all matching filter
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs"
          disabled={exportMutation.isPending}
          onClick={() => exportMutation.mutate()}
        >
          <Download className="h-3.5 w-3.5" />
          {exportMutation.isPending ? "Exporting…" : "Export filtered (CSV)"}
        </Button>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setConfirmAction("pause")}
            >
              <PauseCircle className="h-3.5 w-3.5" /> Bulk pause
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setConfirmAction("reactivate")}
            >
              <PlayCircle className="h-3.5 w-3.5" /> Bulk reactivate
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setConfirmAction("force-metrics-sync")}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Bulk metrics sync
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setConfirmAction("force-health-check")}
            >
              <Stethoscope className="h-3.5 w-3.5" /> Bulk health check
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border bg-card shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="w-10 px-4 py-3">
                  <Checkbox checked={allLoadedSelected} onCheckedChange={toggleAllLoaded} />
                </th>
                <th className="px-4 py-3 font-medium">Creator</th>
                <th className="px-4 py-3 font-medium">State</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">State since</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Profile created</th>
                <th className="px-4 py-3 font-medium text-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selected.has(r.id)}
                      onCheckedChange={() => toggleRow(r.id)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.userName || "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.userEmail}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={stateStyles[r.state] ?? ""}>
                      {r.state}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-xs text-muted-foreground">
                    {new Date(r.stateSince).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" asChild>
                      <Link to="/admin/creator-management/$profileId" params={{ profileId: r.id }}>
                        <ExternalLink className="h-3 w-3" /> Open
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !listQuery.isLoading && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm text-muted-foreground">
                    No creators match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {listQuery.isLoading && (
          <div className="p-6">
            <Skeleton className="h-40 w-full" />
          </div>
        )}
        {listQuery.isError && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {(listQuery.error as Error)?.message || "Couldn't load creators."}
          </div>
        )}
        {listQuery.hasNextPage && (
          <div className="flex justify-center border-t p-4">
            <Button
              size="sm"
              variant="outline"
              disabled={listQuery.isFetchingNextPage}
              onClick={() => void listQuery.fetchNextPage()}
            >
              {listQuery.isFetchingNextPage ? "Loading…" : "Load more"}
            </Button>
          </div>
        )}
      </div>

      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction ? actionLabel(confirmAction) : ""} {selected.size} creator
              {selected.size === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This runs individually per creator — one failure won't block the rest of the batch.
              You'll see a summary of successes and failures when it's done.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (confirmAction) bulkMutation.mutate(confirmAction);
              }}
            >
              {bulkMutation.isPending ? "Running…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function actionLabel(action: BulkCreatorAction): string {
  switch (action) {
    case "pause":
      return "Pause";
    case "reactivate":
      return "Reactivate";
    case "force-health-check":
      return "Force health check on";
    case "force-metrics-sync":
      return "Force metrics sync on";
  }
}

function downloadCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return;
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `creators-export-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function AnalyticsView() {
  const analyticsQuery = useQuery({
    queryKey: ["admin-creator-analytics"],
    queryFn: getAdminCreatorAnalytics,
  });

  if (analyticsQuery.isLoading) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }
  if (analyticsQuery.isError) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center text-sm text-muted-foreground">
        {(analyticsQuery.error as Error)?.message || "Couldn't load analytics."}
      </div>
    );
  }

  const snapshot = analyticsQuery.data?.snapshot;
  if (!snapshot) {
    return (
      <div className="rounded-2xl border bg-muted/30 p-10 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">
          No analytics snapshot yet — it's computed by a background job on a ~15 minute cadence
          (ENDPOINT-CONTRACT.md §6.12) and hasn't run since this was deployed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Snapshot as of {new Date(snapshot.computedAt).toLocaleString()} — refreshes roughly every 15
        minutes, not live per-request.
      </p>
      <section className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard
          label="Approval rate"
          value={`${pct(snapshot.approvalRate)}%`}
          icon={CheckCircle2}
        />
        <StatCard label="Rejection rate" value={`${pct(snapshot.rejectionRate)}%`} />
        <StatCard label="Avg. eligibility score" value={pct(snapshot.avgEligibilityScore)} />
        <StatCard label="Active creators" value={`${pct(snapshot.activeCreatorPct)}%`} />
        <StatCard label="Healthy creators" value={`${pct(snapshot.healthyCreatorPct)}%`} />
        <StatCard label="Monthly compliance" value={`${pct(snapshot.monthlyCompliancePct)}%`} />
        <StatCard label="Paused" value={`${pct(snapshot.pausedPct)}%`} />
        <StatCard label="Reactivation rate" value={`${pct(snapshot.reactivationPct)}%`} />
        <StatCard label="Manual review rate" value={`${pct(snapshot.manualReviewPct)}%`} />
      </section>
      <div className="rounded-2xl border bg-muted/30 p-4 text-xs text-muted-foreground">
        "Top DM Senders" and "Most Active Creators" ranked lists from the frontend spec aren't in
        ENDPOINT-CONTRACT.md §6.12's analytics snapshot (which is rates/percentages only, no
        per-creator rankings) — not rendered here rather than derived by sorting the full creator
        list client-side.
        <br />
        <span className="mt-1 block">
          Note: <code>reactivationPct</code> is a documented approximation (event-count based, not a
          true per-profile lifecycle join) — see §6.12's known limitations.
        </span>
      </div>
    </div>
  );
}
