import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

export type TokenBalance = {
  allocated: number;
  consumed: number;
  bonus: number;
  /** -1 when `unlimited` is true (Agency-tier sentinel). */
  remaining: number;
  unlimited: boolean;
  periodEnd: string;
};

export function getTokenBalance(workspaceId: string) {
  return apiRequest<{ balance: TokenBalance }>(apiUri.aiTokens.balance, { workspaceId });
}

// ── Super-admin ────────────────────────────────────────────────────────────

export type AiTokenLedgerEntryType =
  | "CONSUMPTION"
  | "MANUAL_GRANT"
  | "PERIOD_RESET"
  | "REFUND"
  | "ADJUSTMENT";

export type UpdatedByUser = { id: string; email: string } | null;

export type AiTokenGlobalSettings = {
  id: string;
  defaultCharsPerToken: number;
  minTokensPerGeneration: number;
  softLimitGraceTokens: number;
  updatedAt: string;
  updatedByUser?: UpdatedByUser;
};

export type AiTokenPlanConfig = {
  id: string;
  planKey: string;
  monthlyTokenAllocation: number;
  charsPerTokenOverride: number | null;
  rolloverEnabled: boolean;
  rolloverCapTokens: number | null;
  isActive: boolean;
  updatedAt: string;
  updatedByUser?: UpdatedByUser;
};

export type AiFeatureRegistryRow = {
  id: string;
  featureKey: string;
  displayName: string;
  surface: string;
  isMetered: boolean;
  description: string | null;
  updatedAt: string;
  updatedByUser?: UpdatedByUser;
};

export type WorkspaceTokenBalanceRow = {
  id: string;
  workspaceId: string;
  planKeySnapshot: string;
  allocatedTokens: number;
  consumedTokens: number;
  bonusTokens: number;
  periodStart: string;
  periodEnd: string;
};

export type AiTokenLedgerRow = {
  id: string;
  workspaceId?: string;
  entryType: AiTokenLedgerEntryType;
  tokensDelta: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
};

export function getAiTokenGlobalSettings() {
  return apiRequest<{ settings: AiTokenGlobalSettings }>(apiUri.admin.aiTokens.settings);
}

export function updateAiTokenGlobalSettings(body: Partial<AiTokenGlobalSettings>) {
  return apiRequest<{ settings: AiTokenGlobalSettings }>(apiUri.admin.aiTokens.settings, {
    method: "PUT",
    body,
  });
}

export function listAiTokenPlans() {
  return apiRequest<{ plans: AiTokenPlanConfig[] }>(apiUri.admin.aiTokens.plans);
}

export function updateAiTokenPlan(planKey: string, body: Partial<AiTokenPlanConfig>) {
  return apiRequest<{ plan: AiTokenPlanConfig }>(apiUri.admin.aiTokens.plan(planKey), {
    method: "PUT",
    body,
  });
}

export function listAiFeatureRegistry() {
  return apiRequest<{ features: AiFeatureRegistryRow[] }>(apiUri.admin.aiTokens.features);
}

export function updateAiFeatureMetering(
  featureKey: string,
  body: Partial<
    Pick<AiFeatureRegistryRow, "isMetered" | "displayName" | "surface" | "description">
  >,
) {
  return apiRequest<{ feature: AiFeatureRegistryRow }>(apiUri.admin.aiTokens.feature(featureKey), {
    method: "PUT",
    body,
  });
}

export function listAiTokenWorkspaceUsage(
  params: {
    limit?: number;
    offset?: number;
    workspaceId?: string;
    sortBy?: "consumed" | "percent" | "remaining";
  } = {},
) {
  return apiRequest<{ workspaces: WorkspaceTokenBalanceRow[]; total: number }>(
    apiUri.admin.aiTokens.workspaces(params),
  );
}

export function getAiTokenLedger(workspaceId: string) {
  return apiRequest<{ ledger: AiTokenLedgerRow[] }>(
    apiUri.admin.aiTokens.workspaceLedger(workspaceId),
  );
}

export function listAiTokenLedger(
  params: {
    workspaceId?: string;
    entryType?: AiTokenLedgerEntryType;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  return apiRequest<{ ledger: AiTokenLedgerRow[]; total: number }>(
    apiUri.admin.aiTokens.ledger(params),
  );
}

export function grantAiTokens(workspaceId: string, body: { tokens: number; note: string }) {
  return apiRequest<{ balance: TokenBalance }>(apiUri.admin.aiTokens.workspaceGrant(workspaceId), {
    method: "POST",
    body,
  });
}
