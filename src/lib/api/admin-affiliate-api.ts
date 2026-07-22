import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

export type AdminAffiliateOverview = {
  totalAffiliates: number;
  totalReferrals: number;
  totalCommissionsPaid: number;
  pendingPayouts: number;
  [key: string]: unknown;
};

export type AdminAffiliateRow = {
  id: string;
  email?: string;
  name?: string;
  randomCode?: string;
  customCode?: string | null;
  totalReferrals?: number;
  totalEarned?: number;
  availableBalance?: number;
  isSuspended?: boolean;
  [key: string]: unknown;
};

export type AdminAffiliatePayoutRow = {
  id: string;
  amount: number;
  status: string;
  method: string;
  requestedAt: string;
  [key: string]: unknown;
};

export function getAdminAffiliateOverview() {
  return apiRequest<AdminAffiliateOverview>(apiUri.admin.affiliate.overview);
}

export function listAdminAffiliates(params: { q?: string; page?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.page) qs.set("page", String(params.page));
  const suffix = qs.toString();
  return apiRequest<{ affiliates: AdminAffiliateRow[]; total?: number }>(
    `${apiUri.admin.affiliate.list}${suffix ? `?${suffix}` : ""}`,
  );
}

export function listAdminAffiliatePayouts() {
  return apiRequest<{ payouts: AdminAffiliatePayoutRow[] }>(apiUri.admin.affiliate.payouts);
}

export function listAdminFlaggedAffiliates() {
  return apiRequest<{ flagged: AdminAffiliateRow[] }>(apiUri.admin.affiliate.fraudFlagged);
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
