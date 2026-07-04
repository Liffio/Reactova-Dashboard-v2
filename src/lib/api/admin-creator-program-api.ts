import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

export type AdminCreatorApplication = {
  id: string;
  userId: string;
  name: string;
  email: string;
  country: string;
  instagramUsername: string;
  followerRange: string;
  niche: string;
  otherNiche: string | null;
  asksForComments: boolean;
  whyJoin: string | null;
  status: string;
  createdAt: string;
  user?: { email?: string; name?: string };
};

export type AdminCreatorMember = {
  id: string;
  userId: string;
  workspaceId: string;
  status: string;
  joinedAt: string;
  dmCount: number;
  dmTarget: number;
  campaignCount: number;
  campaignTarget: number;
  warningSentAt: string | null;
  flaggedForOutreachAt: string | null;
  removalNoticeSentAt: string | null;
  removedAt: string | null;
  user: { email?: string; name?: string } | null;
};

export function listAdminCreatorApplications(status = "PENDING") {
  return apiRequest<AdminCreatorApplication[]>(apiUri.admin.creators.applications(status));
}

export function approveAdminCreatorApplication(id: string, note?: string) {
  return apiRequest<{ ok: boolean; profileId: string }>(apiUri.admin.creators.approve(id), {
    method: "POST",
    body: note ? { note } : {},
  });
}

export function rejectAdminCreatorApplication(id: string, note?: string) {
  return apiRequest<{ ok: boolean }>(apiUri.admin.creators.reject(id), {
    method: "POST",
    body: note ? { note } : {},
  });
}

export function listAdminCreatorMembers(status?: string) {
  return apiRequest<AdminCreatorMember[]>(apiUri.admin.creators.members(status));
}

export function sendAdminCreatorRemovalNotice(id: string) {
  return apiRequest<{ ok: boolean }>(apiUri.admin.creators.sendNotice(id), { method: "POST" });
}

export function removeAdminCreatorMember(id: string) {
  return apiRequest<{ ok: boolean }>(apiUri.admin.creators.remove(id), { method: "POST" });
}
