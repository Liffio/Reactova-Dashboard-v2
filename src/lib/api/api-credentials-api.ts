import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

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
  /**
   * What this user may do with keys in this workspace — role ∩ package, resolved by the server
   * (`api:view_keys` / `api:create_keys` / `api:key_expiry`). Absent on servers before D3.
   */
  capabilities?: { viewKeys: boolean; createKeys: boolean; keyExpiry: boolean };
  /** @deprecated Same as `capabilities.createKeys`. */
  apiEnabled: boolean;
  limits: {
    maxApiCredentials: number;
    apiRequestsPerDay: number;
    schedulerPostsPerDay: number;
    automationsPerDay: number;
  } | null;
  /** @deprecated Always `null`: API access is decided by the package, not a plan. */
  minimumPlanForApi: string | null;
  /** @deprecated Same as `capabilities.createKeys`; read that. */
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

export function listApiCredentials(workspaceId: string) {
  return apiRequest<ApiCredentialsResponse>(apiUri.apiCredentials.list, { workspaceId });
}

export function getApiPlanCatalog() {
  return apiRequest<{ plans: PlanCatalogItem[] }>(apiUri.apiCredentials.plans);
}

export function createApiCredential(
  workspaceId: string,
  body: { name: string; neverExpires?: boolean },
) {
  return apiRequest<{ credential: ApiCredentialItem; secretKey: string; message: string }>(
    apiUri.apiCredentials.create,
    { method: "POST", workspaceId, body },
  );
}

export function updateApiCredential(
  workspaceId: string,
  id: string,
  body: { neverExpires: boolean },
) {
  return apiRequest<{ credentials: ApiCredentialItem[] }>(apiUri.apiCredentials.item(id), {
    method: "PATCH",
    workspaceId,
    body,
  });
}

export function revokeApiCredential(workspaceId: string, id: string) {
  return apiRequest<void>(apiUri.apiCredentials.item(id), { method: "DELETE", workspaceId });
}
