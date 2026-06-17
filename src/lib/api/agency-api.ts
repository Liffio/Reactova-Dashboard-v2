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
    includedWorkspaces: number;
    usedWorkspaces: number;
    extraWorkspaces: number;
    extraMeteredRate: number;
  };
  clients: Array<{
    id: string;
    handle: string;
    plan: string;
    status: string;
    billingCycleEnd: string | null;
    activeWorkflows: number;
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
