/**
 * Workspace-level entitlement mutations (Task 13, client for Task 11's server routes).
 *
 * Typed exactly to task-11-report.md §3's verbatim request/response shapes. Distinct from
 * `registry-api.ts`'s `assignWorkspacePackage`/`clearWorkspacePackage` (`PUT`/`DELETE
 * /admin/packages/assignments/:workspaceId`, the pre-existing Packages-console entry point) —
 * task-11-report.md §1 documents `/admin/workspaces/:wsId/package` as a second HTTP entry point
 * onto the SAME service functions ("one write path, two consoles: Packages console vs. this
 * workspace drill-down"), not a duplicated write path. The list of assignable packages for the
 * drill-down's Select is still fetched via `registry-api.ts`'s `listPackages` per the brief's
 * explicit reuse instruction — only the assign/unassign/limits mutations live here, because they
 * don't fit `admin-users-api.ts` (workspace-scoped, no `:userId` in the path).
 */
import { apiUri } from "./apiUri";
import { apiRequest } from "./http";
import type { TokenBalance } from "./ai-tokens-api";
import type { BillingInvoiceRow } from "./billing-api";

/** Minimal — only the fields this UI reads. task-11-report.md §3 labels the full response
 *  `{ id, workspaceId, packageId, note, assignedByUserId, createdAt, updatedAt }`; typed in full
 *  since the report enumerates every field verbatim here (unlike the user-mutation "row" shapes
 *  in `admin-users-api.ts`, which it does not). */
export type WorkspacePackageAssignmentResult = {
  id: string;
  workspaceId: string;
  packageId: string;
  note: string | null;
  assignedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

/** `POST /admin/workspaces/:wsId/package` — assign (or reassign) this workspace's package.
 *  `note` is optional free text, NOT a required "reason" — the contract has no reason field on
 *  this endpoint. Gated `platform:package_manage`. */
export function assignWorkspacePackageAdmin(
  workspaceId: string,
  body: { packageId: string; note?: string | null },
) {
  return apiRequest<{ ok: true; assignment: WorkspacePackageAssignmentResult }>(
    apiUri.admin.workspaces.package(workspaceId),
    { method: "POST", body },
  );
}

/** `DELETE /admin/workspaces/:wsId/package` — clears the assignment; the workspace becomes
 *  unrestricted (no ceiling), not locked down. `note` optional, body entirely optional (the
 *  server treats a missing body as `{}` per task-11-report.md §5.5). Gated
 *  `platform:package_manage`. */
export function unassignWorkspacePackageAdmin(
  workspaceId: string,
  body: { note?: string | null } = {},
) {
  return apiRequest<{ ok: true; cleared: boolean; unrestricted: true }>(
    apiUri.admin.workspaces.package(workspaceId),
    { method: "DELETE", body },
  );
}

/** `PATCH /admin/workspaces/:wsId/limits` — `limitOverrides` is merged into the existing set
 *  server-side (an operator overriding one key does not clear the others); `null` clears that
 *  one key back to the package/plan default. `-1` is the standardized "unlimited" sentinel on
 *  write, matching every other limit-writing endpoint in this codebase (`setPackageLimits`).
 *  Gated `platform:package_manage`. No `reason` field on this endpoint's contract — the route
 *  file still requires the operator to type one into the confirm dialog before enabling Save
 *  (per the brief's "keep reasons required"), but it isn't part of this request body since the
 *  server doesn't accept one here; the server writes its own unconditional audit row regardless. */
export function patchWorkspaceLimits(
  workspaceId: string,
  body: { limitOverrides: Record<string, number | null> },
) {
  return apiRequest<{ ok: true; limitOverrides: Record<string, number> }>(
    apiUri.admin.workspaces.limits(workspaceId),
    { method: "PATCH", body },
  );
}

/* -------------------------------------------------------------------------
 * §6.6 AI tokens / §6.7 API access / §6.8 Billing (Task 20, consumed by the Task 21 "AI & API"
 * and "Billing" detail tabs). Typed exactly to task-20-report.md §4's verbatim request/response
 * shapes. `TokenBalance` is reused from `ai-tokens-api.ts` rather than redeclared — the summary/
 * adjust/reset-period responses' `balance` field is the report's own documented "same shape as
 * `.balance` above" / the pre-existing `TokenBalanceView`, which is that exact type. The Grant
 * write itself (`POST /admin/ai-tokens/workspaces/:workspaceId/grant`) is NOT re-declared here —
 * its path was kept stable and just re-gated server-side (task-20-report.md §1), so the existing
 * `grantAiTokens` in `ai-tokens-api.ts` is reused verbatim by the Task 21 tab, not duplicated.
 * ---------------------------------------------------------------------- */

/** `GET /admin/workspaces/:wsId/ai-tokens` — current-period summary. Gated
 *  `platform:ai_tokens_manage`. */
export type AdminWorkspaceTokenSummary = {
  ok: true;
  workspaceId: string;
  balance: TokenBalance;
  planKeySnapshot: string;
  periodStart: string;
  periodEnd: string;
  lastResetAt: string;
};

export function getWorkspaceAiTokenSummary(workspaceId: string, opts?: { signal?: AbortSignal }) {
  return apiRequest<AdminWorkspaceTokenSummary>(apiUri.admin.workspaces.aiTokens(workspaceId), {
    signal: opts?.signal,
  });
}

/** `GET /admin/workspaces/:wsId/ai-tokens/ledger?cursor=&limit=` — keyset-paginated. Gated
 *  `platform:ai_tokens_manage`. */
export type AdminWorkspaceLedgerEntryType =
  | "CONSUMPTION"
  | "MANUAL_GRANT"
  | "PERIOD_RESET"
  | "REFUND"
  | "ADJUSTMENT";

export type AdminWorkspaceLedgerEntry = {
  id: string;
  entryType: AdminWorkspaceLedgerEntryType;
  userId: string | null;
  aiGenerationId: string | null;
  inputCharCount: number | null;
  outputCharCount: number | null;
  tokensDelta: number;
  balanceAfter: number;
  note: string | null;
  createdByUserId: string | null;
  createdAt: string;
};

export type AdminWorkspaceLedgerResponse = {
  ok: true;
  items: AdminWorkspaceLedgerEntry[];
  nextCursor: string | null;
};

export function getWorkspaceAiTokenLedger(
  workspaceId: string,
  params: { cursor?: string; limit?: number } = {},
  opts?: { signal?: AbortSignal },
) {
  return apiRequest<AdminWorkspaceLedgerResponse>(
    apiUri.admin.workspaces.aiTokensLedger(workspaceId, params),
    { signal: opts?.signal },
  );
}

/** `POST /admin/workspaces/:wsId/ai-tokens/adjust` — `tokensDelta` non-zero (negative is the
 *  deliberate admin-correction lever, unclamped — task-20-report.md §7's fix-round-1 note), `note`
 *  1–1000 chars required. Gated `platform:ai_tokens_manage`. */
export function adjustWorkspaceAiTokens(
  workspaceId: string,
  body: { tokensDelta: number; note: string },
) {
  return apiRequest<{ ok: true; balance: TokenBalance }>(
    apiUri.admin.workspaces.aiTokensAdjust(workspaceId),
    { method: "POST", body },
  );
}

/** `POST /admin/workspaces/:wsId/ai-tokens/reset-period` — no body. Response is identical in
 *  shape to `GET .../ai-tokens`. Gated `platform:ai_tokens_manage`. */
export function resetWorkspaceAiTokenPeriod(workspaceId: string) {
  return apiRequest<AdminWorkspaceTokenSummary>(
    apiUri.admin.workspaces.aiTokensResetPeriod(workspaceId),
    { method: "POST", body: {} },
  );
}

/** `GET /admin/workspaces/:wsId/api-credentials` / `DELETE .../:id` / `PATCH .../:id` — gated
 *  `platform:workspace_manage` (R2 mapping — task-20-report.md §4), not `platform:ai_tokens_manage`
 *  or `platform:billing_manage`. `scopes` validation is structural only (no catalogue exists
 *  anywhere in the codebase to validate membership against — task-20-report.md §1/§5 finding 2);
 *  this module doesn't invent one either. Never carries `keyHash`. */
export type AdminApiCredentialStatus = "active" | "expired" | "revoked";

export type AdminApiCredential = {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
  status: AdminApiCredentialStatus;
};

export function listWorkspaceApiCredentials(workspaceId: string, opts?: { signal?: AbortSignal }) {
  return apiRequest<{ ok: true; credentials: AdminApiCredential[] }>(
    apiUri.admin.workspaces.apiCredentials(workspaceId),
    { signal: opts?.signal },
  );
}

export function revokeWorkspaceApiCredential(workspaceId: string, credentialId: string) {
  return apiRequest<{ ok: true; id: string; revokedAt: string }>(
    apiUri.admin.workspaces.apiCredential(workspaceId, credentialId),
    { method: "DELETE" },
  );
}

/** At least one of `scopes`/`expiresAt` is required by the server (`EMPTY_PATCH` otherwise); this
 *  module doesn't enforce that client-side beyond what the dialog itself always sends both. */
export function updateWorkspaceApiCredential(
  workspaceId: string,
  credentialId: string,
  body: { scopes?: string[]; expiresAt?: string | null },
) {
  return apiRequest<{ ok: true; credential: AdminApiCredential }>(
    apiUri.admin.workspaces.apiCredential(workspaceId, credentialId),
    { method: "PATCH", body },
  );
}

/** `GET /admin/workspaces/:wsId/api-usage?days=` — `days` clamped server-side to `[1, 90]`. Gated
 *  `platform:workspace_manage`. */
export type AdminWorkspaceApiUsageTotals = {
  schedulerPosts: number;
  automations: number;
  apiRequests: number;
};

export type AdminWorkspaceApiUsageDay = AdminWorkspaceApiUsageTotals & { usageDate: string };

export type AdminWorkspaceApiUsage = {
  ok: true;
  days: number;
  totals: AdminWorkspaceApiUsageTotals;
  series: AdminWorkspaceApiUsageDay[];
};

export function getWorkspaceApiUsage(
  workspaceId: string,
  days?: number,
  opts?: { signal?: AbortSignal },
) {
  return apiRequest<AdminWorkspaceApiUsage>(
    apiUri.admin.workspaces.apiUsage(workspaceId, { days }),
    { signal: opts?.signal },
  );
}

/** §6.8–§6.9 billing — gated `platform:billing_manage` for both reads and writes
 *  (task-20-report.md §4 — the catalogue has only this one key for the whole surface). */
export const BILLING_PLANS = ["FREE", "STARTER", "PRO", "BUSINESS", "AGENCY"] as const;
export type AdminBillingPlan = (typeof BILLING_PLANS)[number];

/**
 * The subscription detail's nested raw `workspace_subscriptions` row — not enumerated in
 * task-20-report.md (it labels the field just `WorkspaceSubscription | null`); typed minimally
 * per Task 13's established discipline for un-enumerated "row" shapes (see
 * `admin-users-api.ts`'s `UserPermissionOverrideRow` for the precedent). The tab never reads this
 * directly — it renders the flattened `plan`/`status`/`billingStatus`/etc. fields alongside it.
 */
export type AdminWorkspaceSubscriptionRow = Record<string, unknown>;

export type AdminWorkspaceSubscriptionDetail = {
  workspaceId: string;
  plan: AdminBillingPlan;
  displayName: string;
  status: string;
  billingStatus: string;
  billingCycleEnd: string | null;
  cancelAtPeriodEnd: boolean;
  limits: Record<string, unknown>;
  features: Record<string, unknown>;
  subscription: AdminWorkspaceSubscriptionRow | null;
  billing: { stripeCustomerId: string | null; stripeSubscriptionId: string | null };
  hasActiveSubscription: boolean;
};

export function getWorkspaceSubscriptionAdmin(
  workspaceId: string,
  opts?: { signal?: AbortSignal },
) {
  return apiRequest<{ ok: true; subscription: AdminWorkspaceSubscriptionDetail | null }>(
    apiUri.admin.workspaces.subscription(workspaceId),
    { signal: opts?.signal },
  );
}

/** Reuses `BillingInvoiceRow` from `billing-api.ts` (the tenant-facing module) — task-20-report.md
 *  §4 doesn't re-enumerate the invoice row's fields, only naming the type `BillingInvoice[]`; this
 *  is that same shape rather than a re-guessed duplicate. */
export function listWorkspaceInvoicesAdmin(
  workspaceId: string,
  params: { limit?: number; offset?: number } = {},
  opts?: { signal?: AbortSignal },
) {
  return apiRequest<{
    ok: true;
    invoices: BillingInvoiceRow[];
    total: number;
    limit: number;
    offset: number;
  }>(apiUri.admin.workspaces.invoices(workspaceId, params), { signal: opts?.signal });
}

/** `POST /admin/workspaces/:wsId/subscription/comp` — local-only upsert, `until` is an ISO date,
 *  `reason` 1–1000 chars. */
export function compWorkspacePlan(
  workspaceId: string,
  body: { plan: AdminBillingPlan; until: string; reason: string },
) {
  return apiRequest<{ ok: true; workspaceId: string; plan: AdminBillingPlan; until: string }>(
    apiUri.admin.workspaces.subscriptionComp(workspaceId),
    { method: "POST", body },
  );
}

/** `PATCH /admin/workspaces/:wsId/subscription/cancel-at-period-end` — 404s `SUBSCRIPTION_NOT_FOUND`
 *  when the workspace has no subscription row yet; calls Stripe when a real (non-`manual_`)
 *  subscription is attached, otherwise flips the local flag only (`viaStripe` says which). */
export function setWorkspaceCancelAtPeriodEnd(workspaceId: string, value: boolean) {
  return apiRequest<{ ok: true; cancelAtPeriodEnd: boolean; viaStripe: boolean }>(
    apiUri.admin.workspaces.subscriptionCancelAtPeriodEnd(workspaceId),
    { method: "PATCH", body: { value } },
  );
}

/** `POST /admin/workspaces/:wsId/subscription/sync` — delegates to the reused
 *  `billingService.syncWorkspaceSubscription`; a real Stripe/Razorpay re-pull, NOT a 501 stub
 *  (task-20-report.md §2's billing-sync decision). Can 400 `BILLING_SYNC_FAILED` (Stripe not
 *  configured / no customer / no subscription found) — callers should surface that message, not
 *  treat it as an unexpected error. */
export function syncWorkspaceSubscriptionAdmin(workspaceId: string) {
  return apiRequest<{ ok: true; subscription: AdminWorkspaceSubscriptionDetail }>(
    apiUri.admin.workspaces.subscriptionSync(workspaceId),
    { method: "POST", body: {} },
  );
}

/* -------------------------------------------------------------------------
 * Support ops (Task 22, spec §6.9, consumed by Task 23's light workspace-drill-down section) —
 * Instagram account health, DM job history, pending-invite management. Gated
 * `platform:workspace_manage` throughout, a different permission from every mutation above this
 * point in the file (`platform:package_manage`/`platform:ai_tokens_manage`/
 * `platform:billing_manage`), so callers self-gate independently — never assume the page's own
 * `USER_MANAGE` grant covers these.
 * ---------------------------------------------------------------------- */

/** `GET /admin/workspaces/:wsId/instagram` — `health` is `null` when no `ig_account_health` row
 *  exists for this account's `ig_user_id` yet (never fabricated). Never carries an access token. */
export type AdminIgAccountHealth = {
  consecutiveFailures: number;
  totalDmsSent: number;
  totalDmsFailed: number;
  rateLimitEvents: number;
  tokenRefreshFailures: number;
  /** 613/2018338 — Meta warning the account is heading for a restriction. */
  abuseWarnings: number;
  /** 551 — deliberately excluded from account health; a copy problem, not an account problem. */
  recipientBlocks: number;
  /** 10/1893063 — Instagram has stopped this account from sending until this passes. */
  restrictedUntil: string | null;
  /** Temporary automatic reduction; null when the account is running at its normal rate. */
  safetyCapPerHour: number | null;
  safetyCapExpiresAt: string | null;
  globalCapPerHour: number;
};

export type AdminIgAccount = {
  id: string;
  platformUserId: string;
  platformUsername: string;
  isActive: boolean;
  followerCount: number | null;
  tokenExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  health: AdminIgAccountHealth | null;
};

export function listWorkspaceInstagramAccounts(
  workspaceId: string,
  opts?: { signal?: AbortSignal },
) {
  return apiRequest<{ ok: true; accounts: AdminIgAccount[] }>(
    apiUri.admin.workspaces.instagram(workspaceId),
    { signal: opts?.signal },
  );
}

/** `POST /admin/workspaces/:wsId/instagram/:id/refresh` — SYNCHRONOUS, always 200 (never 202); a
 *  direct server→Meta call, the same one `sendDm.ts`'s job makes reactively on a dead token. */
export function refreshWorkspaceInstagramToken(workspaceId: string, accountId: string) {
  return apiRequest<{ ok: true; id: string; tokenExpiresAt: string | null }>(
    apiUri.admin.workspaces.instagramRefresh(workspaceId, accountId),
    { method: "POST", body: {} },
  );
}

/**
 * `SKIPPED_PRIVATE_REPLY_USED` is a terminal non-failure. Instagram allows exactly one private
 * reply per comment, ever, and a comment on a shared Instagram account fans out to every
 * workspace attached to it — every workspace but the first stands down here rather than burning
 * an API call and booking a failure against an account nobody misused.
 *
 * This is the admin surface, which per spec §15 is the audited internal exception. In a
 * workspace's own UI the same status must read as an ordinary skip and must never hint that
 * another workspace exists.
 */
export type AdminDmJobStatus =
  | "QUEUED"
  | "SENT"
  | "FAILED"
  | "RETRYING"
  | "SKIPPED_PRIVATE_REPLY_USED";

export type AdminDmJob = {
  id: string;
  automationId: string;
  recipientIgId: string;
  sourceMediaId: string | null;
  status: AdminDmJobStatus;
  sentAt: string | null;
  error: string | null;
  retryCount: number;
  createdAt: string;
};

export function listWorkspaceDmJobs(
  workspaceId: string,
  params: { status?: AdminDmJobStatus; cursor?: string; limit?: number } = {},
  opts?: { signal?: AbortSignal },
) {
  return apiRequest<{ ok: true; items: AdminDmJob[]; nextCursor: string | null }>(
    apiUri.admin.workspaces.dmJobs(workspaceId, params),
    { signal: opts?.signal },
  );
}

export type AdminWorkspaceInviteStatus = "PENDING" | "EXPIRED";

export type AdminWorkspaceInvite = {
  id: string;
  email: string;
  status: AdminWorkspaceInviteStatus;
  roleId: string;
  inviterUserId: string;
  resendCount: number;
  expiresAt: string;
  lastSentAt: string | null;
  createdAt: string;
};

export function listWorkspaceInvitesAdmin(workspaceId: string, opts?: { signal?: AbortSignal }) {
  return apiRequest<{ ok: true; invites: AdminWorkspaceInvite[] }>(
    apiUri.admin.workspaces.invites(workspaceId),
    { signal: opts?.signal },
  );
}

/** Rate-limited by `inviteResendLimiter` (shared with `team.ts`'s tenant-facing resend — see
 *  task-22-report.md §7's concern about the shared "no-ws" bucket across workspaces on this
 *  admin path). */
export function resendWorkspaceInviteAdmin(workspaceId: string, inviteId: string) {
  return apiRequest<{
    ok: true;
    id: string;
    resendCount: number;
    expiresAt: string;
    emailSent: boolean;
    emailProvider: string | null;
  }>(apiUri.admin.workspaces.inviteResend(workspaceId, inviteId), { method: "POST", body: {} });
}

/** `DELETE /admin/workspaces/:wsId/invites/:id` — revoke, sets `status=REVOKED`; never a hard
 *  delete. */
export function revokeWorkspaceInviteAdmin(workspaceId: string, inviteId: string) {
  return apiRequest<{ ok: true }>(apiUri.admin.workspaces.inviteItem(workspaceId, inviteId), {
    method: "DELETE",
  });
}
