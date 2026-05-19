import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export type ApiCredentialItem = {
  id: string;
  name: string;
  keyPrefix: string;
  maskedKey: string;
  expiresAt: string | null;
  neverExpires: boolean;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  status: "active" | "expired" | "revoked";
};

export type ApiCredentialsResponse = {
  credentials: ApiCredentialItem[];
  plan: string;
  apiEnabled: boolean;
  limits: {
    maxApiCredentials: number;
    apiRequestsPerDay: number;
    schedulerPostsPerDay: number;
    automationsPerDay: number;
  } | null;
  minimumPlanForApi: string;
  planMeetsMinimum: boolean;
};

export type PlanCatalogItem = {
  plan: string;
  displayName: string;
  monthlyPriceUsdCents: number;
  monthlyPriceUsd: number;
  apiEnabled: boolean;
  maxApiCredentials: number;
  apiRequestsPerDay: number;
  schedulerPostsPerDay: number;
  automationsPerDay: number;
  whiteLabel: boolean;
  workspacesIncluded: number;
  description: string | null;
};

export function useApiCredentialsQuery(workspaceId: string) {
  return useQuery({
    queryKey: ["api-credentials", workspaceId],
    queryFn: () => apiRequest<ApiCredentialsResponse>("/api/v1/api-credentials", { workspaceId }),
    enabled: Boolean(workspaceId)
  });
}

export function usePlanCatalogQuery() {
  return useQuery({
    queryKey: ["api-plan-catalog"],
    queryFn: () =>
      apiRequest<{ plans: PlanCatalogItem[] }>("/api/v1/api-credentials/plans")
  });
}

export function useCreateApiCredentialMutation(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; neverExpires?: boolean }) =>
      apiRequest<{ credential: ApiCredentialItem; secretKey: string; message: string }>(
        "/api/v1/api-credentials",
        { method: "POST", body, workspaceId }
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["api-credentials", workspaceId] });
    }
  });
}

export function useUpdateApiCredentialMutation(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; neverExpires: boolean }) =>
      apiRequest<{ credentials: ApiCredentialItem[] }>(`/api/v1/api-credentials/${input.id}`, {
        method: "PATCH",
        body: { neverExpires: input.neverExpires },
        workspaceId
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["api-credentials", workspaceId] });
    }
  });
}

export function useRevokeApiCredentialMutation(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/api/v1/api-credentials/${id}`, { method: "DELETE", workspaceId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["api-credentials", workspaceId] });
    }
  });
}
