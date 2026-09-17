import { apiRequest } from "./http";
import { apiUri } from "./apiUri";

export type DiscountCodeKind = "PERCENT" | "FIXED";

export type AdminDiscountCode = {
  id: string;
  code: string;
  kind: DiscountCodeKind;
  percentBps: number | null;
  amountMinor: number | null;
  currency: "INR" | "USD" | null;
  maxDiscountMinor: number | null;
  packageKey: string | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
  durationCycles: number;
  razorpayOfferId: string | null;
  note: string | null;
  createdAt: string;
};

export type DiscountRedemption = {
  id: string;
  userId: string;
  workspaceId: string | null;
  amountMinor: number;
  currency: string;
  redeemedAt: string;
};

export type CreateDiscountCodeInput = {
  code: string;
  kind: DiscountCodeKind;
  percentBps?: number;
  amountMinor?: number;
  currency?: "INR" | "USD";
  maxDiscountMinor?: number;
  packageKey?: string;
  maxRedemptions?: number;
  validFrom?: string;
  validUntil?: string;
  note?: string;
};

export function listDiscountCodes(includeInactive = false) {
  return apiRequest<{ codes: AdminDiscountCode[] }>(
    apiUri.admin.discountCodes.list(includeInactive),
  );
}

export function createDiscountCode(body: CreateDiscountCodeInput) {
  return apiRequest<{ code: AdminDiscountCode }>(apiUri.admin.discountCodes.create, {
    method: "POST",
    body,
  });
}

/**
 * Deactivate, never delete.
 *
 * A redeemed code is the referent for its redemption rows and for the `offersApplied.codeId`
 * recorded on issued invoices — deleting it would orphan a tax document's explanation of its own
 * discount.
 */
export function deactivateDiscountCode(id: string) {
  return apiRequest<{ code: AdminDiscountCode }>(apiUri.admin.discountCodes.deactivate(id), {
    method: "POST",
  });
}

export function listDiscountRedemptions(id: string) {
  return apiRequest<{ redemptions: DiscountRedemption[] }>(
    apiUri.admin.discountCodes.redemptions(id),
  );
}
