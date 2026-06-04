import type { AnalyticsPageResponse } from "@/hooks/useAnalytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const STEPS: Array<{ key: keyof AnalyticsPageResponse["funnel"]; label: string }> = [
  { key: "commentsReceived", label: "Comments" },
  { key: "keywordMatched", label: "Keyword match" },
  { key: "dmsSent", label: "DMs sent" },
  { key: "linkClicked", label: "Link clicks" },
  { key: "saleAttributed", label: "Sales" },
];

export function AnalyticsFunnel({
  funnel,
  loading,
}: {
  funnel: AnalyticsPageResponse["funnel"] | undefined;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-base font-semibold">Conversion funnel</CardTitle>
        <CardDescription>Comment → DM → click (sales attribution coming soon)</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : funnel ? (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {STEPS.map((step, index) => {
              const value = funnel[step.key];
              const prev = index > 0 ? funnel[STEPS[index - 1].key] : null;
              const drop =
                prev && prev > 0 ? Math.max(0, Math.round(((prev - value) / prev) * 100)) : null;
              return (
                <div key={step.key} className="rounded-lg border border-border px-3 py-3 text-center sm:text-left">
                  <p className="text-xs text-muted-foreground">{step.label}</p>
                  <p className="text-xl font-semibold tabular-nums mt-1">{value.toLocaleString()}</p>
                  {drop !== null && drop > 0 ? (
                    <p className="text-[11px] text-muted-foreground mt-0.5">{drop}% vs prior</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
