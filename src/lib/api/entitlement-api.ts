import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

/**
 * Which layer decided a limit's value. Same vocabulary the server uses, so the workspace UI and
 * the superadmin drill-down cannot describe one number differently.
 */
export type LimitSource = "PLAN_DEFAULT" | "PACKAGE_LIMIT" | "WORKSPACE_LIMIT_OVERRIDE";

export type ResolvedLimit = {
  /**
   * The enforced value. Meaningless when `unlimited` is true — it is an internal sentinel, not a
   * number to render. Always branch on `unlimited` first.
   */
  value: number;
  unlimited: boolean;
  source: LimitSource;
};

/**
 * What this workspace is actually entitled to, as the server resolves it.
 *
 * The Billing page used to present the numbers a tier is *sold* with, straight out of the plan
 * definition. Enforcement folds `package_limits` and workspace-level overrides on top, so whenever
 * those disagreed the customer was shown one number and held to another, and found out by being
 * refused. Read this; never re-derive a limit client-side and never read a plan config for it.
 */
export type WorkspaceLimitsResponse = {
  plan: string;
  limits: Record<string, ResolvedLimit>;
};

export function getWorkspaceLimits(workspaceId: string) {
  return apiRequest<WorkspaceLimitsResponse>(apiUri.entitlement.limits, { workspaceId });
}
