import { useQuery } from "@tanstack/react-query";

import { Skeleton } from "@/components/ui/skeleton";
import { formatNum } from "@/lib/format";
import { getWorkspaceLimits, type ResolvedLimit } from "@/lib/api/entitlement-api";
import { isWorkspaceReady } from "@/lib/api/active-workspace";

/**
 * The caps this workspace is actually held to.
 *
 * The Billing page's plan cards advertise the numbers a tier is *sold* with. Those come from the
 * plan definition, while enforcement resolves them through the package catalogue and any
 * workspace-level override — so a workspace on a custom package could read "25 automations" on
 * the card it is subscribed to and be refused at 10. This panel shows the resolved value and,
 * when it differs from the plan default, says where the number came from.
 *
 * No limit is ever computed here, and no plan config is read: every figure comes from the server's
 * own resolver, which is the same code path that enforces them.
 */

/** Human labels for the resolved limit keys, in the order they are worth reading. */
const LIMIT_LABELS: Array<{ key: string; label: string; unit?: string }> = [
  { key: "workflows", label: "Automations" },
  { key: "dmsPerMonth", label: "DMs", unit: "per month" },
  { key: "dmFollowUps", label: "Follow-up DMs", unit: "per automation" },
  { key: "teamMembers", label: "Team seats" },
  { key: "workspacesIncluded", label: "Workspaces included" },
  { key: "analyticsHistoryDays", label: "Analytics history", unit: "days" },
  { key: "schedulerPostsPerDay", label: "Scheduled posts", unit: "per day" },
  { key: "automationsPerDay", label: "New automations", unit: "per day" },
  { key: "maxApiCredentials", label: "API credentials" },
  { key: "apiRequestsPerDay", label: "API requests", unit: "per day" },
];

type LimitRow = { key: string; label: string; unit?: string; limit: ResolvedLimit };

/** Only a value that differs from the plan's own default is worth calling out. */
const SOURCE_NOTES: Record<string, string | undefined> = {
  PACKAGE_LIMIT: "Set by your package",
  WORKSPACE_LIMIT_OVERRIDE: "Custom for this workspace",
};

function LimitValue({ limit }: { limit: ResolvedLimit }) {
  if (limit.unlimited) {
    return <span className="font-display text-lg font-semibold">Unlimited</span>;
  }
  return <span className="font-display text-lg font-semibold tabular-nums">{formatNum(limit.value)}</span>;
}

export function PlanLimitsPanel({ workspaceId }: { workspaceId: string }) {
  const query = useQuery({
    queryKey: ["workspace-limits", workspaceId],
    queryFn: () => getWorkspaceLimits(workspaceId),
    enabled: isWorkspaceReady(workspaceId),
  });

  if (query.isLoading) {
    return <Skeleton className="h-48 rounded-2xl" />;
  }

  // A failed lookup must not render as a grid of zeros or of "Unlimited" — say nothing is known.
  if (query.isError || !query.data) {
    return (
      <div className="rounded-2xl border bg-card p-6 shadow-soft">
        <h2 className="font-display text-lg font-semibold">Your plan limits</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Limits are unavailable right now. Nothing has changed about your plan — this panel could
          not read them.
        </p>
      </div>
    );
  }

  const limits = query.data.limits;
  // A key the server does not return is skipped rather than rendered as a zero or a blank.
  const rows: LimitRow[] = LIMIT_LABELS.flatMap((meta) => {
    const limit = limits[meta.key];
    return limit ? [{ ...meta, limit }] : [];
  });

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-soft">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">Your plan limits</h2>
        <span className="text-xs text-muted-foreground">
          What this workspace is enforced against
        </span>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        These are the resolved values the server enforces. Where a package or a custom arrangement
        changes one, it is marked — the plan cards below show list capabilities, which can differ.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => {
          const note = SOURCE_NOTES[row.limit.source];
          return (
            <div key={row.key} className="rounded-xl border bg-background/40 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {row.label}
              </p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <LimitValue limit={row.limit} />
                {row.unit && !row.limit.unlimited && (
                  <span className="text-xs text-muted-foreground">{row.unit}</span>
                )}
              </div>
              {note && (
                <p className="mt-1 text-[11px] font-medium text-primary">{note}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
