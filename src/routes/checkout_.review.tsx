import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "@/lib/toast";

import { Logo } from "@/components/logo";
import { VerifiedRoute } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { BillingAddressForm } from "@/components/billing/billing-address-form";
import {
  createPackageCheckout,
  discountRejectionMessage,
  getBillingConfig,
  getBillingProfile,
  getFirstPaymentQuote,
  getSellablePackages,
  saveBillingProfile,
  verifyRazorpayCheckout,
} from "@/lib/api/billing-api";
import {
  openRazorpaySubscriptionCheckout,
  RazorpayCheckoutCancelled,
} from "@/lib/razorpay-checkout";
import { cardPriceText, formatMinor } from "@/lib/billing/pricing";
import {
  emptyBillingAddress,
  type BillingAddressErrors,
  type BillingAddressInput,
} from "@/lib/billing/billing-address";
import { useAuthState } from "@/lib/auth/auth-store";
import { useApp } from "@/state/app-context";
import { ApiError } from "@/lib/api/http";

/**
 * The checkout review page — billing address, order summary, then payment.
 *
 * ## Why this route exists
 *
 * It replaces `CountryPrompt` and `PlaceOfSupplyPrompt`, two dialogs that interrupted an in-flight
 * checkout on both `/checkout` and `/_app/billings` to collect a country and a GST state. Because
 * they resumed a dispatch that had already started, each needed an explicit value override to dodge
 * a stale closure (`setPlaceOfSupplyState` had not flushed when the resume callback ran) plus a
 * `dispatchingRef` to stop the resume racing the original. Gating the page instead of interrupting
 * it removes the whole category: nothing is in flight while the form is open, so there is one
 * dispatch, from one place, reading current state.
 *
 * It also collects what a tax invoice actually needs. `plan/gst-invoicing.md` cannot render a
 * "Billed to" block from a country and a state code alone, and an invoice is immutable once issued
 * — so a missing address is not something you backfill afterwards.
 *
 * ⚠️ **The `_` in the filename is load-bearing.** `checkout_.review.tsx` breaks out of layout
 * nesting so this does not render inside `checkout.tsx`. Same convention as
 * `admin.plugins_.docs.tsx`.
 */

type Interval = "monthly" | "yearly";

type ReviewSearch = {
  packageId?: string;
  interval: Interval;
  /** Where to send the back link, so the buyer returns to the page they came from. */
  from?: "billings" | "checkout";
};

export const Route = createFileRoute("/checkout_/review")({
  validateSearch: (search: Record<string, unknown>): ReviewSearch => ({
    packageId: typeof search.packageId === "string" ? search.packageId : undefined,
    interval: search.interval === "yearly" ? "yearly" : "monthly",
    from:
      search.from === "billings" ? "billings" : search.from === "checkout" ? "checkout" : undefined,
  }),
  head: () => ({ meta: [{ title: "Billing details — Liffio" }] }),
  component: CheckoutReviewRoute,
});

function CheckoutReviewRoute() {
  return (
    <VerifiedRoute>
      <CheckoutReview />
    </VerifiedRoute>
  );
}

function CheckoutReview() {
  const navigate = useNavigate();
  const { packageId, interval, from } = Route.useSearch();
  const workspaceId = useAuthState((s) => s.workspaceId) ?? "";
  const user = useAuthState((s) => s.user);
  const displayCurrency = useAuthState((s) => s.user?.displayCurrency) ?? null;
  const { refreshAuth } = useApp();

  const [address, setAddress] = useState<BillingAddressInput | null>(null);
  const [serverErrors, setServerErrors] = useState<BillingAddressErrors>({});
  const [countryLocked, setCountryLocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /** Belt and braces against a double-submit opening two Razorpay modals. */
  const dispatchingRef = useRef(false);

  const profileQuery = useQuery({
    queryKey: ["billing-profile", workspaceId],
    queryFn: () => getBillingProfile(workspaceId),
    enabled: Boolean(workspaceId),
  });
  const packagesQuery = useQuery({
    queryKey: ["billing-sellable-packages"],
    queryFn: getSellablePackages,
  });
  const configQuery = useQuery({ queryKey: ["billing-config"], queryFn: getBillingConfig });

  /**
   * What this customer pays today, after first-payment offers.
   *
   * ⚠️ Keyed on the user's country as well as the package, because the country field on this very
   * page can change it — the ₹49 intro is India-only, so switching country must re-quote rather
   * than leave a stale total on screen next to a form that no longer matches it.
   */
  /**
   * The code box, and the code actually being quoted.
   *
   * Two pieces of state on purpose. `codeInput` is what the customer is typing; `appliedCode` is
   * what the quote was asked for. Quoting on every keystroke would send a request per character and
   * flash "we do not recognise that code" at somebody halfway through typing a valid one.
   */
  const [codeInput, setCodeInput] = useState("");
  const [appliedCode, setAppliedCode] = useState("");

  const quoteQuery = useQuery({
    queryKey: ["billing-quote", workspaceId, packageId, interval, user?.country, appliedCode],
    queryFn: () =>
      getFirstPaymentQuote(workspaceId, {
        packageId: packageId as string,
        interval,
        discountCode: appliedCode || undefined,
      }),
    enabled: Boolean(workspaceId && packageId),
    // A quote is a price. Re-fetch rather than serve a cached one across a country change.
    staleTime: 0,
  });
  const quote = quoteQuery.data ?? null;

  const pkg = useMemo(
    () => packagesQuery.data?.packages.find((p) => p.id === packageId),
    [packagesQuery.data, packageId],
  );

  /**
   * Seed the form once, from the saved profile, else a sibling workspace's prefill, else the
   * account.
   *
   * Guarded on `address === null` rather than on the query: re-seeding after the query refetches
   * would discard whatever the buyer has typed since.
   */
  useEffect(() => {
    if (address !== null || !profileQuery.data) return;
    const { profile, prefill } = profileQuery.data;
    if (profile) {
      setAddress({
        country: profile.country,
        state: profile.state,
        gstStateCode: profile.gstStateCode,
        postalCode: profile.postalCode,
        address: profile.address,
      });
      return;
    }
    if (prefill) {
      setAddress(prefill);
      return;
    }
    setAddress(emptyBillingAddress({ country: user?.country }));
  }, [profileQuery.data, address, user]);

  const backTo = from === "billings" ? "/billings" : "/checkout";

  const handleSubmit = async () => {
    if (!address || !workspaceId || !pkg) return;
    if (dispatchingRef.current) {
      toast.info("A checkout is already in progress — please wait.");
      return;
    }

    const keyId = configQuery.data?.providers.razorpay.keyId;
    if (!keyId) {
      toast.error("Razorpay is not configured");
      return;
    }

    dispatchingRef.current = true;
    setSubmitting(true);
    setServerErrors({});
    try {
      /**
       * Save first, then charge — never the other way round.
       *
       * The address is what makes the resulting charge invoiceable. Charging first would create
       * the one state `issueInvoiceForCharge` cannot resolve: money collected, no buyer on file,
       * and no way to issue the document retroactively because invoices are immutable.
       */
      await saveBillingProfile(workspaceId, address);

      /**
       * The saved country may have changed `users.country`, which is what the server resolves
       * currency from. Refresh so the summary and any later render agree with what will be
       * charged.
       */
      if (address.country !== user?.country) await refreshAuth();

      const result = await createPackageCheckout(workspaceId, {
        packageId: pkg.id,
        interval,
      });
      if (result.provider !== "razorpay" || !result.subscriptionId) {
        throw new Error("Razorpay checkout could not be started");
      }

      const payload = await openRazorpaySubscriptionCheckout({
        keyId,
        subscriptionId: result.subscriptionId,
        email: user?.email ?? undefined,
        description: `${pkg.name} — billed ${interval}`,
      });

      await verifyRazorpayCheckout(workspaceId, payload);
      toast.success("Payment successful — your plan is active");
      void navigate({ to: from === "billings" ? "/billings" : "/onboarding", replace: true });
    } catch (err) {
      if (err instanceof RazorpayCheckoutCancelled) {
        toast.info("Payment cancelled — you can retry any time");
      } else if (err instanceof ApiError && err.code === "BILLING_PROFILE_INVALID") {
        // Per-field, so the buyer sees which of eleven inputs is wrong rather than a banner.
        const body = err.body as { fieldErrors?: BillingAddressErrors } | undefined;
        setServerErrors(body?.fieldErrors ?? {});
        toast.error("Some billing details need fixing.");
      } else if (err instanceof ApiError && err.code === "COUNTRY_LOCKED") {
        setCountryLocked(true);
        toast.error(err.message);
      } else {
        toast.error(err instanceof Error ? err.message : "Checkout failed");
      }
    } finally {
      setSubmitting(false);
      dispatchingRef.current = false;
    }
  };

  if (!packageId) {
    return (
      <Shell backTo={backTo}>
        <p className="text-sm text-muted-foreground">No plan selected. Pick one to continue.</p>
      </Shell>
    );
  }

  const loading = profileQuery.isLoading || packagesQuery.isLoading || address === null;

  if (loading) {
    return (
      <Shell backTo={backTo}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading your billing details…
        </div>
      </Shell>
    );
  }

  if (!pkg) {
    return (
      <Shell backTo={backTo}>
        <p className="text-sm text-muted-foreground">
          That plan isn't available for checkout. Pick another to continue.
        </p>
      </Shell>
    );
  }

  /**
   * The recurring price, from the shared `cardPriceText` seam every other surface uses — so the
   * review page cannot disagree with the plan cards the buyer just came from.
   */
  const listPrice = cardPriceText({ displayCurrency, pkg, planUsd: null, interval });

  /**
   * What is actually charged today.
   *
   * Falls back to the list price while the quote is in flight, rather than rendering a skeleton or
   * a zero: the overwhelmingly common answer IS the list price, and flashing a placeholder where a
   * total belongs reads as a page that does not know what it is charging.
   */
  const dueToday = quote ? formatMinor(quote.amountMinor, quote.currency) : listPrice;

  return (
    <Shell backTo={backTo}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Billing details</CardTitle>
            <p className="text-sm text-muted-foreground">
              These appear on your invoices. You can update them later.
            </p>
          </CardHeader>
          <CardContent>
            <BillingAddressForm
              value={address}
              onChange={(next) => {
                setAddress(next);
                // A server error is about the value that was submitted; once it changes, the error
                // is stale and holding onto it would contradict the live local validation.
                if (Object.keys(serverErrors).length > 0) setServerErrors({});
              }}
              serverErrors={serverErrors}
              countryLocked={countryLocked}
              submitting={submitting}
              onSubmit={() => void handleSubmit()}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-baseline justify-between">
                <span className="font-medium">{pkg.name}</span>
                <span className="font-medium">{listPrice}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Billed {interval === "yearly" ? "yearly" : "monthly"}, renews automatically. Cancel
                any time.
              </p>

              {/*
                The first-payment breakdown. Rendered ONLY when the server says this payment
                actually differs — an unconditional "Discounts: —" row on every purchase is noise,
                and worse, it advertises an offer to people who are not getting one.

                🚩 Every figure here comes from `GET /billing/quote`. Nothing on this page
                computes a price: eligibility depends on payment history and account age, and
                `createPackageCheckout` calls the same resolver, so what is shown and what is
                charged cannot disagree.
              */}
              {quote?.differsFromList && (
                <>
                  <Separator />
                  {quote.lines.map((line) => (
                    <div
                      key={line.kind}
                      className="flex items-baseline justify-between text-emerald-600 dark:text-emerald-400"
                    >
                      <span>{line.label}</span>
                      <span>−{formatMinor(line.deductionMinor, quote.currency)}</span>
                    </div>
                  ))}
                </>
              )}

              {/*
                The code box sits ABOVE the total, because applying one changes the total and a
                control that changes a number should be read before it, not after.
              */}
              <Separator />
              <div className="space-y-1.5">
                <label htmlFor="discount-code" className="text-xs text-muted-foreground">
                  Have a discount code?
                </label>
                <div className="flex gap-2">
                  <Input
                    id="discount-code"
                    value={codeInput}
                    // Uppercased as they type, because that is how codes are stored and it saves a
                    // "why did my code not work" ticket from someone who typed it in lower case.
                    onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        setAppliedCode(codeInput.trim());
                      }
                    }}
                    placeholder="Enter code"
                    className="h-9"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9"
                    // Disabled when it would re-ask the same question: nothing typed, or the code
                    // already quoted.
                    disabled={
                      quoteQuery.isFetching ||
                      codeInput.trim().length === 0 ||
                      codeInput.trim() === appliedCode
                    }
                    onClick={() => setAppliedCode(codeInput.trim())}
                  >
                    {quoteQuery.isFetching ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Apply"
                    )}
                  </Button>
                </div>
                {/*
                  The rejection arrives WITH a full-price quote rather than as an error, so the
                  customer still sees what they owe. Saying which of the nine reasons applies is the
                  difference between fixing a typo and opening a ticket.
                */}
                {quote?.discountRejection && (
                  <p className="text-xs text-destructive">
                    {discountRejectionMessage(quote.discountRejection)}
                  </p>
                )}
                {quote?.codeApplied && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    Code {quote.codeApplied.code} applied
                  </p>
                )}
              </div>

              <Separator />
              <div className="flex items-baseline justify-between text-base font-semibold">
                <span>Due today</span>
                <span>{dueToday}</span>
              </div>

              {quote?.differsFromList && (
                <p className="text-xs text-muted-foreground">
                  {/*
                    🔴 The yearly-intro sentence has to be exact. A ₹49 first payment on a yearly
                    plan buys ONE MONTH, then charges ₹4,999 for the year — a customer who reads
                    "₹49" next to a yearly plan and is not told this will reasonably believe they
                    have bought a year, and find out otherwise on their statement.

                    `firstPeriod` is the server's answer to "what did this buy", so the copy
                    follows it rather than the interval.
                  */}
                  {quote.firstPeriod === "month" && interval === "yearly"
                    ? `Covers your first month. You'll then be charged ${listPrice} for the year, starting a month from today.`
                    : interval === "yearly"
                      ? `Then ${listPrice}/year at renewal.`
                      : `Then ${listPrice}/month from next month.`}
                </p>
              )}
            </CardContent>
          </Card>

          <div className="flex items-start gap-2 px-1 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Payment is handled by Razorpay. Liffio never sees your card details.</span>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children, backTo }: { children: React.ReactNode; backTo: string }) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <Logo />
        <Button variant="ghost" size="sm" asChild>
          <Link to={backTo}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>
      {children}
    </div>
  );
}
