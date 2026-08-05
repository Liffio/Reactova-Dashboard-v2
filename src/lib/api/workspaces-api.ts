import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

export type WorkspaceApi = {
  id: string;
  userId: string;
  igHandle?: string | null;
  /**
   * The connected Instagram account's avatar, served straight from Instagram's CDN.
   *
   * Null for most workspaces — the large majority have no Instagram connected — so the letter-avatar
   * fallback is the normal path, not an edge case. The URL is also signed and expires, so a render
   * needs an `onError` fallback as well as a null check.
   */
  profilePictureUrl?: string | null;
  /** Human-readable public id, e.g. `acme-store-4f2`. Stable; accepted by the external API. */
  humanId?: string | null;
  displayName?: string | null;
  instagramConnected: boolean;
  plan: "FREE" | "STARTER" | "PRO" | "BUSINESS" | "AGENCY";
  status: "ACTIVE" | "PAUSED" | "PAYMENT_FAILED" | "INSTAGRAM_DISCONNECTED";
  billingCycleEnd?: string | null;
  onboarding?: Record<string, unknown> | null;
  onboardingState?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  dmsThisMonth: number;
  leadsThisMonth: number;
  clicksThisMonth: number;
  activeAutomations: number;
};

export function listWorkspaces() {
  return apiRequest<WorkspaceApi[]>(apiUri.workspaces.list);
}

export function createWorkspace(input: { name?: string }) {
  return apiRequest<{ id: string }>(apiUri.workspaces.create, {
    method: "POST",
    body: { name: input.name?.trim() || undefined },
  });
}

export type UpdateWorkspaceInput = {
  displayName?: string;
  isOnboarded?: boolean;
  onboarding?: Record<string, unknown>;
};

export function updateWorkspace(workspaceId: string, body: UpdateWorkspaceInput) {
  return apiRequest<WorkspaceApi>(apiUri.workspaces.update(workspaceId), {
    method: "PATCH",
    workspaceId,
    body,
  });
}

export function deleteWorkspace(workspaceId: string) {
  return apiRequest<void>(apiUri.workspaces.remove(workspaceId), { method: "DELETE" });
}
