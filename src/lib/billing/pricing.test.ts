import { describe, it, expect } from "vitest";
import {
  cardPriceText,
  formatInrPaise,
  formatUsdCents,
  inrPaiseForInterval,
  packageGatewayAvailability,
  usdCentsForInterval,
} from "./pricing";
import type { SellablePackage } from "@/lib/api/billing-api";

/**
 * Two live production defects, one cause: the billing page asked the PLAN payload two questions
 * only the PACKAGE payload can answer.
 *
 * ⚠️ **A test asserting the new code exists would pass against the old code**, so every assertion
 * here is about behaviour: what is purchasable, and what number is shown.
 *
 * Fixtures are the **authored figures MEASURED from live `GET /billing/packages`** on 2026-08-21,
 * not invented ones — so a change to the catalogue that broke these would be caught as a real
 * disagreement rather than dismissed as a stale test.
 */

const pkg = (over: Partial<SellablePackage> = {}): SellablePackage => ({
  id: "pkg-1",
  key: "growth",
  name: "Growth",
  description: null,
  sortOrder: 2,
  badge: null,
  monthlyPriceUsdCents: 2900,
  yearlyPriceUsdCents: 29000,
  monthlyPriceInrPaise: 149900,
  yearlyPriceInrPaise: 1499900,
  ...over,
});

/** MEASURED on production, 2026-08-21 — `GET /api/v1/billing/packages`. */
const LIVE_INR_MONTHLY: Array<[string, number]> = [
  ["starter", 49900],
  ["growth", 149900],
  ["business", 249900],
  ["agency", 2299900],
];

describe("packageGatewayAvailability — a package existing IS the purchasability signal", () => {
  it("🔴 GROWTH is purchasable — the defect was that it was not", () => {
    // Growth has a package and four Razorpay SKUs, but NO plan-level env SKUs (`RAZORPAY_PLAN_
    // GROWTH_*` is hardcoded to "" and not declared in env.ts). Deriving availability from
    // `plan.checkout` made every flag false, so `handleUpgradeClick` returned early with
    // "not available for online checkout yet" and the gateway chooser never opened.
    const options = packageGatewayAvailability({
      pkg: pkg({ key: "growth" }),
      stripeConfigured: true,
      razorpayConfigured: true,
    });

    expect(options.every((o) => o.available)).toBe(true);
    expect(options.some((o) => o.reason)).toBe(false);
  });

  it("a tier with no package is NOT purchasable", () => {
    // The control. Without it, a function returning `available: true` unconditionally would pass
    // the assertion above and be exactly as wrong in the other direction.
    const options = packageGatewayAvailability({
      pkg: undefined,
      stripeConfigured: true,
      razorpayConfigured: true,
    });

    expect(options.every((o) => o.available)).toBe(false);
    for (const o of options) expect(o.reason).toBe("Not available for online checkout yet");
  });

  it("an unconfigured provider is unavailable, and says so differently", () => {
    // "We do not sell this tier" and "this gateway is down" are different facts and a customer
    // should not be shown the first when the second is true.
    const options = packageGatewayAvailability({
      pkg: pkg(),
      stripeConfigured: false,
      razorpayConfigured: true,
    });

    const stripe = options.find((o) => o.value === "stripe")!;
    const razorpay = options.find((o) => o.value === "razorpay")!;

    expect(stripe.available).toBe(false);
    expect(stripe.reason).toBe("Temporarily unavailable");
    expect(razorpay.available).toBe(true);
  });

  it("returns stripe and razorpay, in that order, always", () => {
    const options = packageGatewayAvailability({
      pkg: undefined,
      stripeConfigured: false,
      razorpayConfigured: false,
    });
    expect(options.map((o) => o.value)).toEqual(["stripe", "razorpay"]);
  });
});

describe("inrPaiseForInterval — read, never converted", () => {
  it.each(LIVE_INR_MONTHLY)(
    "🔴 %s monthly is the authored %d paise, not usd × 84",
    (key, paise) => {
      // The defect: `usd * (config.usdToInrRate ?? 84)`, where `usdToInrRate` does not exist on
      // /billing/config — so 84 always applied. Agency showed ₹46,116 against an authored ₹22,999.
      const usdCents = { starter: 900, growth: 2900, business: 5900, agency: 54900 }[key]!;
      const converted = (usdCents / 100) * 84 * 100; // what the old code produced, in paise

      const actual = inrPaiseForInterval(pkg({ key, monthlyPriceInrPaise: paise }), "monthly");

      expect(actual).toBe(paise);
      expect(actual).not.toBe(converted);
    }
  );

  it("reads the yearly figure for the yearly interval", () => {
    expect(inrPaiseForInterval(pkg(), "yearly")).toBe(1499900);
    expect(inrPaiseForInterval(pkg(), "monthly")).toBe(149900);
  });

  it("returns null when the tier carries no INR figure — it does NOT fall back", () => {
    // `null` means "show no INR price". The whole defect was a fallback that invented one.
    expect(inrPaiseForInterval(pkg({ monthlyPriceInrPaise: null }), "monthly")).toBeNull();
    expect(inrPaiseForInterval(pkg({ yearlyPriceInrPaise: null }), "yearly")).toBeNull();
  });

  it("treats 0 as no price — free needs no price object", () => {
    expect(inrPaiseForInterval(pkg({ monthlyPriceInrPaise: 0 }), "monthly")).toBeNull();
  });

  it("returns null for an absent package rather than throwing", () => {
    expect(inrPaiseForInterval(undefined, "monthly")).toBeNull();
  });
});

describe("usdCentsForInterval", () => {
  it("reads per interval and treats 0 and null as no price", () => {
    expect(usdCentsForInterval(pkg(), "monthly")).toBe(2900);
    expect(usdCentsForInterval(pkg(), "yearly")).toBe(29000);
    expect(usdCentsForInterval(pkg({ monthlyPriceUsdCents: 0 }), "monthly")).toBeNull();
    expect(usdCentsForInterval(pkg({ yearlyPriceUsdCents: null }), "yearly")).toBeNull();
  });
});

describe("formatting", () => {
  it("formats INR with Indian digit grouping and no decimals", () => {
    // ₹22,999 — the 2-2-3 grouping, not ₹22,999.00 and not the en-US ₹22,999 by coincidence.
    expect(formatInrPaise(2299900)).toBe("₹22,999");
    expect(formatInrPaise(149900)).toBe("₹1,499");
    // The one that distinguishes en-IN from en-US: 22,99,900 paise = ₹22,999 — but a larger figure
    // groups differently. ₹2,29,999 in en-IN is $2,29,999 style, not 229,999.
    expect(formatInrPaise(22999900)).toBe("₹2,29,999");
  });

  it("formats USD with no decimals", () => {
    expect(formatUsdCents(5900)).toBe("$59");
    expect(formatUsdCents(54900)).toBe("$549");
  });

  it("returns null for null, so callers render nothing rather than '₹NaN'", () => {
    expect(formatInrPaise(null)).toBeNull();
    expect(formatUsdCents(null)).toBeNull();
  });
});

describe("cardPriceText — the plan card renders the CUSTOMER's currency", () => {
  /**
   * The defect: the card printed a hardcoded `$` JSX literal over `plan.pricing.monthlyUsd`, with
   * **no country read anywhere in the file**. Not a bad default — no condition at all. So a
   * `country = "IN"` customer shopped in dollars and was charged in rupees by a server that had
   * resolved their currency correctly the whole time.
   */
  const business = pkg({
    key: "business",
    monthlyPriceUsdCents: 5900,
    yearlyPriceUsdCents: 59000,
    monthlyPriceInrPaise: 249900,
    yearlyPriceInrPaise: 2499900,
  });

  it("🔴 an IN customer sees rupees", () => {
    expect(
      cardPriceText({ displayCurrency: "INR", pkg: business, planUsd: 59, interval: "monthly" })
    ).toBe("₹2,499");
  });

  it("🔴 a US customer sees dollars", () => {
    expect(
      cardPriceText({ displayCurrency: "USD", pkg: business, planUsd: 59, interval: "monthly" })
    ).toBe("$59");
  });

  it("🔴 a NULL-country customer sees dollars — the decision, pinned", () => {
    // Deliberate: USD, not a prompt before any price has been seen. A country prompt shown before
    // browsing is a worse first impression than one shown when someone has decided to buy — and
    // checkout already refuses null-country with CHECKOUT_COUNTRY_REQUIRED, which is where S5.6's
    // prompt belongs. This assertion is what makes that a decision rather than an accident.
    expect(
      cardPriceText({ displayCurrency: null, pkg: business, planUsd: 59, interval: "monthly" })
    ).toBe("$59");
  });

  it("reads the yearly figure for the yearly interval, in both currencies", () => {
    expect(
      cardPriceText({ displayCurrency: "INR", pkg: business, planUsd: 590, interval: "yearly" })
    ).toBe("₹24,999");
    expect(
      cardPriceText({ displayCurrency: "USD", pkg: business, planUsd: 590, interval: "yearly" })
    ).toBe("$590");
  });

  it("₹0 for a free tier — free is free in every currency", () => {
    const free = pkg({ key: "free", monthlyPriceUsdCents: 0, monthlyPriceInrPaise: 0 });
    expect(
      cardPriceText({ displayCurrency: "INR", pkg: free, planUsd: 0, interval: "monthly" })
    ).toBe("₹0");
    expect(
      cardPriceText({ displayCurrency: "USD", pkg: free, planUsd: 0, interval: "monthly" })
    ).toBe("$0");
  });

  it("⚠️ falls back to USD for a paid tier with no authored INR — never converts", () => {
    // D4: showing the real price in the wrong currency is recoverable; showing an invented number
    // in the right one is not. This is the same rule that made `?? 84` wrong.
    const noInr = pkg({ key: "starter", monthlyPriceUsdCents: 900, monthlyPriceInrPaise: null });
    const shown = cardPriceText({
      displayCurrency: "INR",
      pkg: noInr,
      planUsd: 9,
      interval: "monthly",
    });
    expect(shown).toBe("$9");
    expect(shown).not.toContain("₹");
  });

  it("falls back to the plan figure when no package exists for the tier", () => {
    expect(
      cardPriceText({ displayCurrency: "USD", pkg: undefined, planUsd: 29, interval: "monthly" })
    ).toBe("$29");
  });

  it("prefers the PACKAGE usd figure over the plan one when they disagree", () => {
    // The package catalogue is what checkout charges from. If the two ever diverge, the card must
    // show what the customer will actually be billed, not what the plan payload happens to say.
    const drifted = pkg({ key: "business", monthlyPriceUsdCents: 5900 });
    expect(
      cardPriceText({ displayCurrency: "USD", pkg: drifted, planUsd: 79, interval: "monthly" })
    ).toBe("$59");
  });
});
