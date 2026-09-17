import { apiUri } from "./apiUri";
import { API_BASE, apiRequest } from "./http";
import { authStore } from "@/lib/auth/auth-store";

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
   * NOT the same as "can I check out right now" — availability-to-purchase comes from the PACKAGE
   * catalogue (`getSellablePackages`/`package_prices`), not from this field. A tier can be sellable
   * with no package price published yet, which is exactly GROWTH's state until the SKUs are
   * published. (The server used to also carry a `checkout: { stripe, razorpay }` field here for
   * this same question; it had no reader on this side either — see `lib/billing/pricing.ts` — and
   * was removed alongside the retired `POST /billing/checkout` plan path.)
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
};

export type BillingConfigResponse = {
  mode: "sandbox" | "production";
  isSandbox: boolean;
  currency: string;
  razorpayCurrency: string;
  /*
   * `usdToInrRate` was declared here and is NOT returned by `GET /billing/config` — the payload
   * has no FX field at all. Reading it yielded `undefined`, which is how `usd * (config.usdToInrRate ?? 84)`
   * came to inflate every INR price by a hardcoded 84. INR prices are authored per tier on the
   * package catalogue and are read, never converted, so the field is removed rather than filled in.
   */
  providers: {
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
  /** `LFO/2026-27/00427` — null for a pre-Task-5 row issued before invoice numbering existed. */
  invoiceNumber: string | null;
  hostedInvoiceUrl: string | null;
  pdfUrl: string | null;
  createdAt: string;
  workspace?: { id: string; igHandle: string | null };
  /**
   * Whether the stored HTML / PDF documents exist.
   *
   * 🔴 Never infer these from `invoiceNumber`. An amount-only fallback row has neither, and every
   * invoice issued before the PDF renderer was fixed has a number and HTML but no PDF — so a
   * download control keyed on the number would 404. The API computes both as existence checks on
   * the columns the download routes themselves key on.
   *
   * Optional because `/billing/invoices/all` does not compute them.
   */
  hasDocument?: boolean;
  hasPdf?: boolean;
  /**
   * Whether a PDF can still be produced, which is not the same question as whether one exists.
   *
   * `hasPdf` alone left the download button permanently dead for any invoice whose issuance-time
   * render failed. This says the state is recoverable: the row keeps the model the document is
   * composed from, so asking for it will produce the real document rather than a reconstruction.
   */
  canRenderPdf?: boolean;
};

export type CheckoutInput = {
  plan: string;
  interval: "monthly" | "quarterly" | "yearly";
  provider?: "razorpay";
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

/**
 * Fetch a stored invoice document for viewing. (Task 7, plan/gst-invoicing.md)
 *
 * 🔴 `hostedInvoiceUrl` (e.g. `/api/v1/billing/invoices/<id>/view`) sits behind `requireAuth`, which
 * reads the bearer token from the `Authorization` header only — there is no cookie fallback. A plain
 * `<a href={hostedInvoiceUrl}>` opened in a new tab is a bare browser navigation, so it never attaches
 * that header and the request 401s. Fetched manually here instead — same shape as
 * `leads-api.ts`'s `exportLeadsCsv` and `admin.affiliates.tsx`'s `openKycDocument` — and the caller
 * opens the returned blob in a new tab, which renders the stored HTML exactly as `text/html`.
 */
export async function fetchInvoiceViewHtml(
  workspaceId: string,
  hostedInvoiceUrl: string,
): Promise<Blob> {
  const token = authStore.getState().accessToken;
  const res = await fetch(`${API_BASE}${hostedInvoiceUrl}`, {
    credentials: "include",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "x-workspace-id": workspaceId,
    },
  });
  if (!res.ok) {
    throw new Error("Unable to open invoice right now");
  }
  return res.blob();
}

/**
 * Ask the server to produce a PDF that does not exist yet, and wait for it.
 *
 * The server renders on its worker rather than in the request — PDF composition is kept off the
 * API process on purpose (see the route's comment: a 1 GiB cap, no swap, that queue pinned to
 * concurrency 1). So `POST` returns 202 "asked for" and the bytes appear shortly afterwards. This
 * polls the `GET` until they do.
 *
 * ⚠️ Bounded, and it gives up rather than spinning. A worker that is down is the exact condition
 * that produced the missing PDF in the first place, so "the queue never drains" is a live
 * possibility here, not a hypothetical. Ten attempts over roughly 20 seconds, then an honest error.
 */
export async function requestInvoicePdf(workspaceId: string, invoiceId: string): Promise<Blob> {
  const token = authStore.getState().accessToken;
  const res = await fetch(`${API_BASE}${apiUri.billing.invoicePdf(invoiceId)}`, {
    method: "POST",
    credentials: "include",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "x-workspace-id": workspaceId,
    },
  });
  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? "This invoice cannot be turned into a PDF"
        : "Unable to prepare this invoice right now",
    );
  }

  // `{ ready: true }` means it was already there, so skip straight to the download.
  const body = (await res.json().catch(() => ({}))) as { ready?: boolean };
  if (body.ready) return fetchInvoicePdf(workspaceId, invoiceId);

  for (let attempt = 0; attempt < 10; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    try {
      return await fetchInvoicePdf(workspaceId, invoiceId);
    } catch {
      // Still rendering. The GET 404s until the bytes are stored, which is the signal to wait.
    }
  }
  throw new Error("Your invoice is still being prepared. Try again in a minute.");
}

/**
 * Fetch a stored invoice PDF.
 *
 * Same reason this is a manual `fetch` rather than an `<a href>` as `fetchInvoiceViewHtml` above:
 * the route sits behind `requireAuth`, which reads the bearer token from the `Authorization` header
 * only, and a bare browser navigation attaches no such header. The caller saves the returned blob.
 */
export async function fetchInvoicePdf(workspaceId: string, invoiceId: string): Promise<Blob> {
  const token = authStore.getState().accessToken;
  const res = await fetch(`${API_BASE}${apiUri.billing.invoicePdf(invoiceId)}`, {
    credentials: "include",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "x-workspace-id": workspaceId,
    },
  });
  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? "No PDF is available for this invoice yet"
        : "Unable to download invoice right now",
    );
  }
  return res.blob();
}

/**
 * Hands the browser a blob to save under a given filename.
 *
 * The object URL is revoked on the next tick rather than immediately: revoking it synchronously
 * after `click()` races the download in some browsers and produces an empty file.
 */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** `LFO/2026-27/00042` contains slashes, which a filename may not. */
export function invoiceFileName(
  invoice: { invoiceNumber: string | null; id: string },
  ext: string,
): string {
  return `${(invoice.invoiceNumber ?? invoice.id).replace(/[^A-Za-z0-9._-]/g, "-")}.${ext}`;
}

export type CheckoutResponse = {
  provider: "razorpay";
  checkoutUrl: string | null;
  /** Razorpay only — the subscription id the checkout.js modal is opened with. */
  subscriptionId?: string;
  status?: string;
};

/**
 * A package a tenant may buy. (S4.7)
 *
 * ⚠️ Non-public and inactive packages are excluded **server-side**, in the query. The client does
 * not filter — which is deliberate: `is_public` is what keeps Growth off the pricing page until D2,
 * and a visibility rule enforced in a React component is one refactor away from not being enforced.
 */
export type SellablePackage = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  sortOrder: number;
  badge: string | null;
  monthlyPriceUsdCents: number;
  yearlyPriceUsdCents: number | null;
  monthlyPriceInrPaise: number | null;
  yearlyPriceInrPaise: number | null;
};

export function getSellablePackages() {
  return apiRequest<{ packages: SellablePackage[] }>(apiUri.billing.packages);
}

export type PackageCheckoutInput = {
  packageId: string;
  interval: "monthly" | "yearly";
  /**
   * 🔴 `placeOfSupplyState` IS GONE FROM THIS BODY. (Billing address capture, D7)
   *
   * It decided IGST vs CGST+SGST and used to be sent from here, which meant the client asserted
   * the input to its own tax treatment. The server now reads it off the stored billing profile
   * (`PUT /billing/profile`), so checkout refuses with `BILLING_PROFILE_REQUIRED` rather than
   * `PLACE_OF_SUPPLY_REQUIRED` when it is missing — and the fix is to send the buyer to
   * `/checkout/review`, not to add a field back here.
   *
   * Currency is still not sent either, for the same reason it never was: the server derives it
   * from the account country, so a client cannot ask to be charged in one.
   */
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

/**
 * The workspace's billing address.
 *
 * Captured on `/checkout/review` before any payment can start, and snapshotted onto every
 * invoice at issue time — so this is the live record, not the document. Editing it later never
 * alters an invoice already issued.
 */
export type BillingProfile = {
  id: string;
  workspaceId: string;
  country: string;
  state: string;
  gstStateCode: string | null;
  postalCode: string;
  /** Optional free text, one block — not parsed into line1 / line2 / city. */
  address: string | null;
};

/** A previous profile from another workspace the same user owns, offered to save retyping. */
export type BillingProfilePrefill = Omit<BillingProfile, "id" | "workspaceId">;

export type BillingProfileResponse = {
  profile: BillingProfile | null;
  /** Populated only when `profile` is null — it can never overwrite a saved address. */
  prefill: BillingProfilePrefill | null;
};

export function getBillingProfile(workspaceId: string) {
  return apiRequest<BillingProfileResponse>(apiUri.billing.profile, { workspaceId });
}

export type BillingProfileInput = Omit<BillingProfile, "id" | "workspaceId">;

/**
 * Upsert the address.
 *
 * Also writes back `users.country` when it changed, in the same transaction — the two must never
 * disagree, because currency is resolved from the account country while the tax treatment is
 * derived from this address.
 *
 * On a validation failure the server returns `{ code: "BILLING_PROFILE_INVALID", fieldErrors }`;
 * on a country change blocked by a live subscription, `{ code: "COUNTRY_LOCKED" }`.
 */
export function saveBillingProfile(workspaceId: string, body: BillingProfileInput) {
  return apiRequest<{ profile: BillingProfile }>(apiUri.billing.profile, {
    method: "PUT",
    workspaceId,
    body,
  });
}

/**
 * One line of the first-payment breakdown — a discount that was applied, and what it took off.
 */
export type FirstPaymentLine = {
  kind: "intro" | "referral";
  label: string;
  /** Always positive, in minor units (paise for INR, cents for USD). */
  deductionMinor: number;
};

/**
 * What a customer pays today for a package, versus what it renews at.
 *
 * 🚩 Server-resolved, always. Eligibility depends on payment history and account age, and the
 * amount depends on offer rules the client has no business knowing — and `createPackageCheckout`
 * calls the same resolver, so what is displayed here and what Razorpay charges cannot drift.
 */
/** Why a discount code was refused. Mapped to copy by `discountRejectionMessage`. */
export type DiscountRejection =
  | "not_found"
  | "inactive"
  | "not_started"
  | "expired"
  | "exhausted"
  | "already_used"
  | "wrong_package"
  | "wrong_currency"
  | "unsupported_duration";

/**
 * What to tell the customer when a code does not apply.
 *
 * Deliberately specific. "Invalid code" for all nine cases makes an expired code and a typo look
 * identical, and the person who cannot tell them apart opens a support ticket for both.
 */
export function discountRejectionMessage(reason: DiscountRejection): string {
  switch (reason) {
    case "not_found":
      return "We do not recognise that code";
    case "inactive":
      return "That code is no longer active";
    case "not_started":
      return "That code is not active yet";
    case "expired":
      return "That code has expired";
    case "exhausted":
      return "That code has been fully claimed";
    case "already_used":
      return "You have already used that code";
    case "wrong_package":
      return "That code does not apply to this plan";
    case "wrong_currency":
      return "That code cannot be used in this currency";
    case "unsupported_duration":
      return "That code cannot be applied automatically. Contact support.";
  }
}

export type FirstPaymentQuote = {
  packageId: string;
  packageName: string;
  interval: "monthly" | "yearly";
  currency: "INR" | "USD";
  /** What every payment AFTER the first one costs. */
  listAmountMinor: number;
  /** What is due today. */
  amountMinor: number;
  lines: FirstPaymentLine[];
  introApplied: boolean;
  referralApplied: boolean;
  /** The code that actually applied, or null when none did or it lost to the intro offer. */
  codeApplied?: { codeId: string; code: string } | null;
  /**
   * Why a typed code did not apply. Present with a full-price quote rather than an error, so a
   * mistyped code still shows a price and the customer is told what went wrong.
   */
  discountRejection?: DiscountRejection | null;
  differsFromList: boolean;
  /**
   * How much time the first payment buys.
   *
   * `"month"` means one month regardless of the plan's interval — the ₹49 intro, which on a
   * yearly plan buys a month and then charges the full year. `"interval"` means one full billing
   * cycle at a reduced price. The summary copy has to say which, or a yearly buyer reads "₹49"
   * and reasonably concludes they have bought a year.
   */
  firstPeriod: "month" | "interval";
};

export function getFirstPaymentQuote(
  workspaceId: string,
  params: { packageId: string; interval: "monthly" | "yearly"; discountCode?: string },
) {
  // An empty box must not become `discountCode=`, which the server would read as a code to look up
  // and reject, putting "we do not recognise that code" under an input nobody typed in.
  const query = new URLSearchParams({
    packageId: params.packageId,
    interval: params.interval,
    ...(params.discountCode?.trim() ? { discountCode: params.discountCode.trim() } : {}),
  }).toString();
  return apiRequest<FirstPaymentQuote>(`${apiUri.billing.quote}?${query}`, { workspaceId });
}
