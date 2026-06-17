import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

export type WorkspaceApi = {
  id: string;
  userId: string;
  igHandle?: string | null;
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
