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
}) {
  const refreshCooldown = useCooldownSeconds(refreshCooldownUntil);
  const resyncCooldown = useCooldownSeconds(resyncCooldownUntil);

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
