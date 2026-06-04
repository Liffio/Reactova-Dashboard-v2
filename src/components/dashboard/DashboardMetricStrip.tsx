import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type DashboardMetricItem = {
  id: string;
  icon: LucideIcon;
  label: string;
  value: number;
  trend?: number | null;
  sub?: string;
};

export function DashboardMetricStrip({
  metrics,
  loading,
}: {
  metrics: DashboardMetricItem[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <section className="dashboard-metrics surface-card overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-4">
          {metrics.map((m) => (
            <div key={m.id} className="dashboard-metric-cell p-4 sm:p-5">
              <Skeleton className="h-3 w-16 mb-3" />
              <Skeleton className="h-8 w-14" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="dashboard-metrics surface-card overflow-hidden" aria-label="Key metrics">
      <div className="dashboard-metrics-head">
        <h3 className="text-sm font-semibold text-foreground">This month</h3>
        <span className="text-xs text-muted-foreground">Updated from live workspace data</span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          const up = (metric.trend ?? 0) >= 0;
          const hasTrend = metric.trend !== undefined && metric.trend !== null;

          return (
            <div
              key={metric.id}
              className={cn(
                "dashboard-metric-cell",
                index > 0 && "border-t border-border/40 lg:border-t-0 lg:border-l"
              )}
            >
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs font-medium uppercase tracking-wide">{metric.label}</span>
              </div>
              <p className="text-2xl sm:text-3xl font-bold tabular-nums tracking-tight text-foreground">
                {metric.value.toLocaleString()}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 min-h-[1.25rem]">
                {hasTrend && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 text-[11px] font-semibold rounded px-1.5 py-0.5",
                      up ? "text-muted-foreground bg-muted" : "text-muted-foreground bg-muted"
                    )}
                  >
                    {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {Math.abs(metric.trend)}%
                  </span>
                )}
                {metric.sub && (
                  <span className="text-[11px] text-muted-foreground">{metric.sub}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
