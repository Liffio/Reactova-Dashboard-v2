import { apiUri } from "./apiUri";
import { API_BASE, apiRequest } from "./http";
import type { AuthMePayload, AuthorizationPayload } from "@/lib/auth/auth-store";

export type LoginSuccess = {
  accessToken: string;
  accessTokenExpiresAt: number | null;
  user: { id: string; email: string; name: string };
  authorization: AuthorizationPayload;
};

export type RefreshSuccess = {
  accessToken: string;
  accessTokenExpiresAt: number | null;
  authorization: AuthorizationPayload;
};

export type MfaLoginChallenge = {
  mfaRequired: true;
  preAuthToken: string;
  methods: Array<"authenticator" | "email">;
};

export type LoginApiResponse = MfaLoginChallenge | LoginSuccess;

export function isMfaLoginChallenge(response: LoginApiResponse): response is MfaLoginChallenge {
  return "mfaRequired" in response && response.mfaRequired === true;
}

export type RegisterInput = {
  email: string;
  name: string;
  password: string;
  country?: string;
  referralCode?: string;
  clientRef?: string;
  sessionRef?: string;
  localRef?: string;
  deviceFingerprint?: string;
};

export function login(input: { email: string; password: string }) {
  return apiRequest<LoginApiResponse>(apiUri.auth.login, {
    method: "POST",
    body: input,
    token: null,
  });
}

export function register(input: RegisterInput) {
  return apiRequest<LoginSuccess>(apiUri.auth.register, {
    method: "POST",
    body: input,
    token: null,
  });
}

export function logout() {
  return apiRequest<void>(apiUri.auth.logout, { method: "POST" });
}

/** Rotates the httpOnly refresh cookie and mints a fresh access token. */
export function refreshAccessToken() {
  return apiRequest<RefreshSuccess>(apiUri.auth.refresh, { method: "POST", token: null });
}

export function getAuthMe(options: { token?: string; workspaceId?: string } = {}) {
  return apiRequest<AuthMePayload>(apiUri.auth.me, options);
}

export function patchActiveWorkspace(workspaceId: string) {
  return apiRequest<AuthorizationPayload & { workspaceId: string }>(apiUri.auth.activeWorkspace, {
    method: "PATCH",
    body: { workspaceId },
  });
}

/** URL the browser navigates to for Google OAuth (not an XHR endpoint). */
export function googleAuthUrl(redirectTo: string, frontendOrigin: string): string {
  return `${API_BASE}${apiUri.auth.google}?redirect=${encodeURIComponent(redirectTo)}&fe=${encodeURIComponent(frontendOrigin)}`;
}

// ── Email verification ─────────────────────────────────────────────────────

export function verifyEmailCode(code: string) {
  return apiRequest<{ ok?: boolean }>(apiUri.auth.emailVerification.verifyCode, {
    method: "POST",
    body: { code },
  });
}

export function resendEmailVerification() {
  return apiRequest<{ ok?: boolean; retryAfterSec?: number; expiresInSec?: number }>(
    apiUri.auth.emailVerification.resend,
    { method: "POST" },
  );
}

// ── Password reset ─────────────────────────────────────────────────────────

export function forgotPassword(email: string) {
  return apiRequest<{ ok?: boolean; retryAfterSec?: number; expiresInSec?: number }>(
    apiUri.auth.password.forgot,
    { method: "POST", body: { email }, token: null },
  );
}

export function resetPassword(input: { email: string; code: string; newPassword: string }) {
  return apiRequest<void>(apiUri.auth.password.reset, {
    method: "POST",
    body: input,
    token: null,
  });
}

// ── MFA ────────────────────────────────────────────────────────────────────

export function mfaLoginEmailSend(preAuthToken: string) {
  return apiRequest<{ ok?: boolean; retryAfterSec?: number; expiresInSec?: number }>(
    apiUri.auth.mfa.loginEmailSend,
    { method: "POST", body: { preAuthToken }, token: null },
  );
}

export function mfaLoginVerify(input: {
  preAuthToken: string;
  code: string;
  method?: "authenticator" | "email";
}) {
  return apiRequest<LoginSuccess>(apiUri.auth.mfa.loginVerify, {
    method: "POST",
    body: input,
    token: null,
  });
}

export function mfaSetupStart() {
  return apiRequest<{ otpauthUrl: string; secret: string }>(apiUri.auth.mfa.setupStart, {
    method: "POST",
  });
}

export function mfaSetupCancel() {
  return apiRequest<void>(apiUri.auth.mfa.setupCancel, { method: "POST" });
}

export function mfaSetupVerify(code: string) {
  return apiRequest<{ ok: boolean }>(apiUri.auth.mfa.setupVerify, {
    method: "POST",
    body: { code },
  });
}

export function mfaDisable(code?: string) {
  return apiRequest<{ ok: boolean }>(apiUri.auth.mfa.disable, {
    method: "POST",
    body: code ? { code } : {},
  });
}

export function mfaSetChannels(input: { emailOtpEnabled?: boolean; smsOtpEnabled?: boolean }) {
  return apiRequest<{ ok: boolean }>(apiUri.auth.mfa.channels, {
    method: "POST",
    body: input,
  });
}

// ── Invites ────────────────────────────────────────────────────────────────

export type InvitePreview = {
  id: string;
  email: string;
  inviterName: string;
  workspaceName: string;
  roleName: string;
  expiresAt: string;
};

export type PendingInvite = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  inviterName: string;
  roleName: string;
  expiresAt: string;
  createdAt: string;
};

export function getInvitePreview(token: string) {
  return apiRequest<InvitePreview>(
    `${apiUri.auth.invites.preview}?token=${encodeURIComponent(token)}`,
  );
}

export function getMyPendingInvites() {
  return apiRequest<PendingInvite[]>(apiUri.auth.invites.mine);
}

export type InviteDrop = { key: string; kind: "permission" | "policy"; reason: string };
export type AcceptInviteResult = {
  ok: boolean;
  workspaceId: string;
  authorization: unknown;
  dropped?: InviteDrop[];
};

export function acceptInviteByToken(token: string) {
  return apiRequest<AcceptInviteResult>(apiUri.auth.invites.accept, {
    method: "POST",
    body: { token },
  });
}

export function acceptInviteById(inviteId: string) {
  return apiRequest<AcceptInviteResult>(apiUri.auth.invites.acceptById(inviteId), {
    method: "POST",
  });
}

// ── Inbox (cross-workspace notifications) ──────────────────────────────────

export type InboxNotification = {
  id: string;
  workspaceId: string;
  userId: string;
  type: string;
  name: string;
  origin: string;
  details: string;
  metadata: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
};

export function getInbox() {
  return apiRequest<{ notifications: InboxNotification[] }>(apiUri.auth.inbox.list);
}

export function markInboxRead(notificationId: string) {
  return apiRequest<void>(apiUri.auth.inbox.markRead, {
    method: "POST",
    body: { notificationId },
  });
}

export function markAllInboxRead() {
  return apiRequest<void>(apiUri.auth.inbox.markAllRead, { method: "POST" });
}

/**
 * Set the account's country, once. (S5.6)
 *
 * 🚩 **Why the customer is asked rather than detected.** Google OAuth signup writes
 * `country: null` — the callback is a redirect with no form — and every account created before S4.4
 * has a null too. Under D19 there is one gateway, so country is the only thing deciding INR versus
 * USD, and `createPackageCheckout` **refuses** with `CHECKOUT_COUNTRY_REQUIRED` rather than guessing.
 *
 * That refusal was a dead end until this existed: nothing could supply the missing value.
 *
 * ⚠️ **Do not replace this with IP detection.** D2 is explicit that country comes from signup, and
 * a detected country makes a customer's price depend on where they opened their browser — an Indian
 * customer travelling would be charged in USD at roughly double the INR sheet.
 *
 * ⚠️ **Set-once.** The server answers `409 COUNTRY_ALREADY_SET` if one is present: country selects
 * the currency, and currency is baked into a Razorpay subscription at creation. Changing it later is
 * a support action, where the subscription can be handled at the same time.
 */
export function setAccountCountry(country: string) {
  return apiRequest<{ country: string }>(apiUri.auth.meCountry, {
    method: "PATCH",
    body: { country },
  });
}
