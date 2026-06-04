import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export type SummaryMetric = {
  label: string;
  value: string;
  hint?: string;
};

export function AnalyticsSummaryBar({
  metrics,
  loading,
}: {
  metrics: SummaryMetric[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const cols =
    metrics.length <= 3
      ? "sm:grid-cols-3"
      : metrics.length === 4
        ? "sm:grid-cols-2 lg:grid-cols-4"
        : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6";

  return (
    <Card>
      <CardContent
        className={`grid grid-cols-1 divide-y sm:divide-y-0 sm:divide-x p-0 ${cols}`}
      >
        {metrics.map((metric) => (
          <div key={metric.label} className="px-6 py-5">
            <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{metric.value}</p>
            {metric.hint ? (
              <p className="mt-1 text-xs text-muted-foreground">{metric.hint}</p>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
