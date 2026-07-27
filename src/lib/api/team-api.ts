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
  customizeAccess?: boolean;
  moduleAccess: Array<{ moduleKey: string; actions: string[] }>;
  permissionKeys: string[];
  policyKeys: string[];
  expiresInDays?: number;
};

export type GrantReason = "not_held" | "not_entitled" | "module_disabled" | "protected";

export type GrantableItem = {
  key: string;
  moduleKey: string;
  action: string;
  label: string | null;
  grantable: boolean;
  reason: GrantReason | null;
};

export type GrantablePolicy = {
  key: string;
  moduleKey: string | null;
  action: string | null;
  effect: "ALLOW" | "DENY";
  grantable: boolean;
  reason: GrantReason | null;
};

export type InviteSeatInfo = {
  limit: number | null;
  members: number;
  pendingInvites: number;
  remaining: number | null;
};

export type GrantableRole = { key: string; name: string; grantKeys: string[] };

export type GrantableAccess = {
  inviterRole: { id: string; key: string; name: string } | null;
  packageName: string | null;
  roles: GrantableRole[];
  permissions: GrantableItem[];
  capabilities: GrantableItem[];
  policies: GrantablePolicy[];
  seats: InviteSeatInfo;
};

export type InviteRejection = { key: string; kind: "permission" | "policy"; reason: GrantReason | "unknown"; message: string };

export type UpdateMemberInput = {
  roleKey?: string;
  permissionKeys: string[];
  policyKeys: string[];
};

export function listTeamInvites(workspaceId: string) {
  return apiRequest<WorkspaceInvite[]>(apiUri.team.invites, { workspaceId });
}

export function getTeamOptions(workspaceId: string) {
  return apiRequest<TeamOptions>(apiUri.team.options, { workspaceId });
}

/** The exact access this inviter may confer, each item annotated grantable/reason, plus live seats. */
export function getGrantableAccess(workspaceId: string) {
  return apiRequest<GrantableAccess>(apiUri.team.grantable, { workspaceId });
}

export function createTeamInvite(workspaceId: string, body: CreateInviteInput) {
  return apiRequest<{
    id: string;
    status: string;
    expiresAt: string;
    emailSent?: boolean;
  }>(apiUri.team.invites, { method: "POST", workspaceId, body });
}

export function revokeTeamInvite(workspaceId: string, inviteId: string) {
  return apiRequest<void>(apiUri.team.invite(inviteId), { method: "DELETE", workspaceId });
}

export function resendTeamInvite(workspaceId: string, inviteId: string) {
  return apiRequest<{ id: string; resendCount: number; expiresAt: string; emailSent: boolean }>(
    apiUri.team.inviteResend(inviteId),
    { method: "POST", workspaceId }
  );
}

export function updateTeamMember(workspaceId: string, userId: string, body: UpdateMemberInput) {
  return apiRequest<void>(apiUri.team.member(userId), { method: "PATCH", workspaceId, body });
}

export function removeTeamMember(workspaceId: string, userId: string) {
  return apiRequest<void>(apiUri.team.member(userId), { method: "DELETE", workspaceId });
}
