import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

export type TeamMember = {
  user: { id: string; email: string; name: string };
  role: { key: string; name: string };
  immutableSuperAdmin: boolean;
  permissions: string[];
  modules: Array<{ key: string; name: string; actions: string[] }>;
};

export type WorkspaceInvite = {
  id: string;
  email: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  acceptedUserId: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  accessConfig: {
    permissionKeys?: string[];
    policyKeys?: string[];
    moduleAccess?: Array<{ moduleKey: string; actions: string[] }>;
  };
  baseRole: { key: string; name: string };
  inviterUser: { id: string; email: string; name: string };
  createdAt: string;
};

export type TeamOptions = {
  roles: Array<{ key: string; name: string }>;
  permissions: Array<{ key: string; action: string; moduleKey: string; moduleName: string }>;
  policies: Array<{
    key: string;
    moduleKey: string;
    action: string;
    effect: "ALLOW" | "DENY";
    description: string | null;
  }>;
};

export type CreateInviteInput = {
  email: string;
  roleKey: string;
  moduleAccess: Array<{ moduleKey: string; actions: string[] }>;
  permissionKeys: string[];
  policyKeys: string[];
  expiresInDays?: number;
};

export type UpdateMemberInput = {
  roleKey?: string;
  permissionKeys: string[];
  policyKeys: string[];
};

export function listTeamMembers(workspaceId: string) {
  return apiRequest<TeamMember[]>(apiUri.team.members, { workspaceId });
}

export function listTeamInvites(workspaceId: string) {
  return apiRequest<WorkspaceInvite[]>(apiUri.team.invites, { workspaceId });
}

export function getTeamOptions(workspaceId: string) {
  return apiRequest<TeamOptions>(apiUri.team.options, { workspaceId });
}

export function createTeamInvite(workspaceId: string, body: CreateInviteInput) {
  return apiRequest<{
    id: string;
    status: string;
    expiresAt: string;
    emailSent?: boolean;
    inAppNotified?: boolean;
  }>(apiUri.team.invites, { method: "POST", workspaceId, body });
}

export function revokeTeamInvite(workspaceId: string, inviteId: string) {
  return apiRequest<void>(apiUri.team.invite(inviteId), { method: "DELETE", workspaceId });
}

export function updateTeamMember(workspaceId: string, userId: string, body: UpdateMemberInput) {
  return apiRequest<void>(apiUri.team.member(userId), { method: "PATCH", workspaceId, body });
}

export function removeTeamMember(workspaceId: string, userId: string) {
  return apiRequest<void>(apiUri.team.member(userId), { method: "DELETE", workspaceId });
}
