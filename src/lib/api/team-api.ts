import type { InviteDeliveryIssue } from "@/lib/invite-delivery";
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
  /**
   * How the last email for this invite went. (R3b)
   *
   * `null` is "never recorded", which every invite created before the column existed reads as. The
   * Team page marks `false` and says nothing about `null`: a "not delivered" badge on an invite
   * nobody measured would be a guess presented as a fact.
   */
  lastDeliveryOk?: boolean | null;
  /** A classification, never the provider's own message. See `@/lib/invite-delivery`. */
  lastDeliveryIssue?: InviteDeliveryIssue | null;
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

export type InviteRejection = {
  key: string;
  kind: "permission" | "policy";
  reason: GrantReason | "unknown";
  message: string;
};

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

/** What the invite endpoints say about delivery. Shared so create and resend report identically. */
export type InviteDeliveryReport = {
  emailSent?: boolean;
  /**
   * The field the UI reads. (R3b)
   *
   * `emailReason` and `emailDetail` are also on the wire and are deliberately NOT typed here: they
   * are the provider's own vocabulary, they exist for operators and logs, and a type that offers
   * them to a component is an invitation to render them. The owner's words are chosen from
   * `deliveryIssue` alone, in `@/lib/invite-delivery`.
   */
  deliveryIssue?: InviteDeliveryIssue | null;
};

export function createTeamInvite(workspaceId: string, body: CreateInviteInput) {
  return apiRequest<
    {
      id: string;
      email?: string;
      status: string;
      expiresAt: string;
    } & InviteDeliveryReport
  >(apiUri.team.invites, { method: "POST", workspaceId, body });
}

export function revokeTeamInvite(workspaceId: string, inviteId: string) {
  return apiRequest<void>(apiUri.team.invite(inviteId), { method: "DELETE", workspaceId });
}

export function resendTeamInvite(workspaceId: string, inviteId: string) {
  return apiRequest<{ id: string; resendCount: number; expiresAt: string } & InviteDeliveryReport>(
    apiUri.team.inviteResend(inviteId),
    { method: "POST", workspaceId },
  );
}

export function updateTeamMember(workspaceId: string, userId: string, body: UpdateMemberInput) {
  return apiRequest<void>(apiUri.team.member(userId), { method: "PATCH", workspaceId, body });
}

export function removeTeamMember(workspaceId: string, userId: string) {
  return apiRequest<void>(apiUri.team.member(userId), { method: "DELETE", workspaceId });
}

/* ── The Team page (U5, spec 5.7) ────────────────────────────────────────────────────────────── */

export type TeamAccessSource = "OWNER" | "MEMBER" | "GROUP" | "NONE";

export type TeamOverviewMember = {
  userId: string;
  name: string | null;
  email: string;
  roleKey: string;
  roleName: string;
  isOwner: boolean;
  /** How they reach this workspace. Decides what the Access column says. */
  source: TeamAccessSource;
  scope: "GROUP" | "SELECTED" | null;
  canDownloadInvoices: boolean;
  selectedWorkspaceIds: string[];
};

export type TeamOverview = {
  /** Whether anything on the page is editable. The server re-checks every write regardless. */
  viewerIsOwner: boolean;
  /** The RESOLVED limit, so a package or admin override is reflected, not the plan default. */
  limit: number;
  /** Includes the owner, and counts a whole-group member in every workspace of the group. (T3) */
  used: number;
  members: TeamOverviewMember[];
  /** The agency's own workspaces, for the invite modal's checklist. Owner only, null otherwise. */
  group: {
    id: string;
    name: string;
    workspaces: Array<{ id: string; name: string; slotNo: number }>;
  } | null;
};

export function getTeamOverview(workspaceId: string) {
  return apiRequest<TeamOverview>(apiUri.team.overview, { workspaceId });
}

/** Grant or change somebody's access to the agency. Owner only, server-enforced. (T2) */
export function upsertGroupMember(
  groupId: string,
  body: {
    email?: string;
    userId?: string;
    roleKey: string;
    scope: "GROUP" | "SELECTED";
    workspaceIds?: string[];
    canDownloadInvoices?: boolean;
  },
) {
  return apiRequest<{ member: TeamOverviewMember }>(apiUri.workspaceGroups.members(groupId), {
    method: "POST",
    body,
  });
}

export function removeGroupMember(groupId: string, userId: string) {
  return apiRequest<void>(apiUri.workspaceGroups.member(groupId, userId), { method: "DELETE" });
}
