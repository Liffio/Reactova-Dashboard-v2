import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

/** Mirrors `GET /admin/affiliate/overview` exactly. */
export type AdminAffiliateOverview = {
  totalAffiliates: number;
  /** Sum of every commission ever accrued, paid or not. */
  totalCommissions: number;
  /** Sum of payouts in status PAID. */
  totalPaidOut: number;
  /** Payouts awaiting review (status REQUESTED). */
  pendingPayouts: number;
  flaggedReferrals: number;
};

export type AdminAffiliateUserRef = {
  id: string;
  email: string | null;
  name: string | null;
};

/**
 * Mirrors an `affiliate_profiles` row as returned by `GET /admin/affiliate/list`
 * (relation `user` is eager-loaded server-side). Decimal columns arrive as
 * strings over the wire — always coerce with `Number()` before formatting.
 */
export type AdminAffiliateRow = {
  id: string;
  userId: string;
  user: AdminAffiliateUserRef | null;
  randomCode: string;
  customCode: string | null;
  totalReferrals: number;
  activeReferrals: number;
  totalEarned: string | number;
  availableBalance: string | number;
  isSuspended: boolean;
};

/**
 * Mirrors an `affiliate_payouts` row as returned by `GET /admin/affiliate/payouts`.
 * `amount` is a Postgres decimal and therefore a string over the wire.
 */
export type AdminAffiliatePayoutRow = {
  id: string;
  amount: string | number;
  currency: string;
  status: string;
  payoutMethod: string;
  requestedAt: string;
  affiliateProfile: (Omit<AdminAffiliateRow, "user"> & { user: AdminAffiliateUserRef | null }) | null;
};

/**
 * Mirrors an `affiliate_referrals` row as returned by `GET /admin/affiliate/fraud/flagged`.
 * This is a REFERRAL, not an affiliate profile — the affiliate is nested under
 * `affiliateProfile.user`.
 */
export type AdminFlaggedReferralRow = {
  id: string;
  referralCode: string;
  isActive: boolean;
  fraudFlagged: boolean;
  attributedAt: string;
  referredUser: AdminAffiliateUserRef | null;
  affiliateProfile: (Omit<AdminAffiliateRow, "user"> & { user: AdminAffiliateUserRef | null }) | null;
};

/** Paginated envelope used by `GET /admin/affiliate/list`. */
export type AdminAffiliateListResponse = {
  items: AdminAffiliateRow[];
  page: number;
  limit: number;
  total: number;
};

export function getAdminAffiliateOverview() {
  return apiRequest<AdminAffiliateOverview>(apiUri.admin.affiliate.overview);
}

export function listAdminAffiliates(params: { q?: string; page?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.page) qs.set("page", String(params.page));
  const suffix = qs.toString();
  return apiRequest<AdminAffiliateListResponse>(
    `${apiUri.admin.affiliate.list}${suffix ? `?${suffix}` : ""}`,
  );
}

/** The endpoint returns a bare array, not an envelope. */
export function listAdminAffiliatePayouts() {
  return apiRequest<AdminAffiliatePayoutRow[]>(apiUri.admin.affiliate.payouts);
}

/** The endpoint returns a bare array of flagged REFERRALS, not an envelope of affiliates. */
export function listAdminFlaggedReferrals() {
  return apiRequest<AdminFlaggedReferralRow[]>(apiUri.admin.affiliate.fraudFlagged);
}

export function getAdminAffiliateMonthlyStats() {
  return apiRequest<Record<string, unknown>>(apiUri.admin.affiliate.statsMonthly);
}

export function getAdminTopAffiliates() {
  return apiRequest<Record<string, unknown>>(apiUri.admin.affiliate.statsTopAffiliates);
}

export function approveAdminPayout(payoutId: string) {
  return apiRequest<unknown>(apiUri.admin.affiliate.payoutApprove(payoutId), { method: "POST" });
}

export function rejectAdminPayout(payoutId: string, reason?: string) {
  return apiRequest<unknown>(apiUri.admin.affiliate.payoutReject(payoutId), {
    method: "POST",
    body: reason ? { reason } : {},
  });
}

export function markAdminPayoutPaid(payoutId: string, reference?: string) {
  return apiRequest<unknown>(apiUri.admin.affiliate.payoutMarkPaid(payoutId), {
    method: "POST",
    body: reference ? { reference } : {},
  });
}

export function approveAdminReferral(referralId: string) {
  return apiRequest<unknown>(apiUri.admin.affiliate.referralApprove(referralId), {
    method: "POST",
  });
}

export function clawbackAdminCommission(commissionId: string, reason?: string) {
  return apiRequest<unknown>(apiUri.admin.affiliate.commissionClawback(commissionId), {
    method: "POST",
    body: reason ? { reason } : {},
  });
}

export function getAdminAffiliateDetail(affiliateId: string) {
  return apiRequest<AdminAffiliateRow>(apiUri.admin.affiliate.byId(affiliateId));
}

export function suspendAdminAffiliate(affiliateId: string, reason?: string) {
  return apiRequest<unknown>(apiUri.admin.affiliate.suspend(affiliateId), {
    method: "POST",
    body: reason ? { reason } : {},
  });
}

export function unsuspendAdminAffiliate(affiliateId: string) {
  return apiRequest<unknown>(apiUri.admin.affiliate.unsuspend(affiliateId), { method: "POST" });
}

export type AdminKycSubmission = {
  id: string;
  affiliateProfileId: string;
  affiliate: { id: string; user?: { email?: string; name?: string } } | null;
  tier: "L1" | "L2" | "L3";
  status: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  documents: Array<{ type: string; fileUrl: string; uploadedAt: string }>;
  submittedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
};

export function listAdminKycQueue(status?: string) {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiRequest<AdminKycSubmission[]>(`${apiUri.admin.affiliate.kycQueue}${suffix}`);
}

export function approveAdminKyc(submissionId: string) {
  return apiRequest<unknown>(apiUri.admin.affiliate.kycApprove(submissionId), { method: "POST" });
}

export function rejectAdminKyc(submissionId: string, reason: string) {
  return apiRequest<unknown>(apiUri.admin.affiliate.kycReject(submissionId), {
    method: "POST",
    body: { reason },
  });
}
