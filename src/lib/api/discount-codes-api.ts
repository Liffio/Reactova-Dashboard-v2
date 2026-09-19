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
  /** How many times ONE person may use it. Null means unlimited. (R7) */
  perUserLimit: number | null;
  redemptionCount: number;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
  durationCycles: number;
  razorpayOfferId: string | null;
  note: string | null;
  createdAt: string;
  deletedAt?: string | null;
  /**
   * Worked out by the server, not by this client. (R7)
   *
   * "Is this code working right now" is one question with four inputs, and deriving it in two
   * screens is how two screens end up disagreeing about the same code. The order matches the order
   * `validateDiscountCode` refuses in, so the status shown is the reason a customer would be given.
   */
  status?: "deleted" | "paused" | "scheduled" | "expired" | "exhausted" | "live";
  usage?: { used: number; total: number | null };
};

export type DiscountRedemption = {
  id: string;
  userId: string;
  /** Who, rather than a uuid. Joined server side so the list does not need N calls. (R7) */
  userEmail: string | null;
  userName: string | null;
  workspaceId: string | null;
  workspaceName: string | null;
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
  perUserLimit?: number;
  validFrom?: string;
  validUntil?: string;
  durationCycles?: number;
  note?: string;
};

/**
 * What an edit may change. (R7)
 *
 * `code` and `kind` are absent on purpose: both are baked into redemptions that already happened
 * and into `offersApplied` on issued invoices, so changing either rewrites a tax document after the
 * fact. Null clears a field; omitted leaves it alone.
 */
export type UpdateDiscountCodeInput = {
  percentBps?: number | null;
  amountMinor?: number | null;
  currency?: "INR" | "USD" | null;
  maxDiscountMinor?: number | null;
  packageKey?: string | null;
  maxRedemptions?: number | null;
  perUserLimit?: number | null;
  validFrom?: string | null;
  validUntil?: string | null;
  durationCycles?: number;
  note?: string | null;
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

export function updateDiscountCode(id: string, body: UpdateDiscountCodeInput) {
  return apiRequest<{ code: AdminDiscountCode }>(apiUri.admin.discountCodes.update(id), {
    method: "PATCH",
    body,
  });
}

/** Resume a paused code. */
export function activateDiscountCode(id: string) {
  return apiRequest<{ code: AdminDiscountCode }>(apiUri.admin.discountCodes.activate(id), {
    method: "POST",
  });
}

/**
 * Soft delete. Sets `deletedAt` and `isActive = false`, so the code is refused at redemption while
 * every redemption row and every invoice that cites it keeps pointing at a row that still exists.
 */
export function deleteDiscountCode(id: string) {
  return apiRequest<{ code: AdminDiscountCode }>(apiUri.admin.discountCodes.remove(id), {
    method: "DELETE",
  });
}
