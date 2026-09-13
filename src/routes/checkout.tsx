import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, CreditCard, IndianRupee, Zap } from "lucide-react";
import { toast } from "@/lib/toast";

import { Logo } from "@/components/logo";
import { VerifiedRoute } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  createPackageCheckout,
  getBillingConfig,
  getSellablePackages,
  verifyRazorpayCheckout,
} from "@/lib/api/billing-api";
import {
  openRazorpaySubscriptionCheckout,
  RazorpayCheckoutCancelled,
} from "@/lib/razorpay-checkout";
import { cardPriceText, packageGatewayAvailability } from "@/lib/billing/pricing";
import { useAuthState } from "@/lib/auth/auth-store";
import { useApp } from "@/state/app-context";
import { CountryPrompt } from "@/components/billing/country-prompt";
import { PlaceOfSupplyPrompt } from "@/components/billing/place-of-supply-prompt";

/*
 * Quarterly is DELETED from this page. (Task 6)
 *
 * `packageCheckoutSchema` (server) accepts `monthly` and `yearly` only — packages have no
 * quarterly price column, and `/billings` has never offered it either. This is a real product
 * change (quarterly billing stops being offered here), not a refactor.
 */
type Interval = "monthly" | "yearly";
/** Razorpay only — Stripe was removed from the product in full. */
type Gateway = "razorpay";

type CheckoutSearch = {
  plan?: string;
};

export const Route = createFileRoute("/checkout")({
  validateSearch: (search: Record<string, unknown>): CheckoutSearch => ({
    plan: typeof search.plan === "string" ? search.plan : undefined,
  }),
  head: () => ({ meta: [{ title: "Checkout — Liffio" }] }),
  component: CheckoutRoute,
});

/*
 * PLAN_LABELS and PLAN_HIGHLIGHTS are DELETED. (S5.1)
 *
 * They listed Pro, Business and Agency — no Starter, no Growth — and the highlights were hardcoded
 * marketing copy ("5 Instagram accounts", "50,000 automated DMs / month") matching neither V4 nor
 * the current BILLING_PLANS. Editing them would have meant inventing numbers and then owning a
 * second price list that drifts from the first.
 *
 * /billing/config already serves displayName and highlights per plan, from BILLING_PLANS. Reading
 * them means this page is right whenever the server is — including across merge 1b, which changes
 * those values without touching this file.
 */

function CheckoutRoute() {
  return (
    <VerifiedRoute>
      <PostRegistrationCheckout />
    </VerifiedRoute>
  );
}

function PostRegistrationCheckout() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  // Resolved below from the server's ladder — never defaulted here. (S5.1)
  const requestedPlan = search.plan?.toUpperCase();
  const workspaceId = useAuthState((s) => s.workspaceId) ?? "";
  const userEmail = useAuthState((s) => s.user?.email);
  const { refreshAuth } = useApp();
  /**
   * 🔴 The customer's own currency, resolved by the SERVER — same seam `/billings` reads. (Task 6)
   *
   * A user reaching this page immediately after registration is MORE likely to have a null
   * country than one on `/billings`, not less: Google OAuth signup writes `country: null` because
   * the callback is a redirect with no form for the user to fill in.
   */
  const displayCurrency = useAuthState((s) => s.user?.displayCurrency) ?? null;

  const [interval, setInterval] = useState<Interval>("monthly");
  const [gateway, setGateway] = useState<Gateway>("razorpay");
  const [paying, setPaying] = useState(false);
  const [countryPromptOpen, setCountryPromptOpen] = useState(false);
  const [statePromptOpen, setStatePromptOpen] = useState(false);
  /** The buyer's GST state code, captured just-in-time for an INR purchase — per-purchase, not persisted. */
  const [placeOfSupplyState, setPlaceOfSupplyState] = useState<string | null>(null);

  const configQuery = useQuery({ queryKey: ["billing-config"], queryFn: getBillingConfig });
  /**
   * The PACKAGE catalogue. (Task 6)
   *
   * 🚩 This page used to buy through `POST /billing/checkout`, resolving a Razorpay plan id from
   * `RAZORPAY_PLAN_*` env vars (`billing.config.ts`) — a second, hand-maintained catalogue with no
   * console, no diff, no grandfathering, and **no Growth SKUs at all**. It now buys through
   * `POST /billing/package-checkout`, exactly like `/billings`, which sources its price from
   * `package_prices` and carries the capability ceiling the env-var path never did.
   */
  const packagesQuery = useQuery({
    queryKey: ["billing-sellable-packages"],
    queryFn: getSellablePackages,
  });

  const config = configQuery.data;

  /**
   * 🚩 No PRO default. (S5.1)
   *
   * This read `search.plan ?? "PRO"`, so **a user landing on /checkout with no query parameter was
   * offered a retired tier** — non-public since D18, excluded from `getPaidPlans` since S1.1, and
   * unbuyable. V4 §25.13 flagged it and it was still true at this SHA.
   *
   * The fallback is now the **cheapest sellable paid plan the server reports**, by `rank` — the two
   * fields S5.5 added for the billing page. Derived, so it cannot name a retired tier and needs no
   * editing when the ladder changes. If config has not loaded there is simply no plan, and the page
   * says so rather than guessing.
   */
  const sellablePaid = (config?.plans ?? [])
    .filter((p) => p.sellable && p.plan !== "FREE" && p.rank !== null)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  const planConfig =
    (requestedPlan
      ? config?.plans.find((p) => p.plan === requestedPlan && p.sellable)
      : undefined) ?? sellablePaid[0];
  const plan = planConfig?.plan ?? "";
  // Matched by key: BILLING_PLANS is keyed STARTER/GROWTH, packages.key is starter/growth.
  const pkg = packagesQuery.data?.packages.find((p) => p.key.toUpperCase() === plan.toUpperCase());

  const gateways: { value: Gateway; label: string; detail: string; icon: typeof CreditCard }[] = [
    {
      value: "razorpay",
      label: "UPI / NetBanking",
      detail: "UPI, cards, netbanking · INR",
      icon: IndianRupee,
    },
  ];

  /**
   * 🔴 Availability comes from the PACKAGE, not from `plan.checkout`. (Task 6)
   *
   * Those flags were built server-side from the plan path's env SKUs (`RAZORPAY_PLAN_*`), and
   * GROWTH has none declared — so this page could never offer it. `packageGatewayAvailability`
   * (shared with `/billings`) answers from the package catalogue instead: a package existing for
   * the tier IS the purchasability signal.
   */
  const gatewayAvailability = packageGatewayAvailability({
    pkg,
    razorpayConfigured: Boolean(
      config?.providers.razorpay.configured && config.providers.razorpay.keyId,
    ),
  });

  // Every gateway renders always, even one the backend has not enabled — a disabled row WITH its
  // reason, rather than vanishing, so the payment-type step is never blank.
  const gatewayRows = gateways.map((g) => {
    const avail = gatewayAvailability.find((a) => a.value === g.value);
    return { ...g, enabled: Boolean(avail?.available), reason: avail?.reason };
  });
  const enabledGateways = gatewayRows.filter((g) => g.enabled);

  /**
   * The authored price for this interval, read from the PACKAGE catalogue and never converted. (D4)
   *
   * Mirrors `/billings`' own `price`/`cardPriceText` pair exactly, rather than the FX-derivation bug
   * this page used to carry (`usd * (config.usdToInrRate ?? 84)`, inflating every INR price 1.5–2×
   * because `usdToInrRate` does not exist on `/billing/config`).
   */
  const priceUsd =
    interval === "yearly"
      ? (planConfig?.pricing.yearlyUsd ?? planConfig?.pricing.monthlyUsd ?? null)
      : (planConfig?.pricing.monthlyUsd ?? null);
  const price = cardPriceText({ displayCurrency, pkg, planUsd: priceUsd, interval });

  const checkoutInFlight = paying;
  /**
   * Synchronous dispatch guard, alongside `checkoutInFlight`. (Task 6 — mirrors `/billings`)
   *
   * `checkoutInFlight` only becomes `true` for the render AFTER a dispatch starts — one React tick
   * behind an independently-resolving async chain such as a `CountryPrompt`/`PlaceOfSupplyPrompt`
   * resume racing in from its own `await`. This ref closes that gap: set synchronously at the one
   * dispatch point in `proceedCheckout`, checked at its top, cleared in every outcome. Without it a
   * double-dispatch here creates TWO live Razorpay subscriptions for one workspace.
   */
  const dispatchingRef = useRef(false);

  // If the preferred gateway is unavailable, fall to the first enabled. (Kept even though there is
  // only ever one member in `gateways` today, in case a second gateway is ever added.)
  useEffect(() => {
    if (enabledGateways.length && !enabledGateways.some((g) => g.value === gateway)) {
      setGateway(enabledGateways[0].value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledGateways.map((g) => g.value).join(","), gateway]);

  /**
   * The actual checkout dispatch, once a currency is already known to exist.
   *
   * Split out of `startCheckout` so the country/state-prompt resume paths (`onCaptured` below) can
   * call straight into it, bypassing `startCheckout`'s guard entirely — see that function's comment
   * for why re-entering the guard would reopen the very dialog that just closed.
   *
   * `overrides` exists for the same reason, one level down: once a currency or GST state has just
   * been captured, the resuming caller passes it in explicitly rather than letting this function
   * read `displayCurrency` / `placeOfSupplyState` off its own closure — neither has necessarily
   * flushed to this render by the time the resume callback runs.
   *
   * 🚩 **Deliberately no `planKey` / `gateway` parameter**, unlike `/billings`' `proceedCheckout`.
   * That page iterates a GRID of plan cards, so it needs the caller to say which one was clicked.
   * This page has exactly one purchasable target per page load — `pkg` — already stable component
   * state, not per-row data that could go stale across the async gap. There is nothing here that
   * needs to be "remembered" the way `/billings`' `pendingPurchase` remembers it.
   */
  const proceedCheckout = async (overrides?: {
    currency?: "USD" | "INR";
    stateOverride?: string;
  }) => {
    // Never let a second dispatch through while one is already in flight — see `dispatchingRef`'s
    // own comment above for why both checks are needed.
    if (checkoutInFlight || dispatchingRef.current) {
      toast.info("A checkout is already in progress — please wait.");
      return;
    }
    if (!pkg || !workspaceId) return;

    /**
     * An INR sale needs a GST state before checkout, never after. (Mirrors `/billings`.)
     *
     * `createPackageCheckout` throws `PLACE_OF_SUPPLY_REQUIRED` for INR without one. USD is
     * deliberately not gated — there is no place-of-supply concept on an export.
     */
    const currency = overrides?.currency ?? displayCurrency;
    const state = overrides?.stateOverride ?? placeOfSupplyState;

    if (currency === "INR" && !state) {
      setStatePromptOpen(true);
      return;
    }

    const keyId = config?.providers.razorpay.keyId;
    if (!keyId) {
      toast.error("Razorpay is not configured");
      return;
    }

    dispatchingRef.current = true;
    localStorage.setItem("liffio_post_checkout", "/onboarding");
    setPaying(true);
    try {
      const result = await createPackageCheckout(workspaceId, {
        packageId: pkg.id,
        interval,
        ...(state ? { placeOfSupplyState: state } : {}),
      });

      if (result.provider !== "razorpay" || !result.subscriptionId) {
        throw new Error("Razorpay checkout could not be started");
      }

      const payload = await openRazorpaySubscriptionCheckout({
        keyId,
        subscriptionId: result.subscriptionId,
        email: userEmail ?? undefined,
        description: `${planConfig?.displayName ?? plan} plan — billed ${interval}`,
      });

      await verifyRazorpayCheckout(workspaceId, payload);
      toast.success("Payment successful — your plan is active");
      void navigate({ to: "/onboarding", replace: true });
    } catch (err) {
      if (err instanceof RazorpayCheckoutCancelled) {
        toast.info("Payment cancelled — you can retry any time");
      } else {
        toast.error(err instanceof Error ? err.message : "Checkout failed");
      }
    } finally {
      setPaying(false);
      dispatchingRef.current = false;
    }
  };

  /**
   * The guard: country first, because checkout refuses without it. (Mirrors `/billings`.)
   *
   * `displayCurrency` is resolved SERVER-SIDE and is null exactly when the server could not resolve
   * a country — the same condition `createPackageCheckout` throws `CHECKOUT_COUNTRY_REQUIRED` on.
   */
  const startCheckout = () => {
    if (!displayCurrency) {
      setCountryPromptOpen(true);
      return;
    }
    void proceedCheckout();
  };

  const highlights = planConfig?.highlights ?? [];
  const planLabel = planConfig?.displayName ?? plan;
  const busy = checkoutInFlight;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-soft-gradient opacity-80"
      />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo size="md" />
        </div>

        <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          <div className="border-b bg-primary/10 px-8 py-6 text-center">
            <div className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-primary">
              <Zap className="h-4 w-4" />
              Complete your {planLabel} setup
            </div>
            <div className="flex items-baseline justify-center gap-1">
              <span className="font-display text-3xl font-bold text-foreground">{price}</span>
              <span className="text-xs text-muted-foreground">
                /{interval === "yearly" ? "yr" : "mo"}
              </span>
            </div>
            {interval !== "monthly" && (
              <p className="mt-1 text-xs text-muted-foreground">billed {interval}</p>
            )}
          </div>

          <div className="space-y-6 px-8 py-6">
            <div className="flex gap-1 rounded-lg border p-1">
              {(["monthly", "yearly"] as const).map((iv) => (
                <button
                  key={iv}
                  type="button"
                  onClick={() => setInterval(iv)}
                  className={cn(
                    "flex-1 rounded-md py-1.5 text-xs font-medium transition-colors",
                    interval === iv
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {iv === "yearly" ? "Yearly" : "Monthly"}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Payment type
              </p>
              <div className="grid grid-cols-2 gap-2">
                {gatewayRows.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    disabled={!g.enabled}
                    onClick={() => setGateway(g.value)}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                      g.enabled && gateway === g.value
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "enabled:hover:border-foreground/20",
                      !g.enabled && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                      <g.icon className="h-4 w-4" />
                      {g.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {g.enabled ? g.detail : (g.reason ?? "Temporarily unavailable")}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <ul className="space-y-2.5">
              {highlights.map((feat) => (
                <li key={feat} className="flex items-center gap-2.5 text-sm">
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>

            <Button
              className="w-full gap-2"
              size="lg"
              onClick={startCheckout}
              disabled={busy || !workspaceId || configQuery.isLoading || !enabledGateways.length}
            >
              {busy ? "Waiting for payment…" : `Upgrade to ${planLabel}`}
              <ArrowRight className="h-4 w-4" />
            </Button>

            <button
              type="button"
              onClick={() => void navigate({ to: "/onboarding", replace: true })}
              className="w-full py-1 text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Skip for now — start with the free plan
            </button>
          </div>
        </div>

        {config?.isSandbox && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Sandbox mode — no real charges will be made.
          </p>
        )}
      </div>

      <CountryPrompt
        open={countryPromptOpen}
        onOpenChange={setCountryPromptOpen}
        onCaptured={async (currency) => {
          // `refreshAuth` invalidates the `auth-me` query so `displayCurrency` is populated from
          // the server for every other reader of it on this page (the price, the gateway rows).
          // Awaited so a checkout dispatched right after does not race the display update — see
          // `/billings`' identical comment for why this cannot resurrect the frozen-closure bug:
          // `proceedCheckout` receives `currency` as an explicit override below and never reads
          // `displayCurrency` off this closure.
          await refreshAuth();
          await proceedCheckout({ currency });
        }}
      />

      <PlaceOfSupplyPrompt
        open={statePromptOpen}
        onOpenChange={setStatePromptOpen}
        onCaptured={(stateCode) => {
          setPlaceOfSupplyState(stateCode);
          // Same closure hazard as the country resume above: `setPlaceOfSupplyState` has not
          // flushed yet, so the just-captured state is passed through explicitly instead of being
          // re-read off this render's (still stale) `placeOfSupplyState`.
          void proceedCheckout({ currency: "INR", stateOverride: stateCode });
        }}
      />
    </div>
  );
}
