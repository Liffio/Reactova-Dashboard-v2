/**
 * Settings → Account (plan/settings-revamp.md). Every call is user-level: `workspaceId: null`
 * keeps the active-workspace header off, since none of these are workspace-scoped.
 *
 * Takeover actions need no special handling here — `apiRequest` catches `REAUTH_REQUIRED`,
 * opens "Confirm it's you" and retries (lib/auth/reauth.ts).
 */
import { API_BASE, apiRequest, apiUploadRequest } from "./http";
import { apiUri } from "./apiUri";
import { authStore } from "@/lib/auth/auth-store";
import { saveBlob } from "./billing-api";

const acct = apiUri.auth.account;
const userLevel = { workspaceId: null } as const;

export type ReauthMethod = "mfa" | "password" | "email";

export type AccountSession = {
  id: string;
  device: string;
  browser: string | null;
  os: string | null;
  deviceType: string;
  ipMasked: string | null;
  signedInAt: string;
  lastActiveAt: string;
  current: boolean;
};

export type DataExport = {
  id: string;
  status: "queued" | "ready" | "failed" | "expired";
  createdAt: string;
  expiresAt: string | null;
};

export type DeletionBlocker = {
  code: "OWNS_WORKSPACE_WITH_MEMBERS" | "ACTIVE_SUBSCRIPTION" | "OWNS_WORKSPACE_GROUP";
  message: string;
  workspaceId?: string;
  workspaceName?: string;
  groupId?: string;
};

export const accountApi = {
  updateProfile: (body: { name?: string; timezone?: string | null }) =>
    apiRequest<{ name?: string; timezone?: string | null }>(acct.profile, {
      method: "PATCH",
      body,
      ...userLevel,
    }),
  updatePhone: (phoneNumber: string) =>
    apiRequest<{ phoneNumber: string | null; phoneVerified: boolean }>(acct.phone, {
      method: "PATCH",
      body: { phoneNumber },
      ...userLevel,
    }),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiUploadRequest<{ avatarUrl: string }>(acct.avatar, form, {
      method: "PUT",
      workspaceId: null,
    });
  },
  removeAvatar: () => apiRequest<void>(acct.avatar, { method: "DELETE", ...userLevel }),
  /** Save a generated Blobatar. 409 `BLOB_TAKEN` if another account owns that blob — roll again. */
  setAvatarSeed: (seed: string) =>
    apiRequest<{ avatarSeed: string }>(acct.avatarSeed, {
      method: "PUT",
      body: { seed },
      ...userLevel,
    }),

  getReauthMethod: () => apiRequest<{ method: ReauthMethod }>(acct.reauth, userLevel),
  sendReauthEmailCode: () =>
    apiRequest<{ retryAfterSec: number; expiresInSec: number }>(acct.reauthEmailCode, {
      method: "POST",
      ...userLevel,
    }),
  reauth: (body: { method: ReauthMethod; code?: string; password?: string }) =>
    apiRequest<{ reauthToken: string; expiresInSec: number }>(acct.reauth, {
      method: "POST",
      body,
      ...userLevel,
    }),

  startEmailChange: (newEmail: string) =>
    apiRequest<{ pendingEmail: string; expiresInSec: number }>(acct.emailChange, {
      method: "POST",
      body: { newEmail },
      ...userLevel,
    }),
  confirmEmailChange: (code: string) =>
    apiRequest<{ email: string }>(acct.emailConfirm, {
      method: "POST",
      body: { code },
      ...userLevel,
    }),
  resendEmailChange: () =>
    apiRequest<{ retryAfterSec: number }>(acct.emailResend, { method: "POST", ...userLevel }),
  cancelEmailChange: () => apiRequest<void>(acct.emailPending, { method: "DELETE", ...userLevel }),

  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    apiRequest<{ ok: true; signedOutDevices: number }>(acct.password, {
      method: "POST",
      body,
      ...userLevel,
    }),
  setPassword: (newPassword: string) =>
    apiRequest<{ ok: true; signedOutDevices: number }>(acct.passwordSet, {
      method: "POST",
      body: { newPassword },
      ...userLevel,
    }),

  startGoogleLink: () =>
    apiRequest<{ url: string }>(acct.googleLink, {
      method: "POST",
      body: { fe: typeof window !== "undefined" ? window.location.origin : undefined },
      ...userLevel,
    }),
  disconnectGoogle: () =>
    apiRequest<{ googleConnected: false }>(acct.googleDisconnect, { method: "POST", ...userLevel }),

  listSessions: () => apiRequest<{ sessions: AccountSession[] }>(acct.sessions, userLevel),
  revokeSession: (id: string) =>
    apiRequest<void>(acct.session(id), { method: "DELETE", ...userLevel }),
  revokeOtherSessions: () =>
    apiRequest<{ count: number }>(acct.sessionsRevokeOthers, { method: "POST", ...userLevel }),

  requestExport: () =>
    apiRequest<{ id: string; status: string }>(acct.export, { method: "POST", ...userLevel }),
  listExports: () => apiRequest<{ exports: DataExport[] }>(acct.exports, userLevel),
  /** Manual fetch (same reason as `fetchInvoicePdf`): a bare link carries no bearer token. */
  downloadExport: async (id: string, filename: string) => {
    const token = authStore.getState().accessToken;
    const res = await fetch(`${API_BASE}${acct.exportDownload(id)}`, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok)
      throw new Error(
        res.status === 404 ? "This export has expired. Request a new one." : "Download failed",
      );
    saveBlob(await res.blob(), filename);
  },

  deletionCheck: () =>
    apiRequest<{ canDelete: boolean; blockers: DeletionBlocker[]; graceDays: number }>(
      acct.deletionCheck,
      userLevel,
    ),
  deleteAccount: (confirmEmail: string) =>
    apiRequest<{ deletionScheduledFor: string }>(acct.delete, {
      method: "POST",
      body: { confirmEmail },
      ...userLevel,
    }),
  cancelDeletion: () =>
    apiRequest<{ deletionScheduledFor: null }>(acct.deleteCancel, { method: "POST", ...userLevel }),
};
