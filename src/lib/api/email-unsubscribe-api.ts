/**
 * Email unsubscribe (plan/email-unsubscribe.md). The public calls carry the signed token from the
 * email link — no session is needed or used. The admin call is gated `platform:metrics_read`.
 */
import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

export type UnsubscribeScope = "type" | "all";

/** Mirrors the server's `UNSUBSCRIBE_REASONS`; labels are UI copy only. */
export const UNSUBSCRIBE_REASONS = [
  { value: "too_frequent", label: "I get too many emails" },
  { value: "not_relevant", label: "The emails aren't relevant to me" },
  { value: "prefer_in_app", label: "I'd rather see these in the app" },
  { value: "no_longer_use", label: "I no longer use Liffio" },
  { value: "never_signed_up", label: "I never asked to receive these" },
  { value: "other", label: "Something else" },
] as const;
export type UnsubscribeReason = (typeof UNSUBSCRIBE_REASONS)[number]["value"];

export const unsubscribeReasonLabel = (value: string | null): string =>
  UNSUBSCRIBE_REASONS.find((r) => r.value === value)?.label ?? "No reason given";

export type UnsubscribeDescription = {
  typeKey: string;
  typeLabel: string;
  workspaceName: string;
  /** Masked, e.g. "j***@example.com". */
  email: string;
  subscribed: boolean;
};

export function describeUnsubscribe(token: string) {
  return apiRequest<UnsubscribeDescription>(apiUri.public.emailUnsubscribe.describe(token), {
    token: null,
    workspaceId: null,
  });
}

export function submitUnsubscribe(input: {
  token: string;
  scope: UnsubscribeScope;
  reason?: UnsubscribeReason | null;
  reasonText?: string | null;
}) {
  return apiRequest<{ ok: true; eventId: string }>(apiUri.public.emailUnsubscribe.unsubscribe, {
    method: "POST",
    body: input,
    token: null,
    workspaceId: null,
  });
}

export function submitUnsubscribeReason(input: {
  token: string;
  eventId: string;
  reason: UnsubscribeReason;
  reasonText?: string | null;
}) {
  return apiRequest<{ ok: true }>(apiUri.public.emailUnsubscribe.reason, {
    method: "POST",
    body: input,
    token: null,
    workspaceId: null,
  });
}

export function resubscribe(input: { token: string; scope: UnsubscribeScope }) {
  return apiRequest<{ ok: true }>(apiUri.public.emailUnsubscribe.resubscribe, {
    method: "POST",
    body: input,
    token: null,
    workspaceId: null,
  });
}

export type AdminEmailUnsubscribes = {
  days: number;
  totals: { unsubscribes: number; viaPage: number; viaOneClick: number; resubscribes: number };
  byReason: Array<{ reason: string; count: number }>;
  byType: Array<{ typeKey: string; typeLabel: string; scope: UnsubscribeScope; count: number }>;
  items: Array<{
    id: string;
    typeKey: string;
    typeLabel: string;
    scope: UnsubscribeScope;
    source: "page" | "one_click" | "resubscribe";
    reason: string | null;
    reasonText: string | null;
    createdAt: string;
    userId: string | null;
    userEmail: string | null;
    workspaceId: string | null;
    workspaceName: string | null;
  }>;
  page: number;
  limit: number;
  total: number;
};

export function getAdminEmailUnsubscribes(params: { days: number; page: number; limit: number }) {
  return apiRequest<AdminEmailUnsubscribes>(apiUri.admin.emailUnsubscribes(params));
}
