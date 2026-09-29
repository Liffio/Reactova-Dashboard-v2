import { useQuery } from "@tanstack/react-query";

import { getBillingSubscription, type BillingSubscription } from "@/lib/api/billing-api";
import { getSwitcher, type SwitcherGroup } from "@/lib/api/workspace-switcher-api";
import { isWorkspaceReady } from "@/lib/api/active-workspace";

/**
 * The plan a workspace is on, as Billing says it — the ONE answer for every Settings surface.
 *
 * General used to read `current.plan` from the legacy `GET /workspaces` list, which maps only the old
 * plan enum and knows nothing of packages or agency groups, so it could say "Free" while Billing said
 * "Growth" (or the agency's plan). This reads the same two sources Billing does, through the **same
 * query keys**, so both tabs share one cache entry and can never disagree:
 *
 * - a workspace in an agency group is on the group's plan (`group.planLabel`);
 * - otherwise it is on its own subscription (`sub.displayName`), and "Free" when there is none.
 */
export function resolvePlanLabel(
  sub: BillingSubscription | undefined | null,
  group: SwitcherGroup | null,
): string {
  return group ? group.planLabel : (sub?.displayName ?? "Free");
}

export function useWorkspacePlan(workspaceId: string) {
  const enabled = isWorkspaceReady(workspaceId);
  const subQuery = useQuery({
    queryKey: ["billing-subscription", workspaceId],
    queryFn: () => getBillingSubscription(workspaceId),
    enabled,
  });
  const switcherQuery = useQuery({
    queryKey: ["workspace-switcher"],
    queryFn: getSwitcher,
    enabled,
  });

  const group =
    switcherQuery.data?.groups.find((g) => g.workspaces.some((w) => w.id === workspaceId)) ?? null;
  const sub = subQuery.data;

  return {
    label: resolvePlanLabel(sub, group),
    /** Group plans read ACTIVE/EXPIRED; a standalone one reads its subscription's billing status. */
    status: group ? (group.readOnly ? "EXPIRED" : "ACTIVE") : (sub?.billingStatus ?? null),
    /** Set when the plan comes from an agency rather than the workspace's own subscription. */
    groupName: group?.name ?? null,
    isLoading: subQuery.isLoading || switcherQuery.isLoading,
  };
}
