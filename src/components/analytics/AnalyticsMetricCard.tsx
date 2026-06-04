import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type AnalyticsMetricCardProps = {
  icon: LucideIcon;
  label: string;
  value: number | string;
  description?: string;
  loading?: boolean;
  className?: string;
};

export function AnalyticsMetricCard({
  icon: Icon,
  label,
  value,
  description,
  loading,
  className,
}: AnalyticsMetricCardProps) {
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="border-0 pb-0">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent className="p-6 pt-2">
          <Skeleton className="h-8 w-16 mb-2" />
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-0 pb-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      </CardHeader>
      <CardContent className={cn("p-6 pt-2", !description && "pb-6")}>
        <p className="text-2xl font-semibold tabular-nums tracking-tight">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        {description ? <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{description}</p> : null}
      </CardContent>
    </Card>
  );
}
