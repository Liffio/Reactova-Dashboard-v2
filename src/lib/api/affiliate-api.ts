import { apiUri } from "./apiUri";
import { apiRequest, apiUploadRequest } from "./http";

export type KycTier = "L1" | "L2" | "L3";
export type KycSubmissionStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED";

export type KycStatusResponse = {
  kycStatus: string | null;
  latestSubmission: {
    id: string;
    tier: KycTier;
    status: KycSubmissionStatus;
    submittedAt: string;
    reviewedAt: string | null;
    rejectionReason: string | null;
  } | null;
};

/**
 * Affiliate program terms as configured server-side. Optional because an older
 * API build does not return it — when absent the UI must omit the number
 * entirely rather than fall back to a literal.
 */
export type AffiliateProgramTerms = {
  commissionRate?: number;
  commissionRatePercent?: number;
  minPayoutUsd?: number;
  holdDays?: number;
  currency?: string;
};

export type AffiliateProfile = {
  id: string;
  randomCode: string;
  customCode: string | null;
  totalReferrals: number;
  activeReferrals: number;
  totalEarned: number;
  pendingBalance: number;
  /**
   * The GROSS available figure. It is NOT what can be withdrawn when a reversal is outstanding —
   * gate every payout affordance on `spendableBalance` instead.
   */
  availableBalance: number;
  /**
   * Outstanding debt from commissions reversed after they were paid out. `0` for an affiliate with
   * no reversals; absent on an older server.
   */
  clawbackDebt?: number;
  /**
   * `max(0, availableBalance - clawbackDebt)` — the same quantity the server enforces on a payout
   * request, so the UI and the server cannot disagree. Absent on an older server, in which case
   * fall back to `availableBalance`, which is today's behaviour.
   */
  spendableBalance?: number;
  lifetimePaid: number;
  isSuspended: boolean;
  programConsentAt: string | null;
  programConsentVersion: string | null;
  hasProgramConsent: boolean;
  programTerms?: AffiliateProgramTerms;
};

export type AffiliateDashboard = {
  totalEarned: number;
  availableBalance: number;
  pendingBalance: number;
  lifetimePaid: number;
  totalReferrals: number;
  activeReferrals: number;
  recentCommissions: Array<{
    id: string;
    amount: number;
    status: string;
    workspace: string;
    createdAt: string;
  }>;
  recentPayouts: Array<{
    id: string;
    amount: number;
    status: string;
    method: string;
    requestedAt: string;
  }>;
};

export type AffiliateLinks = {
  randomLink: string;
  customLink: string | null;
  shortRandomLink: string;
  shortCustomLink: string | null;
};

export type AffiliateReferral = {
  id: string;
  email: string;
  referralCode: string;
  isActive: boolean;
  discountUsed: boolean;
  attributedAt: string;
  /**
   * `handle` is the workspace name; the API does not expose the referred
   * workspace's plan, so the UI must not claim to show one.
   */
  workspaces: Array<{ workspaceId: string; handle: string | null; isEligible: boolean }>;
};

export type AffiliatePayout = {
  id: string;
  amount: number;
  status: string;
  method: string;
  requestedAt: string;
};

export function getAffiliateProfile() {
  return apiRequest<AffiliateProfile>(apiUri.affiliate.profile);
}

export function acceptAffiliateProgramConsent(body: {
  version: string;
  acceptedTerms: true;
  acceptedCommissionPolicy: true;
  acceptedPayoutPolicy: true;
}) {
  return apiRequest<AffiliateProfile>(apiUri.affiliate.programConsent, {
    method: "POST",
    body,
  });
}

export function setCustomAffiliateCode(customCode: string) {
  return apiRequest<{ customCode: string }>(apiUri.affiliate.customCode, {
    method: "POST",
    body: { customCode },
  });
}

export function getAffiliateLinks() {
  return apiRequest<AffiliateLinks>(apiUri.affiliate.links);
}

export function getAffiliateDashboard() {
  return apiRequest<AffiliateDashboard>(apiUri.affiliate.dashboard);
}

export function listAffiliateReferrals() {
  return apiRequest<AffiliateReferral[]>(apiUri.affiliate.referrals);
}

export function listAffiliatePayouts() {
  return apiRequest<AffiliatePayout[]>(apiUri.affiliate.payouts);
}

export function getAffiliateKycStatus() {
  return apiRequest<{ status: string; reason?: string | null }>(apiUri.affiliate.payoutsKycStatus);
}

export function requestAffiliatePayout(body: {
  amount: number;
  payoutMethod: string;
  payoutDetails: Record<string, string>;
}) {
  return apiRequest<unknown>(apiUri.affiliate.payoutsRequest, { method: "POST", body });
}

export function getAffiliateKycSubmissionStatus() {
  return apiRequest<KycStatusResponse>(apiUri.affiliate.kycStatus);
}

export function submitAffiliateKyc(input: {
  tier: KycTier;
  panNumber?: string;
  pan?: File;
  aadhaar?: File;
  bankAccount?: File;
}) {
  const formData = new FormData();
  formData.set("tier", input.tier);
  if (input.panNumber) formData.set("panNumber", input.panNumber);
  if (input.pan) formData.set("pan", input.pan);
  if (input.aadhaar) formData.set("aadhaar", input.aadhaar);
  if (input.bankAccount) formData.set("bankAccount", input.bankAccount);
  return apiUploadRequest<{
    id: string;
    tier: KycTier;
    status: KycSubmissionStatus;
    submittedAt: string;
  }>(apiUri.affiliate.kycSubmit, formData);
}

export function validateAffiliateCode(code: string) {
  return apiRequest<{ valid?: boolean }>(apiUri.affiliate.validateCode(code), { token: null });
}
