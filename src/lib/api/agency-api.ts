import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

export type AgencyDashboard = {
  agency: {
    id: string;
    workspaceId: string;
    brandName: string | null;
    customDomain: string | null;
  };
  billing: {
    /** Resolved from the workspace's effective `workspacesIncluded` limit, not a literal. */
    includedWorkspaces: number;
    /** Every client workspace attached to this agency, at any status. Not an "active" count. */
    usedWorkspaces: number;
    /** Forced to 0 when `unlimitedWorkspaces` is true. */
    extraWorkspaces: number;
    /**
     * True when the resolved limit is unlimited. Branch on this BEFORE rendering an included
     * count or an overage — an unlimited agency has neither.
     */
    unlimitedWorkspaces?: boolean;
    /** Returned but deliberately not rendered: it is an unbacked presentation placeholder. */
    extraMeteredRate: number;
  };
  clients: Array<{
    id: string;
    handle: string;
    plan: string;
    status: string;
    billingCycleEnd: string | null;
    /** @deprecated Misnamed alias of `automationCount`. Use `automationCount`. */
    activeWorkflows: number;
    /** Every non-deleted automation — ACTIVE, PAUSED and DRAFT alike. */
    automationCount?: number;
    /** `status = 'ACTIVE' AND deleted_at IS NULL`. The genuine active count. */
    activeAutomationCount?: number;
    dmsSentThisMonth: number;
  }>;
};

export function getAgencyMasterDashboard(workspaceId: string) {
  return apiRequest<AgencyDashboard>(apiUri.agency.masterDashboard, { workspaceId });
}

export function agencySwitchWorkspace(sourceWorkspaceId: string, workspaceId: string) {
  return apiRequest<{ ok: boolean; workspaceId: string }>(apiUri.agency.switchWorkspace, {
    method: "POST",
    workspaceId: sourceWorkspaceId,
    body: { workspaceId },
  });
}
