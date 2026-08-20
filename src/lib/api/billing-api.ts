import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

export type BillingPlanConfig = {
  plan: string;
  displayName: string;
  description: string;
  highlights: string[];
  /** Display order. PRO sorts LAST here because it is retired. Not a tier comparison — see `rank`. */
  sortOrder: number;
  /**
   * Tier order, from the server's `PLAN_ORDER`. Use this and only this to decide
   * upgrade-versus-downgrade.
   *
   * It deliberately DISAGREES with `sortOrder` about PRO: `sortOrder` puts it last (retired,
   * belongs at the bottom of the page), `rank` puts it beside GROWTH (it carries Growth's
   * capabilities and limits). Comparing tiers with `sortOrder` would rank retired PRO above AGENCY.
   *
   * `null` means the server does not recognise the plan — treat as not comparable, never as 0.
   */
  rank: number | null;
  /**
   * Is this tier on the commercial ladder at all? `false` for retired tiers.
   *
   * NOT the same as "can I check out right now" — that is `checkout` below. A tier can be sellable
   * with no checkout id yet, which is exactly GROWTH's state until the SKUs are published.
   */
  sellable: boolean;
  pricing: {
    monthlyUsd: number;
    quarterlyUsd: number | null;
    yearlyUsd: number | null;
  };
  limits: Record<string, number>;
  features: Record<string, boolean>;
  gates: Record<string, string>;
  checkout?: {
    stripe: Record<"monthly" | "quarterly" | "yearly", boolean>;
    razorpay: Record<"monthly" | "quarterly" | "yearly", boolean>;
  };
};

export type BillingConfigResponse = {
  mode: "sandbox" | "production";
  isSandbox: boolean;
  currency: string;
  razorpayCurrency: string;
  usdToInrRate: number;
  providers: {
    stripe: { configured: boolean; publishableKey: string | null; webhookConfigured: boolean };
    razorpay: { configured: boolean; keyId: string | null; webhookConfigured: boolean };
  };
  plans: BillingPlanConfig[];
};

export type BillingSubscription = {
  workspaceId: string;
  plan: string;
  displayName: string;
  status: string;
  billingStatus: string;
  billingCycleEnd: string | null;
  cancelAtPeriodEnd: boolean;
  limits: Record<string, number>;
  features: Record<string, boolean>;
  hasActiveSubscription: boolean;
  /**
   * Already sent by `getWorkspaceSubscription`; declared here in S3P.2a because the billing page
   * needs it to decide whether the Stripe customer portal can work at all.
   *
   * `stripeCustomerId` is non-null only for a workspace that was billed through Stripe. Under D19
   * Stripe is dormant, so this is null for every new customer and non-null for the existing rows
   * that still legitimately have a portal.
   */
  billing?: {
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
  };
};

export type BillingInvoiceRow = {
  id: string;
  workspaceId: string;
  provider: string;
  providerInvoiceId: string;
  amountCents: number;
  currency: string;
  status: string;
  plan: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string | null;
  hostedInvoiceUrl: string | null;
  pdfUrl: string | null;
  createdAt: string;
  workspace?: { id: string; igHandle: string | null };
};

export type CheckoutInput = {
  plan: string;
  interval: "monthly" | "quarterly" | "yearly";
  provider?: "stripe" | "razorpay";
};

export function getBillingConfig() {
  return apiRequest<BillingConfigResponse>(apiUri.billing.config);
}

export function getBillingSubscription(workspaceId: string) {
  return apiRequest<BillingSubscription>(apiUri.billing.subscription, { workspaceId });
}

export function listBillingInvoices(workspaceId: string) {
  return apiRequest<{ invoices: BillingInvoiceRow[] }>(apiUri.billing.invoices, { workspaceId });
}

export function listAllBillingInvoices(workspaceId: string) {
  return apiRequest<{ invoices: BillingInvoiceRow[] }>(apiUri.billing.invoicesAll, {
    workspaceId,
  });
}

export type CheckoutResponse = {
  provider: "stripe" | "razorpay";
  checkoutUrl: string | null;
  /** Razorpay only — the subscription id the checkout.js modal is opened with. */
  subscriptionId?: string;
  status?: string;
};

export type PackageCheckoutInput = {
  packageId: string;
  interval: "monthly" | "yearly";
  /**
   * The buyer's state, for Indian GST place of supply. (S4.4c)
   *
   * Required by the server when the resolved currency is INR — it decides IGST vs CGST+SGST — and
   * refused with `PLACE_OF_SUPPLY_REQUIRED` if absent. The currency itself is **not** sent: the
   * server derives it from the account's country, so a client cannot ask to be charged in one.
   */
  placeOfSupplyState?: string;
};

/**
 * Buy a PACKAGE. (S5.2)
 *
 * 🚩 This is the path that makes packages the commercial reality rather than an admin-console
 * artefact. `POST /billing/package-checkout` has existed and been fully implemented since Phase 5.1
 * with **no frontend caller at all**, so every purchase went through the legacy plan path and landed
 * on the `Plan` enum — **which has no Growth**, by deliberate design (`Package.entity.ts`: packages
 * exist so new tiers can be sold without widening an enum billing, quotas and provider mapping all
 * key off).
 *
 * ⚠️ **No `provider` is sent.** D19 made Razorpay the only gateway and S4.4b removed the client's
 * say: `resolveCheckoutProvider` answers it server-side. A `provider` field here would be a fourth
 * place that could disagree.
 *
 * ⚠️ **No quarterly.** `packageCheckoutSchema` accepts monthly and yearly only, and
 * `intervalToDb` throws `UNSUPPORTED_INTERVAL` otherwise — packages carry no quarterly price
 * column. The plan path still offers quarterly for the tiers that predate packages.
 */
export function createPackageCheckout(workspaceId: string, body: PackageCheckoutInput) {
  return apiRequest<CheckoutResponse>(apiUri.billing.packageCheckout, {
    method: "POST",
    workspaceId,
    body,
  });
}

export function createBillingCheckout(workspaceId: string, body: CheckoutInput) {
  return apiRequest<CheckoutResponse>(apiUri.billing.checkout, {
    method: "POST",
    workspaceId,
    body,
  });
}

export type RazorpayVerifyInput = {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
};

/** Server-side HMAC check of the checkout modal's success payload; returns the fresh subscription. */
export function verifyRazorpayCheckout(workspaceId: string, body: RazorpayVerifyInput) {
  return apiRequest<BillingSubscription>(apiUri.billing.razorpayVerify, {
    method: "POST",
    workspaceId,
    body,
  });
}

export function createBillingPortalSession(workspaceId: string) {
  return apiRequest<{ url: string }>(apiUri.billing.portal, { method: "POST", workspaceId });
}

export function syncBilling(workspaceId: string, body: { sessionId?: string } = {}) {
  return apiRequest<BillingSubscription>(apiUri.billing.sync, {
    method: "POST",
    workspaceId,
    body,
  });
}

export function cancelBillingSubscription(workspaceId: string) {
  return apiRequest<{ plan: string; message?: string }>(apiUri.billing.cancel, {
    method: "POST",
    workspaceId,
  });
}
