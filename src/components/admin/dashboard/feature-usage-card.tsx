import { useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatNum } from "@/lib/format";
import { deltaFraction, type AdminDashboardOverview } from "@/lib/api/admin-dashboard-api";

type Mode = "adoption" | "volume";

const BASIS_MARK: Record<string, string> = {
  "all-time-state": "†",
  "volume-only": "‡",
};

/**
 * Ranked "best feature" list. Adoption ranks by % of active workspaces using the feature;
 * volume ranks by period event counts with a period-over-period delta. Bases differ per feature
 * (see footnote markers), so the payload labels each row rather than pretending one rule fits all.
 */
export function FeatureUsageCard({
  features,
  isLoading,
}: {
  features: AdminDashboardOverview["features"] | undefined;
  isLoading: boolean;
}) {
  const [mode, setMode] = useState<Mode>("adoption");

  const items = [...(features?.items ?? [])].sort((a, b) => {
    if (mode === "adoption") {
      // Volume-only rows have no adoption story; keep them at the bottom instead of ranking 0%.
      if ((a.adoptionBasis === "volume-only") !== (b.adoptionBasis === "volume-only")) {
        return a.adoptionBasis === "volume-only" ? 1 : -1;
      }
      return b.adoptionPct - a.adoptionPct;
    }
    return b.volume.current - a.volume.current;
  });

  const maxMeasure = Math.max(
    1,
    ...items.map((i) => (mode === "adoption" ? i.adoptionPct : i.volume.current)),
  );

  const hasStateBasis = items.some((i) => i.adoptionBasis === "all-time-state");
  const hasVolumeOnly = items.some((i) => i.adoptionBasis === "volume-only");

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-soft">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Feature usage</h2>
          <p className="text-sm text-muted-foreground">
            {mode === "adoption"
              ? `Share of ${formatNum(features?.denominator ?? 0)} active workspaces using each feature`
              : "Event volume this period vs the previous one"}
          </p>
        </div>
        <div className="flex gap-2">
          {(["adoption", "volume"] as Mode[]).map((m) => (
            <Button
              key={m}
              variant={mode === m ? "default" : "outline"}
              size="sm"
              onClick={() => setMode(m)}
              className="capitalize"
            >
              {m}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-9 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => {
            const measure = mode === "adoption" ? item.adoptionPct : item.volume.current;
            const width = Math.min((measure / maxMeasure) * 100, 100);
            const delta = mode === "volume" ? deltaFraction(item.volume) : undefined;
            const positive = (delta ?? 0) >= 0;
            return (
              <div key={item.key}>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium">
                    {item.label}
                    {BASIS_MARK[item.adoptionBasis] && (
                      <sup className="ml-0.5 text-muted-foreground">
                        {BASIS_MARK[item.adoptionBasis]}
                      </sup>
                    )}
                  </span>
                  <span className="flex items-center gap-2 tabular-nums text-muted-foreground">
                    {mode === "adoption"
                      ? item.adoptionBasis === "volume-only"
                        ? "n/a"
                        : `${formatNum(item.adoptedWorkspaces)} ws · ${item.adoptionPct.toFixed(1)}%`
                      : `${formatNum(item.volume.current)} ${item.volumeLabel}`}
                    {typeof delta === "number" && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium",
                          positive
                            ? "bg-success/10 text-success"
                            : "bg-destructive/10 text-destructive",
                        )}
                      >
                        {positive ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3" />
                        )}
                        {(positive ? "+" : "") + (delta * 100).toFixed(1)}%
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${width}%`,
                      background: `linear-gradient(90deg, var(--chart-${(i % 5) + 1}), var(--primary))`,
                    }}
                  />
                </div>
              </div>
            );
          })}
          {(hasStateBasis || hasVolumeOnly) && (
            <p className="pt-2 text-[11px] leading-relaxed text-muted-foreground">
              {hasStateBasis && (
                <>† adoption counts current state (live page / ≥2 members), not period activity. </>
              )}
              {hasVolumeOnly && <>‡ user-scoped program — volume only, no workspace adoption %.</>}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
