import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/admin/form-page";
import { formatNum, formatMoneyCents } from "@/lib/format";
import type { AdminDashboardOverview, PlanKey } from "@/lib/api/admin-dashboard-api";

/** Stable plan → chart-token mapping so FREE is always the same hue across renders and ranges. */
const PLAN_COLORS: Record<PlanKey, string> = {
  FREE: "var(--chart-5)",
  STARTER: "var(--chart-4)",
  PRO: "var(--chart-1)",
  BUSINESS: "var(--chart-2)",
  AGENCY: "var(--chart-3)",
};

export function PlanDonutCard({
  plans,
  workspaceTotal,
  isLoading,
  formatMoney = formatMoneyCents,
}: {
  plans: AdminDashboardOverview["plans"] | undefined;
  workspaceTotal: number;
  isLoading: boolean;
  /** Currency-aware formatter from the panel; defaults to plain USD. */
  formatMoney?: (usdCents: number) => string;
}) {
  const slices = (plans?.distribution ?? []).filter((d) => d.count > 0);

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-soft">
      <div className="mb-5">
        <h2 className="font-display text-lg font-semibold">Plan distribution</h2>
        <p className="text-sm text-muted-foreground">Every workspace, including implicit Free</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-[300px] w-full rounded-xl" />
      ) : workspaceTotal === 0 ? (
        <EmptyState icon={PieChartIcon} title="No workspaces yet">
          Plan distribution appears once the first workspace exists.
        </EmptyState>
      ) : (
        <>
          <div className="relative mx-auto h-[180px] w-full max-w-[220px]">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="count"
                  nameKey="plan"
                  innerRadius="62%"
                  outerRadius="88%"
                  paddingAngle={2}
                  stroke="var(--card)"
                  strokeWidth={2}
                >
                  {slices.map((s) => (
                    <Cell key={s.plan} fill={PLAN_COLORS[s.plan]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [formatNum(value), name]}
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--popover)",
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="text-center">
                <div className="font-display text-2xl font-semibold tabular-nums">
                  {formatNum(workspaceTotal)}
                </div>
                <div className="text-xs text-muted-foreground">workspaces</div>
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {(plans?.distribution ?? []).map((d) => {
              const bestSubs = plans?.bestBySubscribers?.plan === d.plan;
              const bestRevenue = plans?.bestByRevenue?.plan === d.plan;
              return (
                <div key={d.plan} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: PLAN_COLORS[d.plan] }}
                  />
                  <span className="font-medium capitalize">{d.plan.toLowerCase()}</span>
                  {bestSubs && (
                    <Badge variant="secondary" className="text-[10px]">
                      Most subscribers
                    </Badge>
                  )}
                  {bestRevenue && (
                    <Badge variant="secondary" className="text-[10px]">
                      Top revenue
                    </Badge>
                  )}
                  <span className="ml-auto tabular-nums text-muted-foreground">
                    {formatNum(d.count)} · {d.pct.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>

          {plans?.bestByRevenue && (
            <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
              Top revenue plan collected {formatMoney(plans.bestByRevenue.revenueCents)} this
              period.
            </p>
          )}
        </>
      )}
    </div>
  );
}
