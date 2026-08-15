import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MessageCircle, MousePointerClick, TrendingUp, UserPlus } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { ProtectedRoute } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getAnalyticsPage } from "@/lib/api/analytics-api";
import {
  DateRangePicker,
  rangeKey,
  rangeLabel,
  rangeQueryParams,
  type DashboardDateRange,
} from "@/components/dashboard/date-range-picker";
import { formatNum } from "@/lib/format";
import { useApp } from "@/state/app-context";
import { InsightsCard } from "@/components/lyra/insights-card";
import {
  InsightSummary,
  InsightPointList,
  AnalyticsHighlight,
} from "@/components/lyra/insight-content";
import { useLyraInsights } from "@/hooks/use-lyra-insights";

export const Route = createFileRoute("/_app/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Liffio" }] }),
  component: AnalyticsRoute,
});

function AnalyticsRoute() {
  return (
    <ProtectedRoute module="analytics">
      <AnalyticsPage />
    </ProtectedRoute>
  );
}

const roiStyles: Record<string, string> = {
  high: "border-success/30 bg-success/10 text-success",
  medium: "border-warning/30 bg-warning/10 text-warning",
  low: "border-border bg-muted text-muted-foreground",
};

function AnalyticsPage() {
  const { current, user } = useApp();
  const workspaceId = current.id;
  const [range, setRange] = useState<DashboardDateRange>({ preset: "30d" });
  const periodLabel = rangeLabel(range).toLowerCase();

  const analyticsQuery = useQuery({
    queryKey: ["analytics-page", workspaceId, rangeKey(range)],
    queryFn: () => getAnalyticsPage(workspaceId, rangeQueryParams(range)),
    enabled: Boolean(workspaceId) && workspaceId !== "default",
  });

  const insights = useLyraInsights({
    task: "analytics",
    workspaceId,
    userId: user?.id,
    input: { period: "preset" in range && range.preset === "7d" ? "weekly" : "monthly" },
    queryKeyExtra: [rangeKey(range)],
  });

  const data = analyticsQuery.data;

  const series = (data?.lineSeries ?? []).map((point, i) => ({
    day: point.day,
    dms: point.value,
    clicks: data?.clickLineSeries[i]?.value ?? 0,
    leads: data?.leadLineSeries[i]?.value ?? 0,
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Analytics"
        description="DM delivery, link clicks, lead capture and conversion across your funnels."
        actions={
          <DateRangePicker value={range} onChange={(next) => setRange(next ?? { preset: "30d" })} />
        }
      />

      <div className="space-y-6 p-4 sm:p-6 md:p-10">
        {analyticsQuery.isError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {(analyticsQuery.error as Error).message}
          </div>
        )}

        <InsightsCard
          title="AI Insights"
          data={insights.data}
          isLoading={insights.isLoading}
          isRefreshing={insights.isRefreshing}
          isResyncing={insights.isResyncing}
          refreshError={insights.refreshError}
          resyncError={insights.resyncError}
          refreshCooldownUntil={insights.refreshCooldownUntil}
          resyncCooldownUntil={insights.resyncCooldownUntil}
          lastUpdatedAt={insights.lastUpdatedAt}
          loadingStartedAt={insights.loadingStartedAt}
          resyncStartedAt={insights.resyncStartedAt}
          onRefresh={() => void insights.refresh()}
          onResync={() => void insights.resync()}
          onCancelRefresh={insights.cancelRefresh}
          onCancelResync={insights.cancelResync}
          renderBody={(data) => (
            <>
              <InsightSummary text={data.summary} />
              <InsightPointList
                tone="highlight"
                items={data.highlights}
                renderItem={(item) => (
                  <AnalyticsHighlight
                    finding={item.finding}
                    metric={item.metric}
                    severity={item.severity}
                  />
                )}
              />
            </>
          )}
        />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {analyticsQuery.isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))
          ) : (
            <>
              <StatCard
                label="DMs sent"
                value={formatNum(data?.summary.totalDmsSent ?? 0)}
                icon={MessageCircle}
                hint={`${(data?.summary.dmDeliveryRate ?? 0).toFixed(1)}% delivered`}
              />
              <StatCard
                label="Link clicks"
                value={formatNum(data?.summary.totalLinkClicks ?? 0)}
                icon={MousePointerClick}
                hint={`${(data?.rates.clickRate ?? 0).toFixed(1)}% click rate`}
              />
              <StatCard
                label="Leads captured"
                value={formatNum(data?.summary.leadsCaptured ?? 0)}
                icon={UserPlus}
                hint={`${(data?.rates.leadRate ?? 0).toFixed(1)}% lead rate`}
              />
              <StatCard
                label="Conversion rate"
                value={`${(data?.summary.conversionRate ?? 0).toFixed(1)}%`}
                icon={TrendingUp}
                hint="DM → click"
              />
            </>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border bg-card p-6 shadow-soft lg:col-span-2">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold">Activity</h2>
                <p className="text-sm text-muted-foreground">
                  DMs, clicks and leads · {periodLabel}
                </p>
              </div>
              <div className="flex gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--chart-1)]" />
                  DMs
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--chart-4)]" />
                  Clicks
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--chart-3)]" />
                  Leads
                </span>
              </div>
            </div>
            <div className="h-[260px] w-full">
              {analyticsQuery.isLoading ? (
                <Skeleton className="h-full w-full rounded-xl" />
              ) : (
                <ResponsiveContainer>
                  <AreaChart data={series} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dms" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="clicks" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-4)" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="var(--chart-4)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="leads" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-3)" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="var(--chart-3)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 6" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tickLine={false}
                      axisLine={false}
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        background: "var(--popover)",
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="dms"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      fill="url(#dms)"
                    />
                    <Area
                      type="monotone"
                      dataKey="clicks"
                      stroke="var(--chart-4)"
                      strokeWidth={2}
                      fill="url(#clicks)"
                    />
                    <Area
                      type="monotone"
                      dataKey="leads"
                      stroke="var(--chart-3)"
                      strokeWidth={2}
                      fill="url(#leads)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-6 shadow-soft">
            <div className="mb-5">
              <h2 className="font-display text-lg font-semibold">Conversion funnel</h2>
              <p className="text-sm text-muted-foreground">Comment → sale · {periodLabel}</p>
            </div>
            <div className="space-y-3">
              {data &&
                (
                  [
                    ["Comments received", data.funnel.commentsReceived],
                    ["Keyword matched", data.funnel.keywordMatched],
                    ["DMs sent", data.funnel.dmsSent],
                    ["Link clicked", data.funnel.linkClicked],
                    ["Sale attributed", data.funnel.saleAttributed],
                  ] as Array<[string, number]>
                ).map(([stage, value], i, all) => {
                  const max = all[0][1] || 1;
                  const pct = Math.min((value / max) * 100, 100);
                  return (
                    <div key={stage}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium">{stage}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {formatNum(value)} · {pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            background: `linear-gradient(90deg, var(--chart-${(i % 5) + 1}), var(--primary))`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              {!data && !analyticsQuery.isLoading && (
                <p className="text-sm text-muted-foreground">No data for this range yet.</p>
              )}
            </div>

            {data && data.topKeywords.length > 0 && (
              <>
                <h3 className="mb-2 mt-6 text-sm font-semibold">Top keywords</h3>
                <div className="flex flex-wrap gap-1.5">
                  {data.topKeywords.slice(0, 8).map((k) => (
                    <span
                      key={k.keyword}
                      className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] font-medium tracking-wide"
                    >
                      {k.keyword} · {formatNum(k.value)}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        <section className="rounded-2xl border bg-card shadow-soft">
          <div className="border-b px-6 py-4">
            <h2 className="font-display text-lg font-semibold">Automation performance</h2>
            <p className="text-sm text-muted-foreground">
              Per-automation DM, click and lead results in this range.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-3 font-medium">Automation</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">DMs</th>
                  <th className="px-4 py-3 text-right font-medium">Clicks</th>
                  <th className="px-4 py-3 text-right font-medium">Leads</th>
                  <th className="px-4 py-3 text-right font-medium">Conv.</th>
                  <th className="px-6 py-3 text-right font-medium">ROI</th>
                </tr>
              </thead>
              <tbody>
                {(data?.automationPerformance ?? []).map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="px-6 py-3">
                      <div className="font-medium">{row.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.keyword ? `"${row.keyword}"` : "Any comment"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {row.status.toLowerCase()}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatNum(row.dmsSent)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatNum(row.linkClicks)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatNum(row.leadsCaptured)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.conversionRate.toFixed(1)}%
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Badge variant="outline" className={roiStyles[row.roiBand]}>
                        {row.roiBand}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {(data?.automationPerformance.length ?? 0) === 0 && !analyticsQuery.isLoading && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-10 text-center text-sm text-muted-foreground"
                    >
                      No automation activity in this range yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
