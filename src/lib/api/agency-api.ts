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
    /*
     * 🔴 `extraMeteredRate` WAS HERE, AND THE SERVER NO LONGER SENDS IT.
     *
     * A hardcoded $9 "overage rate" with no source of truth, which this file already noted was
     * never rendered. Under the workspace-plans model it cannot mean anything: an agency is a group
     * with a fixed number of slots, adding a workspace inside it costs nothing, and at the limit
     * the create is refused with `AGENCY_SLOTS_FULL` rather than billed.
     */
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
