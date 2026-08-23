import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LyraThinking } from "@/components/lyra-thinking";
import type { LyraError } from "@/lib/api/lyra-api";
import { cn } from "@/lib/utils";

const RESYNC_STATUS_LINES = [
  "Pulling your latest Instagram data…",
  "Cross-checking recent performance…",
  "Re-thinking your insights…",
  "Almost there…",
];

function useCooldownSeconds(until: number | null) {
  const [seconds, setSeconds] = useState(() =>
    until ? Math.ceil((until - Date.now()) / 1000) : 0,
  );
  useEffect(() => {
    if (!until) {
      setSeconds(0);
      return;
    }
    const tick = () => setSeconds(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [until]);
  return seconds;
}

export function InsightsCard<T>({
  title,
  data,
  isLoading,
  isRefreshing,
  isResyncing,
  refreshError,
  resyncError,
  refreshCooldownUntil,
  resyncCooldownUntil,
  lastUpdatedAt,
  loadingStartedAt,
  resyncStartedAt,
  onRefresh,
  onResync,
  onCancelRefresh,
  onCancelResync,
  renderBody,
  className,
  variant = "panel",
}: {
  title: string;
  data: T | null;
  isLoading: boolean;
  isRefreshing: boolean;
  isResyncing: boolean;
  refreshError: LyraError | null;
  resyncError: LyraError | null;
  refreshCooldownUntil: number | null;
  resyncCooldownUntil: number | null;
  lastUpdatedAt: number | null;
  loadingStartedAt: number | null;
  resyncStartedAt: number | null;
  onRefresh: () => void;
  onResync: () => void;
  onCancelRefresh: () => void;
  onCancelResync: () => void;
  renderBody: (data: T) => ReactNode;
  className?: string;
  /**
   * `panel` (default) is the wide, two-button card used by Analytics and Scheduler.
   *
   * `rail` is the ~340px dashboard right-rail form from the mockup: the actions move to a footer
   * beside the generated-at stamp, because two full-width buttons in the header wrap onto their
   * own line at that width and push the insight below the fold. Same data, same handlers — only
   * the chrome differs, so the three call sites cannot drift in behaviour.
   */
  variant?: "panel" | "rail";
}) {
  const refreshCooldown = useCooldownSeconds(refreshCooldownUntil);
  const resyncCooldown = useCooldownSeconds(resyncCooldownUntil);
  const busy = isRefreshing || isResyncing || isLoading;

  if (variant === "rail") {
    return (
      <Card className={cn("relative overflow-hidden", className)}>
        {/* The mockup's brand bloom in the top-right corner. Purely decorative, so it is hidden
            from assistive tech and never intercepts a click. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-[150px] w-[150px] rounded-full bg-brand-gradient opacity-[0.11] blur-[64px]"
        />
        <CardHeader className="space-y-0 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-brand-gradient">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </span>
            <CardTitle className="flex-1 text-[13.5px]">{title}</CardTitle>
            {/* Says which of two things you are reading: the current insight, or one being
                replaced. The mockup's chip is decorative; this one is not, because a stale
                insight that looks live is worse than no chip at all. */}
            <span
              className={cn(
                "inline-flex h-[19px] shrink-0 items-center rounded-full border px-[7px] text-[10px] font-semibold uppercase tracking-[0.04em]",
                busy
                  ? "border-border bg-muted text-muted-foreground"
                  : "border-success-edge bg-success-wash text-success",
              )}
            >
              {busy ? "Updating" : "Live"}
            </span>
          </div>
        </CardHeader>

        <CardContent className="relative space-y-3">
          {isLoading && (
            <LyraThinking
              status="thinking"
              startedAt={loadingStartedAt}
              onCancel={onCancelRefresh}
              size="sm"
            />
          )}

          {!isLoading && data && (
            <div
              key={lastUpdatedAt ?? "static"}
              className={cn(
                "space-y-3 transition-opacity",
                (isRefreshing || isResyncing) && "opacity-50",
              )}
            >
              {renderBody(data)}
            </div>
          )}

          {isResyncing && (
            <LyraThinking
              status="thinking"
              startedAt={resyncStartedAt}
              statusMessages={RESYNC_STATUS_LINES}
              onCancel={onCancelResync}
              size="sm"
            />
          )}

          {!isResyncing && refreshError && refreshCooldown === 0 && (
            <LyraThinking status="error" error={refreshError} onRetry={onRefresh} size="sm" />
          )}
          {!isResyncing && resyncError && resyncCooldown === 0 && (
            <LyraThinking status="error" error={resyncError} onRetry={onResync} size="sm" />
          )}

          {!isLoading && !data && !refreshError && (
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              No insights yet — Refresh to generate one.
            </p>
          )}

          <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3">
            <span className="min-w-0 truncate text-[10.5px] text-muted-foreground">
              {isLoading
                ? "Generating…"
                : lastUpdatedAt
                  ? `Generated ${formatDistanceToNow(lastUpdatedAt, { addSuffix: true })}`
                  : "Not generated yet"}
            </span>
            <div className="flex shrink-0 items-center gap-1">
              {/* Resync is icon-only here and labelled for screen readers — it is the rarer of the
                  two actions and its full label ("Resync from Instagram") does not fit. */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-[29px] w-[29px] p-0"
                title={
                  resyncCooldown > 0
                    ? `Resync from Instagram in ${resyncCooldown}s`
                    : "Resync from Instagram"
                }
                aria-label="Resync from Instagram"
                onClick={onResync}
                disabled={busy || resyncCooldown > 0}
              >
                <Sparkles className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-[29px] gap-1.5 px-2.5 text-xs"
                onClick={onRefresh}
                disabled={busy || refreshCooldown > 0}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
                {refreshCooldown > 0 ? `${refreshCooldown}s` : "Refresh"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-gradient">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </span>
          <CardTitle className="text-base">{title}</CardTitle>
          {lastUpdatedAt && !isLoading && (
            <span className="text-xs text-muted-foreground">
              · updated {formatDistanceToNow(lastUpdatedAt, { addSuffix: true })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={onRefresh}
            disabled={isRefreshing || isResyncing || isLoading || refreshCooldown > 0}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
            {refreshCooldown > 0 ? `Refresh in ${refreshCooldown}s` : "Refresh"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={onResync}
            disabled={isRefreshing || isResyncing || isLoading || resyncCooldown > 0}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {resyncCooldown > 0 ? `Resync in ${resyncCooldown}s` : "Resync from Instagram"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && (
          <LyraThinking status="thinking" startedAt={loadingStartedAt} onCancel={onCancelRefresh} />
        )}

        {!isLoading && data && (
          <div
            key={lastUpdatedAt ?? "static"}
            className={cn(
              "space-y-3 transition-opacity",
              (isRefreshing || isResyncing) && "opacity-50",
            )}
          >
            {renderBody(data)}
          </div>
        )}

        {isResyncing && (
          <LyraThinking
            status="thinking"
            startedAt={resyncStartedAt}
            statusMessages={RESYNC_STATUS_LINES}
            onCancel={onCancelResync}
          />
        )}

        {!isResyncing && refreshError && refreshCooldown === 0 && (
          <LyraThinking status="error" error={refreshError} onRetry={onRefresh} size="sm" />
        )}
        {!isResyncing && resyncError && resyncCooldown === 0 && (
          <LyraThinking status="error" error={resyncError} onRetry={onResync} size="sm" />
        )}

        {!isLoading && !data && !refreshError && (
          <p className="text-sm text-muted-foreground">
            No insights yet — click Refresh to generate one.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
