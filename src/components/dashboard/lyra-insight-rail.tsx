import { InsightsCard } from "@/components/lyra/insights-card";
import { useLyraInsights } from "@/hooks/use-lyra-insights";
import { cn } from "@/lib/utils";

/**
 * The Lyra insight card as it appears in the dashboard's right rail.
 *
 * ## Why this is not the Analytics card with a narrower parent
 *
 * The shared `InsightsCard` body used on Analytics and Scheduler leads with `InsightSummary`,
 * which draws its own gradient panel and its own sparkle orb. Directly under the card's orb
 * header that reads as two headers, and inside a ~340px rail the panel's padding leaves room for
 * about four words a line.
 *
 * The mockup's rail card is a different shape for a reason: one orb, a plain paragraph, then a
 * dotted list. Findings and recommendations both become bullets, distinguished by the colour of
 * the dot rather than by another nested container — at this width every border costs more than it
 * separates.
 *
 * The card chrome, the cooldowns and both actions still come from `InsightsCard` (`variant="rail"`),
 * so this file decides presentation only and cannot drift from how the other two surfaces behave.
 */

function Bullet({ tone, children }: { tone: "insight" | "action"; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-[12.5px] leading-[1.55] text-muted-foreground">
      <span
        aria-hidden
        className={cn(
          "mt-[7px] h-[5px] w-[5px] shrink-0 rounded-full",
          tone === "insight" ? "bg-primary" : "bg-chart-2",
        )}
      />
      <span className="min-w-0">{children}</span>
    </li>
  );
}

export function LyraInsightRail({
  workspaceId,
  userId,
}: {
  workspaceId: string;
  userId?: string | null;
}) {
  const insights = useLyraInsights({
    task: "insight",
    workspaceId,
    userId,
    input: { focus: "business_insights" },
    // Unchanged from when this lived in the main column — the key scopes persisted insight state,
    // so altering it would strand whatever a user already has cached.
    queryKeyExtra: ["dashboard"],
  });

  return (
    <InsightsCard
      variant="rail"
      title="Lyra insight"
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
      className="shadow-soft"
      renderBody={(data) => (
        <>
          <p className="text-[13px] leading-[1.62]">{data.summary}</p>

          {(data.insights.length > 0 || data.recommendations.length > 0) && (
            <ul className="flex flex-col gap-2.5 pt-1">
              {data.insights.map((item, i) => (
                <Bullet key={`i-${i}`} tone="insight">
                  {item.finding}
                  {/* The metric is the evidence for the finding, so it sits with it rather than in
                      a badge the eye has to travel to. */}
                  {item.metric ? (
                    <span className="text-foreground/70"> · {item.metric}</span>
                  ) : null}
                </Bullet>
              ))}
              {data.recommendations.map((item, i) => (
                <Bullet key={`r-${i}`} tone="action">
                  <span className="text-foreground">{item.action}</span>
                  {item.expectedImpact ? ` — ${item.expectedImpact}` : null}
                </Bullet>
              ))}
            </ul>
          )}
        </>
      )}
    />
  );
}
