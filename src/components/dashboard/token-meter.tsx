import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Sparkles, X } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { getTokenBalance } from "@/lib/api/ai-tokens-api";

/** Sticks in sessionStorage per workspace+period so the toast fires once per threshold
 *  crossing, not on every 60s poll — and naturally resets once the period rolls over
 *  (the key includes periodEnd). */
function nudgeKey(workspaceId: string, periodEnd: string): string {
  return `ai-token-nudge:${workspaceId}:${periodEnd}`;
}

/** Small Lyra AI token usage meter — same card language as StatCard, refetched
 *  periodically since this workspace has no live socket client yet. */
export function TokenMeter({ workspaceId }: { workspaceId: string }) {
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ["ai-token-balance", workspaceId],
    queryFn: () => getTokenBalance(workspaceId),
    enabled: Boolean(workspaceId) && workspaceId !== "default",
    refetchInterval: 60_000,
  });

  const balance = query.data?.balance;

  const pctUsed = balance
    ? balance.unlimited
      ? 0
      : balance.allocated + balance.bonus > 0
        ? Math.min(100, Math.round((balance.consumed / (balance.allocated + balance.bonus)) * 100))
        : 100
    : 0;

  // Dismissing the 80% notice only hides it for this mount — a reload or the next
  // poll tick that still finds usage >= 80% brings it back, so it "recurs" rather
  // than being permanently silenced.
  const [notice80Dismissed, setNotice80Dismissed] = useState(false);

  useEffect(() => {
    if (!balance || balance.unlimited) return;
    const threshold = pctUsed >= 100 ? 100 : pctUsed >= 80 ? 80 : null;
    if (!threshold) return;

    const key = nudgeKey(workspaceId, balance.periodEnd);
    const alreadyShown = Number(sessionStorage.getItem(key) ?? "0");
    if (threshold <= alreadyShown) return;

    toast(
      threshold === 100
        ? "You've used all your Lyra AI tokens for this period"
        : "You've used 80% of your Lyra AI tokens for this period",
      {
        description: "Upgrade your plan for a larger monthly allowance.",
        action: {
          label: "Upgrade",
          onClick: () => void navigate({ to: "/billings" }),
        },
      },
    );
    sessionStorage.setItem(key, String(threshold));
  }, [balance, pctUsed, workspaceId, navigate]);

  if (query.isLoading) {
    return <Skeleton className="h-32 rounded-2xl" />;
  }
  if (!balance) return null;

  const nearLimit = !balance.unlimited && pctUsed >= 80;
  const atLimit = !balance.unlimited && pctUsed >= 100;
  const showNotice80 = nearLimit && !atLimit && !notice80Dismissed;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-soft transition-shadow hover:shadow-glow"
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Lyra AI Tokens
          </span>
          <span className="font-display text-2xl font-semibold tracking-tight">
            {balance.unlimited
              ? "Unlimited"
              : `${balance.consumed.toLocaleString()} / ${(balance.allocated + balance.bonus).toLocaleString()}`}
          </span>
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-accent-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
      </div>

      {!balance.unlimited && (
        <div className="mt-3 space-y-1.5">
          <Progress
            value={pctUsed}
            className={cn(nearLimit && "bg-destructive/15 [&>div]:bg-destructive")}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{pctUsed}% used this period</span>
            <span>Resets {new Date(balance.periodEnd).toLocaleDateString()}</span>
          </div>
        </div>
      )}

      {/* Persistent — no dismiss — generation calls are actually blocked at this point. */}
      {atLimit && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">
            Token limit reached — Lyra generation is blocked until reset.
          </span>
          <Link
            to="/billings"
            className="shrink-0 rounded-full border border-destructive/30 px-2 py-0.5 font-medium transition-colors hover:bg-destructive/20"
          >
            Upgrade
          </Link>
        </div>
      )}

      {/* Dismissible for this session, but reappears next time usage is still >= 80%. */}
      {showNotice80 && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">Approaching your monthly token limit.</span>
          <Link
            to="/billings"
            className="shrink-0 rounded-full border border-warning/30 px-2 py-0.5 font-medium transition-colors hover:bg-warning/20"
          >
            Upgrade
          </Link>
          <button
            type="button"
            onClick={() => setNotice80Dismissed(true)}
            className="shrink-0 text-warning/70 hover:text-warning"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </motion.div>
  );
}
