import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, CreditCard, IndianRupee, Zap } from "lucide-react";
import { toast } from "@/lib/toast";

import { Logo } from "@/components/logo";
import { VerifiedRoute } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  createBillingCheckout,
  getBillingConfig,
  getSellablePackages,
  verifyRazorpayCheckout,
  type CheckoutInput,
} from "@/lib/api/billing-api";
import {
  openRazorpaySubscriptionCheckout,
  RazorpayCheckoutCancelled,
} from "@/lib/razorpay-checkout";
import { formatInrPaise, inrPaiseForInterval } from "@/lib/billing/pricing";
import { useAuthState } from "@/lib/auth/auth-store";

type Interval = "monthly" | "quarterly" | "yearly";
type Gateway = "stripe" | "razorpay";

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

  const [interval, setInterval] = useState<Interval>("monthly");
  const [gateway, setGateway] = useState<Gateway>("stripe");
  const [paying, setPaying] = useState(false);

  const configQuery = useQuery({ queryKey: ["billing-config"], queryFn: getBillingConfig });
  /**
   * The authored INR prices live on the PACKAGE catalogue, not on `/billing/config`. (D4)
   *
   * This page is the plan path and keeps its plan-driven gateway and interval logic — but a price
   * is a price, and the only authored INR figures in the product are these.
   */
  const packagesQuery = useQuery({
    queryKey: ["billing-sellable-packages"],
    queryFn: getSellablePackages,
  });
  const checkoutMutation = useMutation({
    mutationFn: (body: CheckoutInput) => createBillingCheckout(workspaceId, body),
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
      value: "stripe",
      label: "Card",
      detail: "Visa, Mastercard, Amex · USD",
      icon: CreditCard,
    },
    {
      value: "razorpay",
      label: "UPI / NetBanking",
      detail: "UPI, cards, netbanking · INR",
      icon: IndianRupee,
    },
  ];

  // Both gateway types render always; each is enabled only when the backend reports the
  // provider configured AND the plan has at least one purchasable interval on it. An
  // unavailable gateway shows as a disabled option instead of disappearing.
  const gatewayRows = gateways.map((g) => {
    const provider = config?.providers?.[g.value];
    const matrix = planConfig?.checkout?.[g.value];
    const enabled = Boolean(provider?.configured && matrix && Object.values(matrix).some(Boolean));
    return { ...g, enabled };
  });
  const enabledGateways = gatewayRows.filter((g) => g.enabled);

  // If the preferred gateway is unavailable (e.g. Stripe unconfigured), fall to the first enabled.
  useEffect(() => {
    if (enabledGateways.length && !enabledGateways.some((g) => g.value === gateway)) {
      setGateway(enabledGateways[0].value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledGateways.map((g) => g.value).join(","), gateway]);

  const intervals: { value: Interval; label: string }[] = [
    { value: "monthly", label: "Monthly" },
    { value: "quarterly", label: "Quarterly" },
    { value: "yearly", label: "Yearly" },
  ];

  const availableIntervals = intervals.filter(
    (i) => planConfig?.checkout?.[gateway]?.[i.value] ?? false,
  );

  // Switching gateway can strand the selected interval — snap to the first offered one.
  useEffect(() => {
    if (availableIntervals.length && !availableIntervals.some((i) => i.value === interval)) {
      setInterval(availableIntervals[0].value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateway, availableIntervals.map((i) => i.value).join(","), interval]);

  const usdForInterval = (): number | null => {
    if (!planConfig) return null;
    const p = planConfig.pricing;
    if (interval === "monthly") return p.monthlyUsd;
    if (interval === "quarterly") return p.quarterlyUsd;
    return p.yearlyUsd;
  };

  const priceDisplay = () => {
    if (gateway === "razorpay") {
      /**
       * 🔴 Read, never converted. This was `usd * (config.usdToInrRate ?? 84)`, and
       * `usdToInrRate` does not exist on `/billing/config` — so the fallback always fired and the
       * figure shown was inflated 1.5–2×. **There is no FX derivation anywhere (D4).**
       *
       * ⚠️ **Quarterly has no authored INR** — the package catalogue carries monthly and yearly
       * only. It shows an em dash rather than a converted number: no price is better than a wrong
       * one, and inventing one here is the defect this replaced.
       */
      if (interval === "quarterly") return "—";
      const paise = inrPaiseForInterval(pkg, interval);
      return paise == null ? "—" : `${formatInrPaise(paise)}/mo`;
    }
    const usd = usdForInterval();
    if (usd == null) return "—";
    return `$${usd}/mo`;
  };

  const handleCheckout = async () => {
    if (!workspaceId) return;
    localStorage.setItem("liffio_post_checkout", "/onboarding");
    setPaying(true);
    try {
      const result = await checkoutMutation.mutateAsync({
        plan,
        interval,
        provider: gateway,
      });

      if (result.provider === "razorpay" && result.subscriptionId) {
        const keyId = config?.providers.razorpay.keyId;
        if (!keyId) throw new Error("Razorpay is not configured");

        const payload = await openRazorpaySubscriptionCheckout({
          keyId,
          subscriptionId: result.subscriptionId,
          email: userEmail ?? undefined,
          description: `${planConfig?.displayName ?? plan} plan — billed ${interval}`,
        });

        await verifyRazorpayCheckout(workspaceId, payload);
        toast.success("Payment successful — your plan is active");
        void navigate({ to: "/onboarding", replace: true });
        return;
      }

      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        toast.error("No checkout URL returned. Check payment provider configuration.");
      }
    } catch (err) {
      if (err instanceof RazorpayCheckoutCancelled) {
        toast.info("Payment cancelled — you can retry any time");
      } else {
        toast.error(err instanceof Error ? err.message : "Checkout failed");
      }
    } finally {
      setPaying(false);
    }
  };

  const highlights = planConfig?.highlights ?? [];
  const planLabel = planConfig?.displayName ?? plan;
  const price = priceDisplay();
  const busy = paying || checkoutMutation.isPending;

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
            <div className="font-display text-3xl font-bold text-foreground">{price ?? "—"}</div>
            {interval !== "monthly" && (
              <p className="mt-1 text-xs text-muted-foreground">billed {interval}</p>
            )}
          </div>

          <div className="space-y-6 px-8 py-6">
            {availableIntervals.length > 1 && (
              <div className="flex gap-1 rounded-lg border p-1">
                {availableIntervals.map((i) => (
                  <button
                    key={i.value}
                    type="button"
                    onClick={() => setInterval(i.value)}
                    className={cn(
                      "flex-1 rounded-md py-1.5 text-xs font-medium transition-colors",
                      interval === i.value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {i.label}
                  </button>
                ))}
              </div>
            )}

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
                      {g.enabled ? g.detail : "Temporarily unavailable"}
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
              onClick={() => void handleCheckout()}
              disabled={busy || !workspaceId || configQuery.isLoading || !enabledGateways.length}
            >
              {busy
                ? gateway === "razorpay"
                  ? "Waiting for payment…"
                  : "Redirecting to payment…"
                : `Upgrade to ${planLabel}`}
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
    </div>
  );
}
