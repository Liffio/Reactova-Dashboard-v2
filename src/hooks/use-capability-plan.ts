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
  return useUpgradeInfo(capability).message;
}

/**
 * Everything a locked control needs: the one-line reason, the plan that unlocks it, and the
 * billing search that highlights that plan's card (`/billings?highlight=growth`).
 */
export function useUpgradeInfo(capability: string): {
  message: string;
  planName: string | null;
  billingSearch: { highlight?: string };
} {
  const { data } = useCapabilityPlans();
  const plan = data?.[capability];
  return plan
    ? {
        message: `Available on the ${plan.packageName} plan.`,
        planName: plan.packageName,
        billingSearch: { highlight: plan.packageKey },
      }
    : {
        message: "This feature isn't included in your current plan.",
        planName: null,
        billingSearch: {},
      };
}
