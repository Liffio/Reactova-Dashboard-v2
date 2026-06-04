import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CreditCard, IndianRupee, Loader2, Shield } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { PlanBadge, type PlanName } from "@/components/PlanBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { useApp } from "@/state/AppContext";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import {
  useBillingCancelMutation,
  useBillingCheckoutMutation,
  useBillingConfigQuery,
  useBillingInvoicesQuery,
  useBillingPortalMutation,
  useBillingSubscriptionQuery,
  useBillingSyncMutation
} from "@/hooks/useBilling";
import { useQueryClient } from "@tanstack/react-query";

type Interval = "monthly" | "quarterly" | "yearly";

const planToBadge = (plan: string): PlanName => {
  const map: Record<string, PlanName> = {
    FREE: "Free",
    STARTER: "Starter",
    PRO: "Pro",
    BUSINESS: "Business",
    AGENCY: "Agency"
  };
  return map[plan] ?? "Free";
};

const formatUsd = (amount: number | null) => {
  if (amount === null) return "—";
  if (amount === 0) return "$0";
  return `$${amount % 1 === 0 ? amount : amount.toFixed(2)}`;
};

export function BillingContent() {
  const { current, refreshAuth } = useApp();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [interval, setInterval] = useState<Interval>("monthly");
  const [provider, setProvider] = useState<"stripe" | "razorpay">("stripe");

  const configQuery = useBillingConfigQuery();
  const subQuery = useBillingSubscriptionQuery(current.id);
  const invoicesQuery = useBillingInvoicesQuery(current.id);
  const checkoutMutation = useBillingCheckoutMutation(current.id);
  const portalMutation = useBillingPortalMutation(current.id);
  const cancelMutation = useBillingCancelMutation(current.id);
  const syncMutation = useBillingSyncMutation(current.id);

  const config = configQuery.data;
  const subscription = subQuery.data;
  const currentPlanKey = subscription?.plan ?? "FREE";

  useEffect(() => {
    const status = searchParams.get("status");
    const sessionId = searchParams.get("session_id");

    if (status === "success") {
      void (async () => {
        try {
          if (sessionId) {
            await syncMutation.mutateAsync({ sessionId });
          } else {
            await syncMutation.mutateAsync({});
          }
          toast.success("Plan updated for this workspace.");
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Payment received but plan sync failed. Try again in a moment."
          );
        }
        await refreshAuth();
        void queryClient.invalidateQueries({ queryKey: ["billing-subscription", current.id] });
        void queryClient.invalidateQueries({ queryKey: ["billing-invoices", current.id] });
        void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
        // Post-registration checkout redirect
        const postCheckout = localStorage.getItem("liffio_post_checkout");
        if (postCheckout) {
          localStorage.removeItem("liffio_post_checkout");
          navigate(postCheckout, { replace: true });
          return;
        }
      })();
    }
    if (status === "cancelled") toast.info("Checkout cancelled");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per success redirect
  }, [searchParams.get("status"), searchParams.get("session_id"), current.id]);

  useEffect(() => {
    if (config?.providers.stripe.configured) setProvider("stripe");
    else if (config?.providers.razorpay.configured) setProvider("razorpay");
  }, [config]);

  const paidPlans = useMemo(
    () => (config?.plans ?? []).filter((p) => p.pricing.monthlyUsd > 0),
    [config]
  );

  const intervalAvailable = useMemo(() => {
    const keys: Interval[] = ["monthly", "quarterly", "yearly"];
    return Object.fromEntries(
      keys.map((key) => [
        key,
        paidPlans.some((p) => p.checkout?.[provider]?.[key] ?? false)
      ])
    ) as Record<Interval, boolean>;
  }, [paidPlans, provider]);

  useEffect(() => {
    if (!intervalAvailable[interval]) {
      const fallback = (["monthly", "quarterly", "yearly"] as Interval[]).find((k) => intervalAvailable[k]);
      if (fallback) setInterval(fallback);
    }
  }, [interval, intervalAvailable]);

  const priceFor = (plan: (typeof paidPlans)[0]) => {
    if (interval === "monthly") return plan.pricing.monthlyUsd;
    if (interval === "quarterly") return plan.pricing.quarterlyUsd;
    return plan.pricing.yearlyUsd;
  };

  const canCheckout = (plan: (typeof paidPlans)[0]) =>
    Boolean(plan.checkout?.[provider]?.[interval]);

  const startCheckout = async (plan: string) => {
    try {
      const result = await checkoutMutation.mutateAsync({ plan, interval, provider });
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      toast.error("No checkout URL returned. Check payment provider configuration.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed");
    }
  };

  const openPortal = async () => {
    try {
      const { url } = await portalMutation.mutateAsync();
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to open billing portal");
    }
  };

  return (
    <div className="space-y-6">
        {config?.isSandbox && (
          <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
            <Shield className="h-4 w-4 shrink-0" />
            <span>
              <strong>Sandbox mode</strong> — payments use Stripe/Razorpay test credentials. No real charges.
            </span>
          </div>
        )}

        <div className="surface-card p-5 pl-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Current plan</p>
              <div className="flex items-center gap-2 mt-1">
                <PlanBadge plan={planToBadge(currentPlanKey)} />
                {subscription?.status && (
                  <StatusBadge
                    status={subscription.status === "ACTIVE" ? "active" : "paused"}
                    label={subscription.status}
                  />
                )}
              </div>
              {subscription?.billingCycleEnd && (
                <p className="text-xs text-muted-foreground mt-2">
                  {subscription.cancelAtPeriodEnd ? "Access until" : "Renews"}{" "}
                  {new Date(subscription.billingCycleEnd).toLocaleDateString()}
                </p>
              )}
              {subscription?.cancelAtPeriodEnd && (
                <p className="text-xs text-warning mt-1">Cancellation scheduled at period end</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {config?.providers.stripe.configured && subscription?.hasActiveSubscription && (
                <Button variant="outline" size="sm" onClick={() => void openPortal()} disabled={portalMutation.isPending}>
                  Manage subscription
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="text-destructive"
                disabled={cancelMutation.isPending || currentPlanKey === "FREE"}
                onClick={() => {
                  void cancelMutation.mutateAsync().then((r) =>
                    toast.success(r.message ?? "Cancellation scheduled")
                  );
                }}
              >
                {cancelMutation.isPending ? "Cancelling…" : "Cancel at period end"}
              </Button>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-muted-foreground text-xs">Workflows</p>
              <p className="font-semibold">{subscription?.limits.workflows ?? "—"}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-muted-foreground text-xs">Team seats</p>
              <p className="font-semibold">{subscription?.limits.teamMembers ?? "—"}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-muted-foreground text-xs">API keys</p>
              <p className="font-semibold">{subscription?.limits.maxApiCredentials ?? "—"}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="inline-flex rounded-lg border border-border p-1 bg-muted/30">
            {(["monthly", "quarterly", "yearly"] as Interval[]).map((key) => (
              <button
                key={key}
                type="button"
                disabled={!intervalAvailable[key]}
                onClick={() => setInterval(key)}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-md capitalize transition-colors",
                  interval === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  !intervalAvailable[key] && "opacity-40 cursor-not-allowed"
                )}
              >
                {key}
              </button>
            ))}
          </div>

          <div className="inline-flex rounded-lg border border-border p-1 bg-muted/30">
            <button
              type="button"
              disabled={!config?.providers.stripe.configured}
              onClick={() => setProvider("stripe")}
              className={cn(
                "px-3 py-1.5 text-sm rounded-md inline-flex items-center gap-1.5 transition-colors",
                provider === "stripe" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
            >
              <CreditCard className="h-3.5 w-3.5" />
              Stripe
            </button>
            <button
              type="button"
              disabled={!config?.providers.razorpay.configured}
              onClick={() => setProvider("razorpay")}
              className={cn(
                "px-3 py-1.5 text-sm rounded-md inline-flex items-center gap-1.5 transition-colors",
                provider === "razorpay" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
            >
              <IndianRupee className="h-3.5 w-3.5" />
              Razorpay
            </button>
          </div>
        </div>

        {!config?.providers.stripe.configured && !config?.providers.razorpay.configured && (
          <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
            No payment providers configured. Add Stripe and/or Razorpay sandbox keys in server <code className="text-xs">.env</code>{" "}
            (see <code className="text-xs">billing.env.example</code>).
          </p>
        )}

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
          {paidPlans.map((plan) => {
            const price = priceFor(plan);
            const isCurrent = plan.plan === currentPlanKey;
            const disabled = !canCheckout(plan) || price === null || checkoutMutation.isPending;

            return (
              <div
                key={plan.plan}
                className={cn(
                  "rounded-xl border p-5 flex flex-col gap-4",
                  isCurrent ? "border-primary bg-primary/5" : "border-border bg-card"
                )}
              >
                <div>
                  <PlanBadge plan={planToBadge(plan.plan)} />
                  <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                </div>
                <div>
                  <span className="text-3xl font-bold">{formatUsd(price)}</span>
                  <span className="text-sm text-muted-foreground">/{interval === "yearly" ? "yr" : interval === "quarterly" ? "qtr" : "mo"}</span>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1 flex-1">
                  {plan.highlights.map((h) => (
                    <li key={h}>• {h}</li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={isCurrent ? "outline" : "default"}
                  disabled={disabled || isCurrent}
                  onClick={() => void startCheckout(plan.plan)}
                >
                  {checkoutMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isCurrent ? (
                    "Current plan"
                  ) : (
                    `Upgrade — ${provider === "stripe" ? "Stripe" : "Razorpay"}`
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h3 className="font-semibold text-sm">Invoice history</h3>
          {invoicesQuery.isLoading && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          )}
          {!invoicesQuery.isLoading && (invoicesQuery.data?.invoices.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">No invoices for this workspace yet.</p>
          )}
          <ul className="divide-y divide-border text-sm">
            {(invoicesQuery.data?.invoices ?? []).map((inv) => (
              <li key={inv.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                <span>
                  {(inv.amountCents / 100).toFixed(2)} {inv.currency} · {inv.status}
                  {inv.paidAt && (
                    <span className="text-muted-foreground ml-2">
                      {new Date(inv.paidAt).toLocaleDateString()}
                    </span>
                  )}
                </span>
                {inv.hostedInvoiceUrl && (
                  <a
                    href={inv.hostedInvoiceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline text-xs"
                  >
                    View receipt
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Each workspace has its own plan. Indian accounts default to Razorpay; others to Stripe. You can switch provider below.
        </p>
    </div>
  );
}

export default function Billing() {
  const { current } = useApp();
  return (
    <DashboardLayout title="Billing" subtitle={`Workspace: ${current.handle}`}>
      <BillingContent />
    </DashboardLayout>
  );
}

