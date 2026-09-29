import { useQuery } from "@tanstack/react-query";

import { getBillingSubscription, type BillingSubscription } from "@/lib/api/billing-api";
import {
  getSwitcher,
  type SwitcherGroup,
  type WorkspacePlanKey,
} from "@/lib/api/workspace-switcher-api";
import { isWorkspaceReady } from "@/lib/api/active-workspace";

/**
 * The plan a workspace is on — the ONE answer for every surface that shows or branches on it.
 *
 * Replaces the legacy `current.plan` from `GET /workspaces`, which maps only the old plan enum and
 * knows nothing of packages or agency groups, so it could say "Free" while Billing said "Growth"
 * (or the agency's plan).
 *
 * Two sources, each for what it is good at:
 * - **The switcher** (`GET /workspaces/switcher`, readable by every member, already loaded app-wide)
 *   gives the plan KEY — what code branches on. A workspace in an agency group is on the group's
 *   plan; otherwise its own.
 * - **Billing's subscription** gives the display NAME Billing shows, so General and Billing read the
 *   same words. It needs `billing:read`, so it is optional: without it the switcher's server-resolved
 *   `planLabel` is used instead — never a guessed "Free".
 *
 * Same query keys as Billing and the switcher, so everything shares one cache entry.
 */
export function resolvePlanLabel(
  sub: BillingSubscription | undefined | null,
  group: SwitcherGroup | null,
): string {
  return group ? group.planLabel : (sub?.displayName ?? "Free");
}

/** Plan key only, from the switcher. For branching (gating, "on Free" copy); no billing call. */
export function useWorkspacePlanKey(workspaceId: string) {
  const switcherQuery = useQuery({
    queryKey: ["workspace-switcher"],
    queryFn: getSwitcher,
    enabled: isWorkspaceReady(workspaceId),
  });
  const data = switcherQuery.data;
  const group = data?.groups.find((g) => g.workspaces.some((w) => w.id === workspaceId)) ?? null;
  const standalone = group ? null : (data?.workspaces.find((w) => w.id === workspaceId) ?? null);
  const planKey: WorkspacePlanKey | null = group ? group.plan : (standalone?.plan ?? null);

  return {
    /** Null while loading or when the workspace is not in the switcher — treat as "unknown". */
    planKey,
    /** The server-resolved display name, for callers without billing access. */
    switcherLabel: group ? group.planLabel : (standalone?.planLabel ?? null),
    group,
    isFree: planKey === "FREE",
    isAgency: planKey === "AGENCY",
    isLoading: switcherQuery.isLoading,
  };
}

/** Plan key + Billing's display name + status. For Settings, where the words must match Billing. */
export function useWorkspacePlan(workspaceId: string) {
  const key = useWorkspacePlanKey(workspaceId);
  const subQuery = useQuery({
    queryKey: ["billing-subscription", workspaceId],
    queryFn: () => getBillingSubscription(workspaceId),
    enabled: isWorkspaceReady(workspaceId),
    // A member without `billing:read` gets a 403; that is an answer, not a blip to retry.
    retry: false,
  });
  const sub = subQuery.data;
  const group = key.group;

  return {
    ...key,
    label: group
      ? group.planLabel
      : (sub?.displayName ?? key.switcherLabel ?? (subQuery.isError ? "Free" : "…")),
    /** Group plans read ACTIVE/EXPIRED; a standalone one reads its subscription's billing status. */
    status: group ? (group.readOnly ? "EXPIRED" : "ACTIVE") : (sub?.billingStatus ?? null),
    /** Set when the plan comes from an agency rather than the workspace's own subscription. */
    groupName: group?.name ?? null,
    isLoading: key.isLoading || (subQuery.isLoading && !key.switcherLabel),
  };
}
