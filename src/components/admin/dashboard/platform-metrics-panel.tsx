import { useState } from "react";
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
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  DollarSign,
  Inbox,
  Instagram,
  Users,
} from "lucide-react";

import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PlanDonutCard } from "@/components/admin/dashboard/plan-donut-card";
import { FeatureUsageCard } from "@/components/admin/dashboard/feature-usage-card";
import { usePlatformCan } from "@/hooks/use-platform-authz";
import { cn } from "@/lib/utils";
import { formatNum, formatMoneyCents, formatDateTime } from "@/lib/format";
import {
  ADMIN_DASHBOARD_RANGES,
  deltaFraction,
  getAdminDashboardOverview,
  type AdminDashboardRange,
  type WindowPair,
} from "@/lib/api/admin-dashboard-api";

const chartDay = (day: string) => day.slice(5);

const CHART_TOOLTIP_STYLE = {
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--popover)",
  fontSize: 12,
} as const;

function DeltaPill({ pair }: { pair: WindowPair | undefined }) {
  const delta = deltaFraction(pair);
  if (typeof delta !== "number") return null;
  const positive = delta >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium",
        positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
      )}
    >
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {(positive ? "+" : "") + (delta * 100).toFixed(1)}%
    </span>
  );
}

const subscriptionStatusStyles: Record<string, string> = {
  ACTIVE: "bg-success/10 text-success",
  TRIALING: "bg-success/10 text-success",
  PAST_DUE: "border-warning/30 bg-warning/10 text-warning",
  PAUSED: "bg-muted text-muted-foreground",
  CANCELED: "bg-destructive/10 text-destructive",
};

function SectionLabel({ children }: { children: string }) {
  return (
    <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </h2>
  );
}

/**
 * Platform-wide metrics for the superadmin, embedded at the top of the main dashboard.
 * Renders nothing for anyone without `platform:metrics_read` — the backend independently
 * denies the data either way.
 */
export function PlatformMetricsPanel() {
  const canRead = usePlatformCan("platform:metrics_read");
  const [range, setRange] = useState<AdminDashboardRange>("30d");

  const overviewQuery = useQuery({
    queryKey: ["admin-dashboard-overview", range],
    queryFn: () => getAdminDashboardOverview(range),
    enabled: canRead,
    staleTime: 30_000,
  });

  if (!canRead) return null;

  const data = overviewQuery.data;
  const isLoading = overviewQuery.isLoading;

  const inrMrr = data?.revenue.mrr.byCurrency.find((c) => c.currency === "inr");
  const pendingTotal = data
    ? data.pending.affiliatePayouts +
      data.pending.affiliateKyc +
      data.pending.creatorApplications +
      data.pending.marketingCreatorApplications
    : 0;

  return (
    <section className="space-y-6 border-b pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Platform admin
          </p>
          <h2 className="font-display text-xl font-semibold tracking-tight">Platform overview</h2>
          <p className="text-sm text-muted-foreground">
            Growth, revenue, plan mix and feature usage across all tenants.
          </p>
        </div>
        <div className="flex gap-2">
          {ADMIN_DASHBOARD_RANGES.map((r) => (
            <Button
              key={r}
              variant={range === r ? "default" : "outline"}
              size="sm"
              onClick={() => setRange(r)}
            >
              {r}
            </Button>
          ))}
        </div>
      </div>

      {overviewQuery.isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {(overviewQuery.error as Error).message}
        </div>
      )}

      {/* Summary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading || !data ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <StatCard
              label="Total users"
              value={formatNum(data.users.total)}
              delta={deltaFraction(data.users.newInPeriod)}
              icon={Users}
              hint={`+${formatNum(data.users.newInPeriod.current)} this period`}
            />
            <StatCard
              label="MRR (est.)"
              value={formatMoneyCents(data.revenue.mrr.usdCents)}
              icon={DollarSign}
              hint={
                inrMrr
                  ? `+${formatMoneyCents(inrMrr.monthlyMinorUnits, "INR")}/mo · ARR ${formatMoneyCents(data.revenue.arrUsdCents)}`
                  : `ARR ${formatMoneyCents(data.revenue.arrUsdCents)}`
              }
            />
            <StatCard
              label="Paid workspaces"
              value={formatNum(data.plans.paidCount)}
              icon={Building2}
              hint={`${formatNum(data.plans.freeCount)} free · ${formatNum(data.workspaces.total)} total`}
            />
            <StatCard
              label="IG accounts"
              value={formatNum(data.workspaces.igAccounts.total)}
              delta={deltaFraction(data.workspaces.igAccounts.newInPeriod)}
              icon={Instagram}
              hint={`+${formatNum(data.workspaces.igAccounts.newInPeriod.current)} connected this period`}
            />
          </>
        )}
      </div>

      {/* Users & growth */}
      <SectionLabel>Users & growth</SectionLabel>
      <div className="rounded-2xl border bg-card p-6 shadow-soft">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-display text-lg font-semibold">Signups</h3>
            <p className="text-sm text-muted-foreground">New users per day · {range}</p>
          </div>
          <div className="flex items-center gap-2">
            <DeltaPill pair={data?.users.newInPeriod} />
            <span className="text-xs text-muted-foreground">
              {formatNum(data?.users.activeInPeriod.current ?? 0)} active users
            </span>
          </div>
        </div>
        <div className="h-[240px] w-full">
          {isLoading ? (
            <Skeleton className="h-full w-full rounded-xl" />
          ) : (
            <ResponsiveContainer>
              <AreaChart
                data={data?.users.signupTrend ?? []}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="platformSignups" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 6" vertical={false} />
                <XAxis
                  dataKey="day"
                  tickFormatter={chartDay}
                  interval="preserveStartEnd"
                  tickLine={false}
                  axisLine={false}
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="signups"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#platformSignups)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Plans & revenue */}
      <SectionLabel>Plans & revenue</SectionLabel>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border bg-card p-6 shadow-soft lg:col-span-2">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-lg font-semibold">Revenue collected</h3>
              <p className="text-sm text-muted-foreground">Paid invoices per day · {range}</p>
            </div>
            <div className="flex items-center gap-2">
              <DeltaPill pair={data?.revenue.collectedInPeriod} />
              <span className="text-xs text-muted-foreground">
                {formatMoneyCents(data?.revenue.collectedInPeriod.current ?? 0)} this period
              </span>
            </div>
          </div>
          <div className="h-[240px] w-full">
            {isLoading ? (
              <Skeleton className="h-full w-full rounded-xl" />
            ) : (
              <ResponsiveContainer>
                <AreaChart
                  data={data?.revenue.collectedTrend ?? []}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="platformCollected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 6" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tickFormatter={chartDay}
                    interval="preserveStartEnd"
                    tickLine={false}
                    axisLine={false}
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                  />
                  <YAxis
                    tickFormatter={(v: number) => `$${formatNum(v / 100)}`}
                    tickLine={false}
                    axisLine={false}
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatMoneyCents(value), "collected"]}
                    contentStyle={CHART_TOOLTIP_STYLE}
                  />
                  <Area
                    type="monotone"
                    dataKey="amountCents"
                    name="collected"
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    fill="url(#platformCollected)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <PlanDonutCard
          plans={data?.plans}
          workspaceTotal={data?.workspaces.total ?? 0}
          isLoading={isLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-6 shadow-soft">
          <div className="mb-5">
            <h3 className="font-display text-lg font-semibold">Revenue by plan</h3>
            <p className="text-sm text-muted-foreground">Paid invoices · {range}</p>
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {(() => {
                const rows = (data?.revenue.byPlanInPeriod ?? [])
                  .filter((r) => r.amountCents > 0)
                  .sort((a, b) => b.amountCents - a.amountCents);
                if (rows.length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground">
                      No paid invoices in this period yet.
                    </p>
                  );
                }
                const max = rows[0].amountCents;
                return rows.map((r, i) => (
                  <div key={r.plan ?? "unattributed"}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium capitalize">
                        {(r.plan ?? "unattributed").toLowerCase()}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatMoneyCents(r.amountCents)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min((r.amountCents / max) * 100, 100)}%`,
                          background: `linear-gradient(90deg, var(--chart-${(i % 5) + 1}), var(--primary))`,
                        }}
                      />
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
          {data && (
            <div className="mt-5 space-y-1 border-t pt-3 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Cancellations this period</span>
                <span className="flex items-center gap-2 tabular-nums">
                  {formatNum(data.revenue.cancellations.current)}
                  <DeltaPill pair={data.revenue.cancellations} />
                </span>
              </div>
              <div className="flex justify-between">
                <span>Collected all-time</span>
                <span className="tabular-nums">
                  {formatMoneyCents(data.revenue.totalPaidAllTimeCents)}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-soft">
          <div className="mb-4">
            <h3 className="font-display text-lg font-semibold">Subscription activity</h3>
            <p className="text-sm text-muted-foreground">Based on last subscription update</p>
          </div>
          {isLoading ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : (data?.plans.recentActivity.length ?? 0) === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/20 p-8 text-center">
              <Inbox className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
              <p className="text-sm font-medium">No subscription activity yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data?.plans.recentActivity.map((row) => (
                <div
                  key={`${row.workspaceId}-${row.updatedAt}`}
                  className="flex flex-wrap items-center gap-2 border-b pb-3 text-sm last:border-0 last:pb-0"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{row.workspaceName}</span>
                  <Badge variant="outline" className="capitalize">
                    {row.plan.toLowerCase()}
                    {row.interval ? ` · ${row.interval}` : ""}
                  </Badge>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      subscriptionStatusStyles[row.status] ?? "bg-muted text-muted-foreground",
                    )}
                  >
                    {row.cancelAtPeriodEnd && row.status === "ACTIVE"
                      ? "cancels at period end"
                      : row.status.toLowerCase()}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {formatDateTime(row.updatedAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Feature usage */}
      <SectionLabel>Feature usage</SectionLabel>
      <FeatureUsageCard features={data?.features} isLoading={isLoading} />

      {/* Health & operations */}
      <SectionLabel>Health & operations</SectionLabel>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-6 shadow-soft">
          <div className="mb-4">
            <h3 className="font-display text-lg font-semibold">Platform health</h3>
            <p className="text-sm text-muted-foreground">Job queues and delivery failures</p>
          </div>
          {isLoading ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="pb-2 pr-2 font-medium">Queue</th>
                      <th className="pb-2 pr-2 text-right font-medium">Waiting</th>
                      <th className="pb-2 pr-2 text-right font-medium">Active</th>
                      <th className="pb-2 text-right font-medium">Failed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.health.queues ?? []).map((q) => (
                      <tr key={q.name} className="border-b last:border-0">
                        <td className="py-2 pr-2">
                          <span className="flex items-center gap-2">
                            {q.name}
                            {!q.available && (
                              <Badge variant="outline" className="text-[10px]">
                                unavailable
                              </Badge>
                            )}
                          </span>
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums">
                          {q.available ? formatNum(q.waiting) : "—"}
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums">
                          {q.available ? formatNum(q.active) : "—"}
                        </td>
                        <td
                          className={cn(
                            "py-2 text-right tabular-nums",
                            q.available && q.failed > 0 && "font-medium text-destructive",
                          )}
                        >
                          {q.available ? formatNum(q.failed) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                <span>
                  DM jobs failed this period:{" "}
                  <span
                    className={cn(
                      "tabular-nums",
                      (data?.health.dmJobsFailedInPeriod ?? 0) > 0 && "text-destructive",
                    )}
                  >
                    {formatNum(data?.health.dmJobsFailedInPeriod ?? 0)}
                  </span>
                </span>
                <span>
                  Posts failed this period:{" "}
                  <span
                    className={cn(
                      "tabular-nums",
                      (data?.health.scheduledPostsFailedInPeriod ?? 0) > 0 && "text-destructive",
                    )}
                  >
                    {formatNum(data?.health.scheduledPostsFailedInPeriod ?? 0)}
                  </span>
                </span>
              </div>
            </>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-soft">
          <div className="mb-4">
            <h3 className="font-display text-lg font-semibold">Needs attention</h3>
            <p className="text-sm text-muted-foreground">
              {pendingTotal > 0 ? `${formatNum(pendingTotal)} items awaiting review` : "All clear"}
            </p>
          </div>
          {isLoading ? (
            <Skeleton className="h-24 rounded-xl" />
          ) : (
            <div className="space-y-2 text-sm">
              {(
                [
                  ["Affiliate payout requests", data?.pending.affiliatePayouts ?? 0],
                  ["Affiliate KYC submissions", data?.pending.affiliateKyc ?? 0],
                  ["Creator applications", data?.pending.creatorApplications ?? 0],
                  [
                    "Marketing creator applications",
                    data?.pending.marketingCreatorApplications ?? 0,
                  ],
                ] as Array<[string, number]>
              ).map(([label, count]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
                      count > 0
                        ? "border border-warning/30 bg-warning/10 text-warning"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {formatNum(count)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
