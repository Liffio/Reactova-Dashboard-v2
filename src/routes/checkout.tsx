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
  verifyRazorpayCheckout,
  type CheckoutInput,
} from "@/lib/api/billing-api";
import {
  openRazorpaySubscriptionCheckout,
  RazorpayCheckoutCancelled,
} from "@/lib/razorpay-checkout";
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

const PLAN_LABELS: Record<string, string> = {
  PRO: "Pro",
  BUSINESS: "Business",
  AGENCY: "Agency",
};

const PLAN_HIGHLIGHTS: Record<string, string[]> = {
  PRO: [
    "5 Instagram accounts",
    "50,000 automated DMs / month",
    "All 8 automation trigger types",
    "Short links + lead capture",
    "Post scheduler",
    "Priority email support",
  ],
  BUSINESS: [
    "10 Instagram accounts",
    "Unlimited automated DMs",
    "Full conversion analytics",
    "5 team member seats",
    "External API access",
    "Everything in Pro",
  ],
  AGENCY: [
    "Unlimited accounts",
    "White-label dashboard",
    "Client sub-workspaces",
    "Full API + webhooks",
    "Custom onboarding",
    "Everything in Business",
  ],
};

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
  const plan = (search.plan ?? "PRO").toUpperCase();
  const workspaceId = useAuthState((s) => s.workspaceId) ?? "";
  const userEmail = useAuthState((s) => s.user?.email);

  const [interval, setInterval] = useState<Interval>("monthly");
  const [gateway, setGateway] = useState<Gateway>("stripe");
  const [paying, setPaying] = useState(false);

  const configQuery = useQuery({ queryKey: ["billing-config"], queryFn: getBillingConfig });
  const checkoutMutation = useMutation({
    mutationFn: (body: CheckoutInput) => createBillingCheckout(workspaceId, body),
  });

  const config = configQuery.data;
  const planConfig = config?.plans.find((p) => p.plan === plan);
  const inrRate = config?.usdToInrRate ?? 84;

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

  const availableGateways = gateways.filter((g) => {
    const provider = config?.providers?.[g.value];
    if (!provider?.configured) return false;
    // A gateway is only offered if this plan has at least one purchasable interval on it.
    const matrix = planConfig?.checkout?.[g.value];
    return matrix ? Object.values(matrix).some(Boolean) : false;
  });

  // If the preferred gateway is unavailable (e.g. Stripe unconfigured), fall to the first offered.
  useEffect(() => {
    if (availableGateways.length && !availableGateways.some((g) => g.value === gateway)) {
      setGateway(availableGateways[0].value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableGateways.map((g) => g.value).join(","), gateway]);

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
    const usd = usdForInterval();
    if (usd == null) return "—";
    if (gateway === "razorpay") {
      return `₹${(usd * inrRate).toLocaleString("en-IN")}/mo`;
    }
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
          description: `${PLAN_LABELS[plan] ?? plan} plan — billed ${interval}`,
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

  const highlights = PLAN_HIGHLIGHTS[plan] ?? PLAN_HIGHLIGHTS["PRO"];
  const planLabel = PLAN_LABELS[plan] ?? plan;
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

            {availableGateways.length >= 1 && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Payment type
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {availableGateways.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => setGateway(g.value)}
                      className={cn(
                        "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                        gateway === g.value
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "hover:border-foreground/20",
                      )}
                    >
                      <span className="flex items-center gap-1.5 text-sm font-semibold">
                        <g.icon className="h-4 w-4" />
                        {g.label}
                      </span>
                      <span className="text-xs text-muted-foreground">{g.detail}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

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
              disabled={busy || !workspaceId || configQuery.isLoading || !availableGateways.length}
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
