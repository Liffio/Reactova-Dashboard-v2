import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useAppSelector } from "@/store/hooks";

export type WorkspaceApi = {
  id: string;
  igHandle?: string | null;
  plan: "FREE" | "STARTER" | "PRO" | "BUSINESS" | "AGENCY";
  status: "ACTIVE" | "PAUSED" | "PAYMENT_FAILED" | "INSTAGRAM_DISCONNECTED";
  billingCycleEnd?: string | null;
};

export function useWorkspacesQuery() {
  const token = useAppSelector((state) => state.auth.accessToken);
  return useQuery({
    queryKey: ["workspaces", token],
    queryFn: () => apiRequest<WorkspaceApi[]>("/api/v1/workspaces"),
    enabled: Boolean(token)
  });
}
