import { useQuery } from "@tanstack/react-query";

import { getCapabilityPlans } from "@/lib/api/billing-api";

/**
 * Which plan unlocks a capability, for the tooltip on a locked control.
 *
 * Read from the server (`GET /billing/packages/capability-plans`), which derives it from the
 * packages on sale — so the name follows whatever an operator puts in a package, and is never a
 * hardcoded plan list here. One request per session; the map is small and changes only when a
 * package is edited.
 */
export function useCapabilityPlans() {
  return useQuery({
    queryKey: ["capability-plans"],
    queryFn: getCapabilityPlans,
    staleTime: 10 * 60 * 1000,
    retry: false,
    select: (data) => data.plans,
  });
}

/**
 * "Available on the Growth plan." for `capability` (`module:action`), or a generic line when no
 * package on sale includes it (or the map has not loaded yet).
 */
export function useUpgradeMessage(capability: string): string {
  const { data } = useCapabilityPlans();
  const plan = data?.[capability];
  return plan
    ? `Available on the ${plan.packageName} plan.`
    : "This feature isn't included in your current plan.";
}
