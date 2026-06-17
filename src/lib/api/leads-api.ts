import { apiUri } from "./apiUri";
import { API_BASE, apiRequest } from "./http";
import { authStore } from "@/lib/auth/auth-store";

export type Lead = {
  id: string;
  workspaceId: string;
  automationId: string;
  automationName: string;
  igUserId: string;
  igUsername: string | null;
  displayName: string | null;
  email: string | null;
  keyword: string | null;
  triggerType: string | null;
  sourceMediaId: string | null;
  sourceMediaType: string | null;
  profilePicUrl: string | null;
  isFollowing: boolean | null;
  linkClicked: boolean;
  metadata: Record<string, unknown> | null;
  capturedAt: string;
  lastInteractionAt: string;
};

export type LeadsListResponse = {
  leads: Lead[];
  total: number;
  limit: number;
  offset: number;
};

export type LeadsListParams = {
  q?: string;
  automationId?: string;
  triggerType?: string;
  limit?: number;
  offset?: number;
};

export function listLeads(workspaceId: string, params: LeadsListParams = {}) {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.automationId) qs.set("automationId", params.automationId);
  if (params.triggerType) qs.set("triggerType", params.triggerType);
  qs.set("limit", String(params.limit ?? 100));
  qs.set("offset", String(params.offset ?? 0));
  return apiRequest<LeadsListResponse>(`${apiUri.leads.list}?${qs.toString()}`, { workspaceId });
}

/** Download the CSV export (returns a Blob the caller saves). */
export async function exportLeadsCsv(workspaceId: string): Promise<Blob> {
  const token = authStore.getState().accessToken;
  const res = await fetch(`${API_BASE}${apiUri.leads.export}`, {
    credentials: "include",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "x-workspace-id": workspaceId,
    },
  });
  if (!res.ok) {
    throw new Error("Unable to export leads right now");
  }
  return res.blob();
}
