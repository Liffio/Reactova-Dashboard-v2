import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Check, Zap } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { useAppSelector } from "@/store/hooks";
import { useBillingCheckoutMutation, useBillingConfigQuery } from "@/hooks/useBilling";

type Interval = "monthly" | "quarterly" | "yearly";

const PLAN_LABELS: Record<string, string> = {
  PRO: "Pro",
  BUSINESS: "Business",
  AGENCY: "Agency"
};

const PLAN_HIGHLIGHTS: Record<string, string[]> = {
  PRO: [
    "5 Instagram accounts",
    "50,000 automated DMs / month",
    "All 8 automation trigger types",
    "Short links + lead capture",
    "Post scheduler",
    "Priority email support"
  ],
  BUSINESS: [
    "10 Instagram accounts",
    "Unlimited automated DMs",
    "Full conversion analytics",
    "5 team member seats",
    "External API access",
    "Everything in Pro"
  ],
  AGENCY: [
    "Unlimited accounts",
    "White-label dashboard",
    "Client sub-workspaces",
    "Full API + webhooks",
    "Custom onboarding",
    "Everything in Business"
  ]
};

export default function PostRegistrationCheckout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const plan = (searchParams.get("plan") ?? "PRO").toUpperCase();
  const workspaceId = useAppSelector((state) => state.auth.workspaceId) ?? "";

  const [interval, setInterval] = useState<Interval>("monthly");
  const [provider, setProvider] = useState<"stripe" | "razorpay">("stripe");

  const configQuery = useBillingConfigQuery();
  const checkoutMutation = useBillingCheckoutMutation(workspaceId);

  const config = configQuery.data;
  const planConfig = config?.plans.find((p) => p.plan === plan);

  useEffect(() => {
    if (config?.providers.stripe.configured) setProvider("stripe");
    else if (config?.providers.razorpay.configured) setProvider("razorpay");
  }, [config]);

  const priceDisplay = () => {
    if (!planConfig) return "—";
    const p = planConfig.pricing;
    if (interval === "monthly") return `$${p.monthlyUsd}/mo`;
    if (interval === "quarterly") return p.quarterlyUsd ? `$${p.quarterlyUsd}/mo` : null;
    return p.yearlyUsd ? `$${p.yearlyUsd}/mo` : null;
  };

  const handleCheckout = async () => {
    if (!workspaceId) return;
    localStorage.setItem("liffio_post_checkout", "/onboarding");
    try {
      const result = await checkoutMutation.mutateAsync({ plan, interval, provider });
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        toast.error("No checkout URL returned. Check payment provider configuration.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed");
    }
  };

  const highlights = PLAN_HIGHLIGHTS[plan] ?? PLAN_HIGHLIGHTS["PRO"];
  const planLabel = PLAN_LABELS[plan] ?? plan;
  const price = priceDisplay();

  const intervals: { value: Interval; label: string }[] = [
    { value: "monthly", label: "Monthly" },
    { value: "quarterly", label: "Quarterly" },
    { value: "yearly", label: "Yearly" }
  ];

  const availableIntervals = intervals.filter((i) =>
    planConfig?.checkout?.[provider]?.[i.value] ?? false
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <ThemeToggle className="fixed top-4 right-4 p-2 rounded-lg border border-border bg-card/80 backdrop-blur hover:bg-card transition-colors z-20" />

      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl animate-in fade-in duration-300">
          {/* Plan header */}
          <div className="bg-primary/10 border-b border-border px-8 py-6 text-center">
            <div className="inline-flex items-center gap-2 text-primary font-semibold text-sm mb-2">
              <Zap className="h-4 w-4" />
              Complete your {planLabel} setup
            </div>
            <div className="text-3xl font-bold text-foreground">{price ?? "—"}</div>
            {interval !== "monthly" && (
              <p className="text-xs text-muted-foreground mt-1">billed {interval}</p>
            )}
          </div>

          <div className="px-8 py-6 space-y-6">
            {/* Interval selector */}
            {availableIntervals.length > 1 && (
              <div className="flex rounded-lg border border-border p-1 gap-1">
                {availableIntervals.map((i) => (
                  <button
                    key={i.value}
                    type="button"
                    onClick={() => setInterval(i.value)}
                    className={cn(
                      "flex-1 py-1.5 text-xs rounded-md transition-colors font-medium",
                      interval === i.value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {i.label}
                  </button>
                ))}
              </div>
            )}

            {/* Feature list */}
            <ul className="space-y-2.5">
              {highlights.map((feat) => (
                <li key={feat} className="flex items-center gap-2.5 text-sm">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>

            {/* Provider toggle */}
            {config?.providers.stripe.configured && config.providers.razorpay.configured && (
              <div className="flex rounded-lg border border-border p-1 gap-1">
                <button
                  type="button"
                  onClick={() => setProvider("stripe")}
                  className={cn(
                    "flex-1 py-1.5 text-xs rounded-md transition-colors font-medium",
                    provider === "stripe" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Pay with card (Stripe)
                </button>
                <button
                  type="button"
                  onClick={() => setProvider("razorpay")}
                  className={cn(
                    "flex-1 py-1.5 text-xs rounded-md transition-colors font-medium",
                    provider === "razorpay" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Pay with UPI (Razorpay)
                </button>
              </div>
            )}

            <Button
              className="w-full gap-2"
              size="lg"
              onClick={() => void handleCheckout()}
              disabled={checkoutMutation.isPending || !workspaceId || configQuery.isLoading}
            >
              {checkoutMutation.isPending ? "Redirecting to payment…" : `Upgrade to ${planLabel}`}
              <ArrowRight className="h-4 w-4" />
            </Button>

            <button
              type="button"
              onClick={() => navigate("/onboarding", { replace: true })}
              className="w-full text-xs text-muted-foreground hover:text-foreground text-center py-1 transition-colors"
            >
              Skip for now — start with the free plan
            </button>
          </div>
        </div>

        {config?.isSandbox && (
          <p className="text-center text-xs text-muted-foreground mt-4">
            Sandbox mode — no real charges will be made.
          </p>
        )}
      </div>
    </div>
  );
}
