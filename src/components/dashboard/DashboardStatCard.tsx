import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type DashboardStatCardProps = {
  icon: LucideIcon;
  label: string;
  value: number;
  trend?: number | null;
  sub?: string;
  highlight?: boolean;
  loading?: boolean;
};

export function DashboardStatCard({
  icon: Icon,
  label,
  value,
  trend,
  sub,
  highlight,
  loading,
}: DashboardStatCardProps) {
  const up = (trend ?? 0) >= 0;
  const hasTrend = trend !== undefined && trend !== null;

  if (loading) {
    return (
      <div className="surface-card p-4 pl-5 sm:p-5 sm:pl-6">
        <Skeleton className="h-3 w-24 mb-4" />
        <Skeleton className="h-9 w-20 mb-2" />
        <Skeleton className="h-3 w-32" />
      </div>
    );
  }

  return (
    <div className="surface-card p-4 pl-5 sm:p-5 sm:pl-6 flex flex-col min-h-[8.5rem]">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-[11px] sm:text-xs font-medium uppercase tracking-wide text-muted-foreground leading-tight">
          {label}
        </span>
        <div className="card-icon-badge h-8 w-8 sm:h-9 sm:w-9">
          <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
        </div>
      </div>
      <div
        className={cn(
          "glass-inset rounded-xl px-3 py-2.5 sm:py-3 flex-1 flex flex-col justify-center",
          highlight && "ring-1 ring-primary/25"
        )}
      >
        <p
          className={cn(
            "text-2xl sm:text-3xl font-bold tracking-tight tabular-nums",
            highlight ? "auth-ig-gradient-text" : "text-foreground"
          )}
        >
          {value.toLocaleString()}
        </p>
        {(hasTrend || sub) && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[11px] sm:text-xs">
            {hasTrend && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-semibold rounded-md px-1.5 py-0.5",
                  up ? "text-success bg-success/10" : "text-destructive bg-destructive/10"
                )}
              >
                {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(trend)}%
              </span>
            )}
            {sub && <span className="text-muted-foreground leading-snug">{sub}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
