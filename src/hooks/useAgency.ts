import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

type AgencyDashboard = {
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

export function useAgencyDashboardQuery(workspaceId: string) {
  return useQuery({
    queryKey: ["agency-dashboard", workspaceId],
    queryFn: () => apiRequest<AgencyDashboard>("/api/v1/agency/master-dashboard", { workspaceId }),
    enabled: Boolean(workspaceId)
  });
}

export function useAgencySwitchWorkspaceMutation(sourceWorkspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workspaceId: string) =>
      apiRequest<{ ok: boolean; workspaceId: string }>("/api/v1/agency/switch-workspace", {
        method: "POST",
        workspaceId: sourceWorkspaceId,
        body: { workspaceId }
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    }
  });
}
