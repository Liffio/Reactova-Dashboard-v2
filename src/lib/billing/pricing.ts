import type { SellablePackage } from "@/lib/api/billing-api";

export type GatewayKey = "stripe" | "razorpay";
/** The intervals a PACKAGE can be bought on. Quarterly is a plan-path concept and is not one. */
export type PaidInterval = "monthly" | "yearly";

export type GatewayAvailability = {
  value: GatewayKey;
  available: boolean;
  reason?: string;
};

/**
 * Pricing and purchasability, sourced from the PACKAGE catalogue.
 *
 * ## Why this module exists
 *
 * Two live defects shared one cause: the billing page asked `/billing/config` — the **plan**
 * payload — two questions only `/billing/packages` — the **package** payload — can answer. Both
 * payloads were already being fetched by the page.
 *
 * 🔴 **1 · Purchasability.** `gatewayOptions` derived availability from `planCfg.checkout[gateway]`,
 * which is built server-side from `resolveProviderPriceIds` → the `RAZORPAY_PLAN_*` / `STRIPE_PRICE_*`
 * env SKUs. `GROWTH` is hardcoded to empty strings in `billing.config.ts` and has **no env vars
 * declared at all** — so every flag was `false`, `handleUpgradeClick` returned early with *"not
 * available for online checkout yet"*, and the gateway chooser never opened.
 *
 * ⚠️ The purchase itself was already correct: `startCheckout` prefers `POST /billing/package-checkout`
 * whenever a package exists. **The availability check ran first and never let anyone reach it.** The
 * two functions disagreed about what makes a tier buyable; this module is the single answer.
 *
 * 🔴 **2 · INR pricing.** The gateway dialog computed `usd * (config.usdToInrRate ?? 84)`.
 * **`usdToInrRate` does not exist on `/billing/config`** — the payload is USD-only — so the fallback
 * always fired and every INR price was inflated 1.5–2× (Agency showed ₹46,116 against an authored
 * ₹22,999).
 *
 * ⚠️ **The fix is to stop converting, not to supply a better rate.** D4 settled that there is no FX
 * derivation anywhere in the product, and the catalogue holds an authored INR figure per tier.
 * A rate — however accurate — would still be inventing a price the business did not set.
 */

/**
 * A package existing for the tier IS the purchasability signal.
 *
 * That is what `startCheckout` already assumes, and what `/billing/packages` already means: the
 * query behind it excludes non-public and inactive packages, so anything in the response is on sale.
 *
 * 🚩 **Deliberately does NOT consult `plan.checkout`.** Those flags describe the *plan* path's env
 * SKUs, which Growth — a tier the `Plan` enum has never heard of — will never have. Consulting them
 * is what made Growth unbuyable.
 *
 * The provider must still be configured: a package on sale through a gateway with no keys is not
 * purchasable, and that is a different failure worth a different message.
 */
export function packageGatewayAvailability(input: {
  pkg: SellablePackage | undefined;
  stripeConfigured: boolean;
  razorpayConfigured: boolean;
}): GatewayAvailability[] {
  const { pkg, stripeConfigured, razorpayConfigured } = input;

  const forGateway = (value: GatewayKey, configured: boolean): GatewayAvailability => {
    if (!pkg) return { value, available: false, reason: "Not available for online checkout yet" };
    if (!configured) return { value, available: false, reason: "Temporarily unavailable" };
    return { value, available: true };
  };

  return [forGateway("stripe", stripeConfigured), forGateway("razorpay", razorpayConfigured)];
}

/**
 * The authored INR price for an interval, in paise. Never derived from USD.
 *
 * Returns `null` when the tier carries no INR figure for that interval — `free` (₹0 needs no price)
 * and any interval the catalogue leaves unset. `null` means "do not show an INR price", **not
 * "compute one"**.
 */
export function inrPaiseForInterval(
  pkg: SellablePackage | undefined,
  interval: PaidInterval
): number | null {
  if (!pkg) return null;
  const paise = interval === "yearly" ? pkg.yearlyPriceInrPaise : pkg.monthlyPriceInrPaise;
  return paise != null && paise > 0 ? paise : null;
}

/** The authored USD price for an interval, in cents. Same contract as the INR side. */
export function usdCentsForInterval(
  pkg: SellablePackage | undefined,
  interval: PaidInterval
): number | null {
  if (!pkg) return null;
  const cents = interval === "yearly" ? pkg.yearlyPriceUsdCents : pkg.monthlyPriceUsdCents;
  return cents != null && cents > 0 ? cents : null;
}

/**
 * Paise → a display string, with Indian digit grouping (₹22,999 — not ₹22,999.00 or ₹22999).
 *
 * `en-IN` gives the 2-2-3 grouping Indian customers expect. Fractional paise are not a thing in this
 * catalogue — every authored figure is whole rupees — so the decimals are dropped rather than
 * rendered as `.00`.
 */
export function formatInrPaise(paise: number | null): string | null {
  if (paise == null) return null;
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(paise / 100)}`;
}

/** Cents → `$59`. Whole dollars for the same reason `formatInrPaise` drops decimals. */
export function formatUsdCents(cents: number | null): string | null {
  if (cents == null) return null;
  return `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(cents / 100)}`;
}

/** What the customer browses in. `null` = the server could not resolve their country. */
export type DisplayCurrency = "USD" | "INR" | null;

/**
 * The price to print on a plan card, in the customer's own currency.
 *
 * ## The defect this replaces
 *
 * The card rendered a hardcoded `$` JSX literal over `plan.pricing.monthlyUsd`. There was **no
 * country read anywhere in the file** — not a bad default, no condition at all. So a
 * `country = "IN"` customer shopped in dollars and was charged in rupees by a server that had
 * resolved their currency correctly the whole time.
 *
 * `displayCurrency` comes from the session payload, resolved by the **same** `resolveCheckoutCurrency`
 * the checkout path uses. It is not recomputed here from `country`.
 *
 * ## 🔴 Never converts — D4
 *
 * INR is read from the package catalogue's authored figure. When a paid tier has no authored INR
 * for the interval, this falls back to **USD**, not to a conversion: showing the real price in the
 * wrong currency is recoverable, showing an invented number in the right one is not. That is the
 * same rule that made `?? 84` wrong.
 *
 * ⚠️ **Free is free in every currency.** `₹0` needs no authored figure, so a zero-priced tier
 * renders in the display currency rather than falling back.
 */
export function cardPriceText(input: {
  displayCurrency: DisplayCurrency;
  pkg: SellablePackage | undefined;
  /** The plan payload's USD figure, in whole dollars — the fallback and the USD source. */
  planUsd: number | null;
  interval: PaidInterval;
}): string {
  const { displayCurrency, pkg, planUsd, interval } = input;

  const usdText = (() => {
    const cents = usdCentsForInterval(pkg, interval);
    if (cents != null) return formatUsdCents(cents)!;
    if (planUsd == null) return "—";
    return `$${Math.round(planUsd)}`;
  })();

  if (displayCurrency !== "INR") return usdText;

  const paise = inrPaiseForInterval(pkg, interval);
  if (paise != null) return formatInrPaise(paise)!;
  // Free: ₹0 is correct without an authored figure, in any currency.
  if (planUsd === 0) return "₹0";
  // A paid tier with no authored INR. Fall back rather than convert.
  return usdText;
}
