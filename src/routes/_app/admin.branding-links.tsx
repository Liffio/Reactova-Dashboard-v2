import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import {
  AlertCircle,
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  Download,
  MousePointerClick,
  Percent,
  Search,
  UserPlus,
  Wallet,
} from "lucide-react";
import { toast } from "@/lib/toast";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformPermissionRoute } from "@/components/auth/guards";
import { PageErrorBoundary } from "@/components/error-boundary";
import { StatCard } from "@/components/dashboard/stat-card";
import { DateRangePicker, type DashboardDateRange } from "@/components/dashboard/date-range-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { stateStyles } from "@/components/admin/creator-detail-shared";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/http";
import { formatNum } from "@/lib/format";
import { useDebounced } from "@/hooks/use-debounced";
import {
  exportBrandingLinksCsv,
  fetchBrandingList,
  fetchBrandingOverview,
  type BrandingLinkRow,
  type BrandingScope,
} from "@/lib/api/admin-branding-links-api";

const BRANDING_READ = "platform:branding_read";
const PAGE_SIZE = 25;

export const Route = createFileRoute("/_app/admin/branding-links")({
  head: () => ({ meta: [{ title: "Branding links — Liffio admin" }] }),
  component: BrandingLinksPage,
  validateSearch: (search: Record<string, unknown>) => ({
    scope: search.scope === "creator" ? ("creator" as const) : ("free" as const),
    from: typeof search.from === "string" ? search.from : undefined,
    to: typeof search.to === "string" ? search.to : undefined,
  }),
});

function BrandingLinksPage() {
  return (
    <PlatformPermissionRoute permission={BRANDING_READ}>
      <PageErrorBoundary label="admin-branding-links">
        <BrandingLinksContent />
      </PageErrorBoundary>
    </PlatformPermissionRoute>
  );
}

/** `{preset}` → concrete `YYYY-MM-DD` bounds — `/overview` and `/list` only accept `from`/`to`,
 *  not a rolling preset, so a chosen preset is resolved to explicit dates before it ever reaches
 *  the URL. That also keeps a shared link exact rather than "whatever today - 7d happens to be". */
function presetToRange(preset: "7d" | "30d" | "90d"): { start: string; end: string } {
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  const end = new Date();
  const start = subDays(end, days - 1);
  return { start: format(start, "yyyy-MM-dd"), end: format(end, "yyyy-MM-dd") };
}

function ErrorPanel({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  const message = error instanceof Error ? error.message : "Couldn't load branding links.";
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-8 text-center">
      <AlertCircle className="mx-auto mb-2 h-6 w-6 text-destructive" />
      <p className="text-sm font-medium text-destructive">{message}</p>
      {requestId && (
        <p className="mt-2 text-xs text-muted-foreground">
          Request ID: <span className="font-mono">{requestId}</span> — quote this when reporting.
        </p>
      )}
      <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function BrandingLinksContent() {
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();

  const dateRangeValue: DashboardDateRange | null =
    search.from && search.to ? { start: search.from, end: search.to } : null;

  const handleDateChange = (next: DashboardDateRange | null) => {
    if (!next) {
      void navigate({ search: (prev) => ({ ...prev, from: undefined, to: undefined }) });
      return;
    }
    const { start, end } = "preset" in next ? presetToRange(next.preset) : next;
    void navigate({ search: (prev) => ({ ...prev, from: start, to: end }) });
  };

  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportBrandingLinksCsv({
        scope: search.scope,
        from: search.from,
        to: search.to,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `branding-links-${search.scope}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Platform admin"
        title="Branding links"
        description="Free-tier and Creator branding surfaces — clicks, signups, and funnel conversion. The two tabs are separate data by construction, never merged."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker
              value={dateRangeValue}
              onChange={handleDateChange}
              clearLabel="All time"
              placeholderLabel="All time"
            />
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={exporting}
              onClick={() => void handleExport()}
            >
              <Download className="h-4 w-4" />
              {exporting ? "Exporting…" : "Export CSV"}
            </Button>
          </div>
        }
      />

      <div className="space-y-6 p-4 sm:p-6 md:p-10">
        <Tabs
          value={search.scope}
          onValueChange={(v) =>
            void navigate({
              search: (prev) => ({ ...prev, scope: v === "creator" ? "creator" : "free" }),
            })
          }
        >
          <TabsList className="mb-4">
            <TabsTrigger value="free">Free tier</TabsTrigger>
            <TabsTrigger value="creator">Creator</TabsTrigger>
          </TabsList>
          <TabsContent value="free">
            <ScopePanel scope="free" from={search.from} to={search.to} />
          </TabsContent>
          <TabsContent value="creator">
            <ScopePanel scope="creator" from={search.from} to={search.to} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

type SortField = "humanClicks" | "signups" | "conversionRate" | "paidConversions";

function SortHeader({
  label,
  value,
  sort,
  dir,
  onSort,
}: {
  label: string;
  value: SortField;
  sort: SortField;
  dir: "asc" | "desc";
  onSort: (value: SortField) => void;
}) {
  const active = sort === value;
  return (
    <button
      type="button"
      onClick={() => onSort(value)}
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground",
        active && "text-foreground",
      )}
    >
      {label}
      {active ? (
        dir === "asc" ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )
      ) : (
        <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
      )}
    </button>
  );
}

/** One tab's data: overview tiles + sortable table + pager. Never fed the other scope's rows —
 *  each tab owns its own queries, keyed on `scope`, so free and creator can never cross-pollute. */
function ScopePanel({ scope, from, to }: { scope: BrandingScope; from?: string; to?: string }) {
  const navigate = useNavigate();
  const [sort, setSort] = useState<SortField>("humanClicks");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const q = useDebounced(searchInput, 300);

  // Any filter change starts back at page 1 — otherwise a narrower result set can leave the view
  // stranded on a page that no longer exists.
  useEffect(() => {
    setPage(1);
  }, [scope, from, to, q, sort, dir]);

  const overviewQuery = useQuery({
    queryKey: ["admin-branding-overview", scope, from, to],
    queryFn: () => fetchBrandingOverview({ scope, from, to }),
  });

  const listQuery = useQuery({
    queryKey: ["admin-branding-list", scope, from, to, sort, dir, page, q],
    queryFn: () =>
      fetchBrandingList({ scope, from, to, sort, dir, page, limit: PAGE_SIZE, q: q || undefined }),
    placeholderData: keepPreviousData,
  });

  const overview = overviewQuery.data;
  const humanClicks = Number(overview?.humanClicks ?? 0);
  const botClicks = Number(overview?.botClicks ?? 0);
  const signups = Number(overview?.signups ?? 0);
  const paidConversions = Number(overview?.paidConversions ?? 0);
  const conversionRate = humanClicks > 0 ? (paidConversions / humanClicks) * 100 : 0;

  const rows = listQuery.data?.rows ?? [];
  // The endpoint returns no total, so "more pages" is inferred from a full page coming back —
  // a short final page (or an empty one) means there is nothing after it.
  const hasMore = rows.length === PAGE_SIZE;

  const toggleSort = (field: SortField) => {
    if (sort === field) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(field);
      setDir("desc");
    }
  };

  const openLink = (linkId: string) => {
    void navigate({ to: "/admin/branding-links/$linkId", params: { linkId } });
  };

  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overviewQuery.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <StatCard
              label="Human clicks"
              value={formatNum(humanClicks)}
              icon={MousePointerClick}
              hint={`${formatNum(botClicks)} bot clicks filtered`}
            />
            <StatCard label="Signups" value={formatNum(signups)} icon={UserPlus} />
            <StatCard
              label="Conversion %"
              value={`${conversionRate.toFixed(1)}%`}
              icon={Percent}
              hint="clicks → paid"
            />
            <StatCard label="Paid conversions" value={formatNum(paidConversions)} icon={Wallet} />
          </>
        )}
      </section>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={
            scope === "free" ? "Search by workspace or owner email…" : "Search by creator email…"
          }
          className="pl-9"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      {listQuery.isError ? (
        <ErrorPanel error={listQuery.error} onRetry={() => void listQuery.refetch()} />
      ) : listQuery.isLoading && rows.length === 0 ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (
        <div className="rounded-2xl border bg-card shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                  {scope === "free" ? (
                    <>
                      <th className="px-6 py-3 font-medium">Workspace</th>
                      <th className="px-4 py-3 font-medium">Owner email</th>
                    </>
                  ) : (
                    <>
                      <th className="px-6 py-3 font-medium">Creator email</th>
                      <th className="px-4 py-3 font-medium">State</th>
                    </>
                  )}
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">
                    <SortHeader
                      label="Clicks"
                      value="humanClicks"
                      sort={sort}
                      dir={dir}
                      onSort={toggleSort}
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">
                    <SortHeader
                      label="Signups"
                      value="signups"
                      sort={sort}
                      dir={dir}
                      onSort={toggleSort}
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">
                    <SortHeader
                      label="Conv %"
                      value="conversionRate"
                      sort={sort}
                      dir={dir}
                      onSort={toggleSort}
                    />
                  </th>
                  <th className="px-6 py-3 font-medium">
                    <SortHeader
                      label="Paid"
                      value="paidConversions"
                      sort={sort}
                      dir={dir}
                      onSort={toggleSort}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row: BrandingLinkRow) => (
                  <tr
                    key={row.id}
                    onClick={() => openLink(row.id)}
                    className="cursor-pointer border-b last:border-0 hover:bg-muted/30"
                  >
                    {scope === "free" ? (
                      <>
                        <td className="px-6 py-3.5 font-medium">{row.workspaceName ?? "—"}</td>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground">
                          {row.ownerEmail ?? "—"}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-3.5 font-medium">{row.creatorEmail ?? "—"}</td>
                        <td className="px-4 py-3.5">
                          {row.creatorState ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px]",
                                stateStyles[row.creatorState] ??
                                  "border-border bg-muted text-muted-foreground",
                              )}
                            >
                              {row.creatorState}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3.5 font-mono text-xs">{row.code}</td>
                    <td className="px-4 py-3.5 tabular-nums">
                      {formatNum(Number(row.humanClicks))}
                    </td>
                    <td className="px-4 py-3.5 tabular-nums">{formatNum(Number(row.signups))}</td>
                    <td className="px-4 py-3.5 tabular-nums">
                      {Number(row.conversionRate).toFixed(1)}%
                    </td>
                    <td className="px-6 py-3.5 tabular-nums">
                      {formatNum(Number(row.paidConversions))}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && !listQuery.isFetching && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-sm text-muted-foreground">
                      No {scope === "free" ? "workspace" : "creator"} branding links in this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t p-3">
            <p className="text-xs text-muted-foreground">Page {page}</p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2"
                disabled={!hasMore}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
