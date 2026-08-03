import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, ExternalLink, IndianRupee, RefreshCw, Zap } from "lucide-react";
import { toast } from "@/lib/toast";

import { PageHeader } from "@/components/dashboard/page-header";
import { ProtectedRoute } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  cancelBillingSubscription,
  createBillingCheckout,
  createBillingPortalSession,
  getBillingConfig,
  getBillingSubscription,
  listBillingInvoices,
  syncBilling,
  verifyRazorpayCheckout,
  type CheckoutInput,
} from "@/lib/api/billing-api";
import {
  openRazorpaySubscriptionCheckout,
  RazorpayCheckoutCancelled,
} from "@/lib/razorpay-checkout";
import { useAuthState } from "@/lib/auth/auth-store";
import { useApp } from "@/state/app-context";

type Gateway = "stripe" | "razorpay";

type BillingSearch = { status?: string };

export const Route = createFileRoute("/_app/billings")({
  validateSearch: (search: Record<string, unknown>): BillingSearch => ({
    status: typeof search.status === "string" ? search.status : undefined,
  }),
  head: () => ({ meta: [{ title: "Billing — Liffio" }] }),
  component: BillingRoute,
});

function BillingRoute() {
  return (
    <ProtectedRoute module="workspace">
      <BillingPage />
    </ProtectedRoute>
  );
}

const planOrder = ["FREE", "STARTER", "PRO", "BUSINESS", "AGENCY"];

const statusStyles: Record<string, string> = {
  ACTIVE: "border-success/30 bg-success/10 text-success",
  PAID: "border-success/30 bg-success/10 text-success",
  PAST_DUE: "border-warning/30 bg-warning/10 text-warning",
  PAYMENT_FAILED: "border-destructive/30 bg-destructive/10 text-destructive",
  CANCELED: "border-border bg-muted text-muted-foreground",
};

function BillingPage() {
  const { current, refreshAuth } = useApp();
  const workspaceId = current.id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { status: checkoutStatus } = Route.useSearch();
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [gatewayChoice, setGatewayChoice] = useState<string | null>(null);
  const [payingRazorpay, setPayingRazorpay] = useState(false);
  const userEmail = useAuthState((s) => s.user?.email);

  const configQuery = useQuery({
    queryKey: ["billing-config"],
    queryFn: getBillingConfig,
    staleTime: 5 * 60_000,
  });

  const subQuery = useQuery({
    queryKey: ["billing-subscription", workspaceId],
    queryFn: () => getBillingSubscription(workspaceId),
    enabled: Boolean(workspaceId) && workspaceId !== "default",
  });

  const invoicesQuery = useQuery({
    queryKey: ["billing-invoices", workspaceId],
    queryFn: () => listBillingInvoices(workspaceId),
    enabled: Boolean(workspaceId) && workspaceId !== "default",
  });

  const syncMutation = useMutation({
    mutationFn: (silent?: boolean) => syncBilling(workspaceId).then((r) => ({ ...r, silent })),
    onSuccess: ({ silent }) => {
      if (!silent) toast.success("Billing synced");
      void queryClient.invalidateQueries({ queryKey: ["billing-subscription", workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ["billing-invoices", workspaceId] });
      void refreshAuth();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  useEffect(() => {
    if (!checkoutStatus) return;
    if (checkoutStatus === "success") {
      toast.success("Payment successful! Activating your plan…");
      syncMutation.mutate(true);
    } else if (checkoutStatus === "cancelled") {
      toast.info("Checkout cancelled — no charge was made.");
    }
    void navigate({ to: "/billings", replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutStatus]);

  const checkoutMutation = useMutation({
    mutationFn: (body: CheckoutInput) => createBillingCheckout(workspaceId, body),
    onSuccess: ({ checkoutUrl }) => {
      if (checkoutUrl) window.location.href = checkoutUrl;
    },
    onError: (e) => toast.error((e as Error).message),
  });

  /**
   * Both gateway types, always. A gateway the backend has not enabled (or that has no
   * price for the chosen interval) renders as a disabled row with the reason, rather
   * than vanishing — the payment-type step must always show what payment methods exist.
   */
  const gatewayOptions = (
    planKey: string,
  ): { value: Gateway; available: boolean; reason?: string }[] => {
    const planCfg = configQuery.data?.plans.find((p) => p.plan === planKey);
    const providers = configQuery.data?.providers;

    const stripeConfigured = Boolean(providers?.stripe.configured);
    const stripePriced = Boolean(planCfg?.checkout?.stripe?.[interval]);
    const razorpayConfigured = Boolean(providers?.razorpay.configured && providers.razorpay.keyId);
    const razorpayPriced = Boolean(planCfg?.checkout?.razorpay?.[interval]);

    return [
      {
        value: "stripe",
        available: stripeConfigured && stripePriced,
        reason: !stripeConfigured
          ? "Temporarily unavailable"
          : !stripePriced
            ? `Not available for ${interval} billing`
            : undefined,
      },
      {
        value: "razorpay",
        available: razorpayConfigured && razorpayPriced,
        reason: !razorpayConfigured
          ? "Temporarily unavailable"
          : !razorpayPriced
            ? `Not available for ${interval} billing`
            : undefined,
      },
    ];
  };

  // Razorpay pays inside a modal on this page, so on success the page can refetch and
  // show the new plan immediately — no redirect round-trip involved.
  const startRazorpayCheckout = async (planKey: string) => {
    const keyId = configQuery.data?.providers.razorpay.keyId;
    if (!keyId) {
      toast.error("Razorpay is not configured");
      return;
    }
    setPayingRazorpay(true);
    try {
      const result = await createBillingCheckout(workspaceId, {
        plan: planKey,
        interval,
        provider: "razorpay",
      });
      if (result.provider !== "razorpay" || !result.subscriptionId) {
        throw new Error("Razorpay checkout could not be started");
      }
      const payload = await openRazorpaySubscriptionCheckout({
        keyId,
        subscriptionId: result.subscriptionId,
        email: userEmail ?? undefined,
        description: `${planKey} plan — billed ${interval}`,
      });
      await verifyRazorpayCheckout(workspaceId, payload);
      toast.success("Payment successful! Your plan is now active.");
      void queryClient.invalidateQueries({ queryKey: ["billing-subscription", workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ["billing-invoices", workspaceId] });
      void refreshAuth();
    } catch (err) {
      if (err instanceof RazorpayCheckoutCancelled) {
        toast.info("Payment cancelled — no charge was made.");
      } else {
        toast.error(err instanceof Error ? err.message : "Payment failed");
      }
    } finally {
      setPayingRazorpay(false);
    }
  };

  const startCheckout = (planKey: string, gateway: Gateway) => {
    setGatewayChoice(null);
    if (gateway === "razorpay") {
      void startRazorpayCheckout(planKey);
    } else {
      checkoutMutation.mutate({ plan: planKey, interval, provider: "stripe" });
    }
  };

  // Always open the payment-type step, even with a single usable gateway — the user
  // should see and confirm how they are about to pay, never be bounced straight out.
  const handleUpgradeClick = (planKey: string) => {
    const options = gatewayOptions(planKey);
    if (!options.some((o) => o.available)) {
      toast.error("This plan is not available for online checkout yet.");
      return;
    }
    setGatewayChoice(planKey);
  };

  const portalMutation = useMutation({
    mutationFn: () => createBillingPortalSession(workspaceId),
    onSuccess: ({ url }) => window.open(url, "_blank"),
    onError: (e) => toast.error((e as Error).message),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelBillingSubscription(workspaceId),
    onSuccess: () => {
      toast.success("Subscription cancelled");
      setCancelOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["billing-subscription", workspaceId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const sub = subQuery.data;
  const plans = (configQuery.data?.plans ?? []).sort(
    (a, b) => planOrder.indexOf(a.plan) - planOrder.indexOf(b.plan),
  );
  const invoices = invoicesQuery.data?.invoices ?? [];
  const currentPlanIndex = planOrder.indexOf(sub?.plan ?? "FREE");

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="Billing"
        description="Manage your subscription plan and view payment history."
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={syncMutation.isPending}
              onClick={() => syncMutation.mutate(false)}
            >
              <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              Sync
            </Button>
            {sub?.hasActiveSubscription && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={portalMutation.isPending}
                onClick={() => portalMutation.mutate()}
              >
                <ExternalLink className="h-4 w-4" />
                Manage
              </Button>
            )}
          </div>
        }
      />

      <div className="space-y-6 p-4 sm:p-6 md:p-10">
        {/* Current plan */}
        <div className="rounded-2xl border bg-card p-6 shadow-soft">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Current plan
              </p>
              {subQuery.isLoading ? (
                <Skeleton className="mt-1 h-7 w-32" />
              ) : (
                <div className="mt-1 flex items-center gap-2">
                  <h2 className="font-display text-2xl font-bold">{sub?.displayName ?? "Free"}</h2>
                  {sub?.billingStatus && (
                    <Badge variant="outline" className={statusStyles[sub.billingStatus] ?? ""}>
                      {sub.billingStatus.toLowerCase().replace(/_/g, " ")}
                    </Badge>
                  )}
                </div>
              )}
              {sub?.billingCycleEnd && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {sub.cancelAtPeriodEnd ? "Cancels" : "Renews"}{" "}
                  {new Date(sub.billingCycleEnd).toLocaleDateString()}
                </p>
              )}
            </div>
            {sub?.hasActiveSubscription && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setCancelOpen(true)}
              >
                Cancel subscription
              </Button>
            )}
          </div>
        </div>

        {/* Plan selector */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Upgrade your plan</h2>
            <div className="flex gap-2">
              {(["monthly", "yearly"] as const).map((iv) => (
                <Button
                  key={iv}
                  size="sm"
                  variant={interval === iv ? "default" : "outline"}
                  onClick={() => setInterval(iv)}
                >
                  {iv === "yearly" ? "Yearly (save ~20%)" : "Monthly"}
                </Button>
              ))}
            </div>
          </div>
          {configQuery.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {plans.map((plan) => {
                const planIdx = planOrder.indexOf(plan.plan);
                const isCurrent = plan.plan === sub?.plan;
                const isDowngrade = planIdx < currentPlanIndex;
                const price =
                  interval === "yearly"
                    ? (plan.pricing.yearlyUsd ?? plan.pricing.monthlyUsd)
                    : plan.pricing.monthlyUsd;
                return (
                  <div
                    key={plan.plan}
                    className={`relative flex flex-col rounded-2xl border p-5 shadow-soft transition-all ${
                      isCurrent
                        ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                        : "bg-card hover:-translate-y-0.5"
                    }`}
                  >
                    {isCurrent && (
                      <span className="absolute -top-2.5 left-4 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                        Current
                      </span>
                    )}
                    <div className="mb-1 flex items-center gap-1.5">
                      <Zap className="h-4 w-4 text-primary" />
                      <span className="font-display text-sm font-semibold">{plan.displayName}</span>
                    </div>
                    <div className="mb-4 mt-2">
                      <span className="font-display text-3xl font-bold">
                        ${price === 0 ? "0" : price.toFixed(0)}
                      </span>
                      {price > 0 && (
                        <span className="text-xs text-muted-foreground">
                          /{interval === "yearly" ? "yr" : "mo"}
                        </span>
                      )}
                    </div>
                    <ul className="mb-5 flex-1 space-y-1.5 text-xs text-muted-foreground">
                      {plan.highlights.slice(0, 5).map((h) => (
                        <li key={h} className="flex items-start gap-1.5">
                          <span className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success">✓</span>
                          {h}
                        </li>
                      ))}
                    </ul>
                    <Button
                      size="sm"
                      variant={isCurrent ? "outline" : "default"}
                      className={
                        !isCurrent
                          ? "bg-brand-gradient text-primary-foreground shadow-glow hover:opacity-95"
                          : ""
                      }
                      disabled={
                        isCurrent ||
                        isDowngrade ||
                        checkoutMutation.isPending ||
                        payingRazorpay ||
                        plan.plan === "FREE"
                      }
                      onClick={() => !isCurrent && !isDowngrade && handleUpgradeClick(plan.plan)}
                    >
                      {isCurrent ? "Current plan" : isDowngrade ? "Contact us" : "Upgrade"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Invoices */}
        <div className="rounded-2xl border bg-card shadow-soft">
          <div className="border-b px-6 py-4">
            <h2 className="font-display text-lg font-semibold">Invoice history</h2>
          </div>
          {invoicesQuery.isLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-lg" />
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-muted-foreground">
              No invoices yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-6 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Plan</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-6 py-3 text-muted-foreground">
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 capitalize">{inv.plan ?? "—"}</td>
                      <td className="px-4 py-3 tabular-nums font-medium">
                        {(inv.amountCents / 100).toFixed(2)} {inv.currency.toUpperCase()}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={statusStyles[inv.status.toUpperCase()] ?? ""}
                        >
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-3">
                        {inv.hostedInvoiceUrl && (
                          <a
                            href={inv.hostedInvoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            View <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={gatewayChoice !== null}
        onOpenChange={(open) => !open && setGatewayChoice(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase tracking-widest">
              Payment type
            </DialogTitle>
            {gatewayChoice && (
              <DialogDescription>
                {configQuery.data?.plans.find((p) => p.plan === gatewayChoice)?.displayName ??
                  gatewayChoice}{" "}
                plan, billed {interval}. Your plan activates immediately after payment.
              </DialogDescription>
            )}
          </DialogHeader>
          {gatewayChoice &&
            (() => {
              const planCfg = configQuery.data?.plans.find((p) => p.plan === gatewayChoice);
              const usd =
                interval === "yearly"
                  ? (planCfg?.pricing.yearlyUsd ?? planCfg?.pricing.monthlyUsd)
                  : planCfg?.pricing.monthlyUsd;
              const inrRate = configQuery.data?.usdToInrRate ?? 84;
              const options = gatewayOptions(gatewayChoice);

              const meta: Record<
                Gateway,
                { icon: typeof CreditCard; title: string; sub: string; price: string | null }
              > = {
                stripe: {
                  icon: CreditCard,
                  title: "Credit / Debit card",
                  sub: "Visa, Mastercard, Amex — via Stripe",
                  price: usd != null ? `$${usd}` : null,
                },
                razorpay: {
                  icon: IndianRupee,
                  title: "UPI / NetBanking / Cards",
                  sub: "India — via Razorpay",
                  price: usd != null ? `₹${(usd * inrRate).toLocaleString("en-IN")}` : null,
                },
              };

              return (
                <div className="flex flex-col gap-1">
                  {options.map((option, idx) => {
                    const m = meta[option.value];
                    return (
                      <div key={option.value}>
                        {idx > 0 && (
                          <p className="py-2 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            or
                          </p>
                        )}
                        <button
                          type="button"
                          disabled={!option.available}
                          className="flex w-full items-center justify-between rounded-lg border-2 p-4 text-left transition-colors enabled:hover:border-primary enabled:hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => startCheckout(gatewayChoice, option.value)}
                        >
                          <span className="flex items-center gap-3">
                            <m.icon className="h-5 w-5 text-primary" />
                            <span>
                              <span className="block text-sm font-bold uppercase tracking-wide">
                                {m.title}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {option.available ? m.sub : (option.reason ?? "Unavailable")}
                              </span>
                            </span>
                          </span>
                          {option.available && m.price && (
                            <span className="text-sm font-semibold">{m.price}</span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll keep access to your current plan until the billing period ends. After that,
              your workspace will revert to Free.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep subscription</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate()}
            >
              {cancelMutation.isPending ? "Cancelling…" : "Yes, cancel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
