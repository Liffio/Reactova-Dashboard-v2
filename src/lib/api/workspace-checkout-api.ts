import { apiUri } from "./apiUri";
import { apiRequest } from "./http";
import type { BillingProfileInput } from "./billing-api";

/**
 * What a new paid workspace costs this user today.
 *
 * 🔴 Always fetched, never computed. Intro pricing and affiliate referrals depend on payment
 * history and account age, which the client cannot see — and the same resolver feeds what Razorpay
 * is told to charge, so displaying anything else would let the two disagree.
 */
export type WorkspaceCheckoutQuote = {
  packageId: string;
  packageName: string;
  interval: "monthly" | "yearly";
  currency: "INR" | "USD";
  /** What every payment AFTER the first one costs, in minor units. */
  listAmountMinor: number;
  /** What is due today, in minor units. */
  amountMinor: number;
  introApplied: boolean;
  referralApplied: boolean;
  differsFromList: boolean;
  /**
   * How much time the first payment buys. `"month"` even on a yearly plan when the intro applies —
   * the copy has to say so, or a yearly buyer reads one number and concludes they bought a year.
   */
  firstPeriod: "month" | "interval";
  /** This package sells an agency group rather than a single workspace. */
  grantsGroup: boolean;
  /** How many workspaces that group gets. Never hardcode 20. */
  groupSlotLimit: number | null;
  /** Which code applied, when one did. The deduction is `listAmountMinor` minus `amountMinor`. (R2) */
  discountApplied: { code: string } | null;
  /** Why a typed code was refused, so the box can say something useful. (R2) */
  discountRejection: import("./billing-api").DiscountRejection | null;
};

export type CheckoutIntentStatus = "PENDING" | "PAID" | "FAILED" | "EXPIRED";

export type StartedCheckout = {
  intentId: string;
  provider: "razorpay";
  subscriptionId: string;
  checkoutUrl: string | null;
  amountMinor: number;
  currency: "INR" | "USD";
};

export type CheckoutIntent = {
  intentId: string;
  status: CheckoutIntentStatus;
  /** Set once settled. This is the workspace to switch to. */
  workspaceId: string | null;
  groupId: string | null;
  workspaceName: string;
};

export function getWorkspaceCheckoutQuote(params: {
  packageId: string;
  interval: "monthly" | "yearly";
  /** Priced, never consumed. Spending happens at settlement. (R2) */
  discountCode?: string;
}) {
  // An empty box must not become `discountCode=`, which the server would read as a code to look up.
  const query = new URLSearchParams({
    packageId: params.packageId,
    interval: params.interval,
    ...(params.discountCode?.trim() ? { discountCode: params.discountCode.trim() } : {}),
  }).toString();
  return apiRequest<WorkspaceCheckoutQuote>(`${apiUri.workspaceCheckout.quote}?${query}`);
}

/**
 * Start the purchase. Writes a pending intent server-side and returns a Razorpay subscription.
 *
 * No workspace exists yet and none is created until payment confirms, so there is deliberately no
 * `workspaceId` anywhere in this flow.
 */
export function startWorkspaceCheckout(body: {
  name: string;
  packageId: string;
  interval: "monthly" | "yearly";
  billingAddress: BillingProfileInput;
  /** Applies to the NEW workspace's purchase, never to any existing one. (R2) */
  discountCode?: string;
}) {
  return apiRequest<StartedCheckout>(apiUri.workspaceCheckout.start, { method: "POST", body });
}

/**
 * Settle from the browser as soon as the Razorpay modal returns.
 *
 * Not the only settlement path — the webhook settles the same purchase independently — but without
 * it the customer watches a spinner until a webhook lands. Settlement is idempotent, so whichever
 * arrives first wins and the other is a no-op.
 */
export function verifyWorkspaceCheckout(
  intentId: string,
  body: {
    razorpay_payment_id: string;
    razorpay_subscription_id: string;
    razorpay_signature: string;
  },
) {
  return apiRequest<{
    intentId: string;
    status: "PAID";
    workspaceId: string;
    groupId: string | null;
  }>(apiUri.workspaceCheckout.verify(intentId), { method: "POST", body });
}

/** Poll target while the Razorpay modal is open, and the fallback if verify never runs. */
export function getWorkspaceCheckoutIntent(intentId: string) {
  return apiRequest<CheckoutIntent>(apiUri.workspaceCheckout.intent(intentId));
}
