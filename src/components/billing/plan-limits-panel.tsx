import { useQuery } from "@tanstack/react-query";
import { Infinity as InfinityIcon } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { formatNum } from "@/lib/format";
import { getWorkspaceLimits, type ResolvedLimit } from "@/lib/api/entitlement-api";
import { isWorkspaceReady } from "@/lib/api/active-workspace";
import { CardNote, SettingsCard } from "@/features/settings/components";

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
  { key: "teamMembers", label: "Team members" },
  { key: "workspacesIncluded", label: "Workspaces included" },
  { key: "analyticsHistoryDays", label: "Analytics history", unit: "days" },
  { key: "schedulerPostsPerDay", label: "Scheduled posts", unit: "per day" },
  { key: "automationsPerDay", label: "New automations", unit: "per day" },
  { key: "maxApiCredentials", label: "API credentials" },
  { key: "apiRequestsPerDay", label: "API requests", unit: "per day" },
  { key: "chatbots", label: "Live chatbots" },
  { key: "chatbotConversationsPerMonth", label: "Chatbot conversations", unit: "per month" },
  { key: "chatbotStepsPerBot", label: "Chatbot steps", unit: "per chatbot" },
  { key: "chatbotKeywordsPerBot", label: "Chatbot keywords", unit: "per chatbot" },
  { key: "chatbotButtonsPerStep", label: "Chatbot buttons", unit: "per step" },
  { key: "chatbotConditionRules", label: "Condition rules", unit: "per condition" },
  { key: "chatbotFollowUpsPerStep", label: "Chatbot follow-ups", unit: "per step" },
];

type LimitRow = { key: string; label: string; unit?: string; limit: ResolvedLimit };

/** Only a value that differs from the plan's own default is worth calling out. */
const SOURCE_NOTES: Record<string, string | undefined> = {
  PACKAGE_LIMIT: "Set by your package",
  WORKSPACE_LIMIT_OVERRIDE: "Custom for this workspace",
};

/** The catalogue stores "no cap" as `-1`; some resolvers pass it through without the flag. */
const isUnlimited = (limit: ResolvedLimit) =>
  limit.unlimited || (typeof limit.value === "number" && limit.value < 0);

export function PlanLimitsPanel({ workspaceId }: { workspaceId: string }) {
  const query = useQuery({
    queryKey: ["workspace-limits", workspaceId],
    queryFn: () => getWorkspaceLimits(workspaceId),
    enabled: isWorkspaceReady(workspaceId),
  });

  if (query.isLoading) {
    return <Skeleton className="h-48 rounded-[16px]" />;
  }

  // A failed lookup must not render as a grid of zeros or of "Unlimited" — say nothing is known.
  if (query.isError || !query.data) {
    return (
      <SettingsCard title="Your plan limits">
        <CardNote>
          Limits are unavailable right now. Nothing has changed about your plan — this panel could
          not read them.
        </CardNote>
      </SettingsCard>
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
    <SettingsCard
      title="Your plan limits"
      description="What this workspace is enforced against. The plan cards below show list capabilities, which can differ."
    >
      <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3 xl:grid-cols-5">
        {rows.map((row) => {
          const note = SOURCE_NOTES[row.limit.source];
          const unlimited = isUnlimited(row.limit);
          return (
            <div
              key={row.key}
              className="flex flex-col gap-1 rounded-[12px] border border-[#EFEAE4] bg-[#FCFAF7] px-4 py-3.5 dark:border-border dark:bg-muted/40"
            >
              <span className="text-xs text-muted-foreground">{row.label}</span>
              <div className="flex items-baseline gap-1.5">
                {unlimited ? (
                  <span
                    className="inline-flex items-center font-display text-[20px] font-bold text-foreground"
                    title="Unlimited"
                  >
                    <InfinityIcon aria-hidden className="size-6 stroke-[2.2]" />
                    <span className="sr-only">Unlimited</span>
                  </span>
                ) : (
                  <span className="font-display text-[20px] font-bold tabular-nums text-foreground">
                    {formatNum(row.limit.value)}
                  </span>
                )}
                {row.unit && !unlimited && (
                  <span className="text-xs text-muted-foreground">{row.unit}</span>
                )}
              </div>
              {note && (
                <span className="text-[11px] font-semibold text-[#C20F3B] dark:text-primary">
                  {note}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </SettingsCard>
  );
}
