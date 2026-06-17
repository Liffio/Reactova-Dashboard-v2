import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

export type AffiliateProfile = {
  id: string;
  randomCode: string;
  customCode: string | null;
  totalReferrals: number;
  activeReferrals: number;
  totalEarned: number;
  pendingBalance: number;
  availableBalance: number;
  lifetimePaid: number;
  isSuspended: boolean;
  programConsentAt: string | null;
  programConsentVersion: string | null;
  hasProgramConsent: boolean;
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
    plan: string;
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
  isActive: boolean;
  attributedAt: string;
  workspaces: Array<{ plan: string; isEligible: boolean }>;
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

export function validateAffiliateCode(code: string) {
  return apiRequest<{ valid?: boolean }>(apiUri.affiliate.validateCode(code), { token: null });
}
