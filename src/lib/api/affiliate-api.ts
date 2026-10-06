import { apiUri } from "./apiUri";
import { apiRequest, apiUploadRequest } from "./http";

export type KycTier = "L1" | "L2" | "L3" | "INTL";
export type Residency = "IN" | "INTL";
export type KycSubmissionStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED";

export type KycStatusResponse = {
  kycStatus: string | null;
  residency: Residency | null;
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
  /** Sign-up page: liffio.com/register/?ref=CODE */
  randomLink: string;
  customLink: string | null;
  /** Homepage: liffio.com/?ref=CODE — same attribution, lands on the marketing page. */
  homeRandomLink: string;
  homeCustomLink: string | null;
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
  paidAt: string | null;
};

export type AffiliateCommission = {
  id: string;
  amount: number;
  grossAmount: number;
  status: string;
  currency: string;
  holdUntil: string | null;
  createdAt: string;
};

export type Paged<T> = { items: T[]; page: number; limit: number; total: number };

/** `GET /payouts/kyc-status` — `documentsNeeded` uses the server's document keys (PAN, GOVT_ID…). */
export type PayoutKycStatus = {
  kycRequired: boolean;
  kycStatus: string | null;
  tier: KycTier | null;
  documentsNeeded: string[];
  residency: Residency | null;
};

export type BankScheme = "IBAN" | "US" | "UK" | "AU" | "CA" | "SWIFT";

/** Saved payout destination. Never contains a full account value. */
export type PayoutAccount = {
  residency: Residency;
  countryCode: string;
  legalName: string;
  phoneDialCode: string;
  phoneMasked: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  region: string | null;
  postalCode: string;
  method: "UPI" | "BANK_IN" | "BANK_INTL";
  bankScheme: BankScheme | null;
  detailsMasked: { label: string; display: string };
  updatedAt: string;
};

/** Everything the payout and KYC forms render from; the server owns these lists and rules. */
export type PayoutAccountConfig = {
  countries: Array<{ code: string; name: string; dialCode: string; scheme: BankScheme | null }>;
  indianStates: string[];
  regionOptionalCountries: string[];
  documentLabels: Record<string, string>;
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

export function listAffiliateCommissions(params: { status?: string; page: number; limit: number }) {
  const q = new URLSearchParams({ page: String(params.page), limit: String(params.limit) });
  if (params.status) q.set("status", params.status);
  return apiRequest<Paged<AffiliateCommission>>(`${apiUri.affiliate.commissions}?${q}`);
}

export function getAffiliateKycStatus() {
  return apiRequest<PayoutKycStatus>(apiUri.affiliate.payoutsKycStatus);
}

/** Pays to the saved payout account; only the amount is sent. */
export function requestAffiliatePayout(amount: number) {
  return apiRequest<{ id: string; status: string; amount: number }>(
    apiUri.affiliate.payoutsRequest,
    {
      method: "POST",
      body: { amount },
    },
  );
}

export function getPayoutAccount() {
  return apiRequest<PayoutAccount | null>(apiUri.affiliate.payoutAccount);
}

export function getPayoutAccountConfig() {
  return apiRequest<PayoutAccountConfig>(apiUri.affiliate.payoutAccountConfig);
}

/** Field errors come back on the thrown ApiError's `body.fieldErrors`. */
export function savePayoutAccount(body: Record<string, unknown>) {
  return apiRequest<PayoutAccount>(apiUri.affiliate.payoutAccount, { method: "PUT", body });
}

export function getAffiliateKycSubmissionStatus() {
  return apiRequest<KycStatusResponse>(apiUri.affiliate.kycStatus);
}

/** Upload field name per document key, matching the server's multer fields. */
export const KYC_UPLOAD_FIELD: Record<string, string> = {
  PAN: "pan",
  AADHAAR: "aadhaar",
  BANK_ACCOUNT: "bankAccount",
  GOVT_ID: "govtId",
  ADDRESS_PROOF: "addressProof",
  TRC: "trc",
  FORM_10F: "form10f",
  NO_PE: "noPe",
};

export function submitAffiliateKyc(input: {
  tier: KycTier;
  panNumber?: string;
  /** Keyed by document key (PAN, GOVT_ID…). */
  files: Record<string, File>;
}) {
  const formData = new FormData();
  formData.set("tier", input.tier);
  if (input.panNumber) formData.set("panNumber", input.panNumber);
  for (const [doc, file] of Object.entries(input.files)) {
    formData.set(KYC_UPLOAD_FIELD[doc] ?? doc, file);
  }
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
