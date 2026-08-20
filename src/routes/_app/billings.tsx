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
  createPackageCheckout,
  getSellablePackages,
  type PackageCheckoutInput,
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

/*
 * The hardcoded `planOrder` that stood here is DELETED. (S5.5)
 *
 * It read ["FREE", "STARTER", "PRO", "BUSINESS", "AGENCY"] and was wrong in three ways at once,
 * all of them because `indexOf("GROWTH")` returned -1:
 *
 *   1. Every customer saw the Growth card as `isDowngrade` -> disabled, "Contact us".
 *      GROWTH COULD NOT BE PURCHASED IN-APP AT ALL.
 *   2. A Growth customer had currentPlanIndex = -1, so every tier read "Upgrade" -- including
 *      Starter, an actual downgrade offered as an upgrade.
 *   3. Retired PRO was still in the array and the plan list was unfiltered, so "Pro (retired)"
 *      rendered as a purchasable card.
 *
 * This array had already been wrong once before, about PRO's position. A third hand-edit buys one
 * release of correctness, so the client no longer holds an opinion about the ladder: the server
 * sends `rank` (tier order) and `sellable` (on the ladder at all), and `sortOrder` for display.
 */

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

  /**
   * The packages a tenant may buy. (S5.2 / S4.7)
   *
   * 🚩 The page renders PLANS from `/billing/config`; **checkout needs a PACKAGE id.** Until
   * `/billing/packages` existed there was no way to obtain one, so every purchase went through the
   * legacy plan path onto the `Plan` enum — which has no Growth. This query is what closes that.
   *
   * Matched to a plan card by `key`, lowercased: `BILLING_PLANS` is keyed `STARTER`/`GROWTH`/… and
   * `packages.key` is `starter`/`growth`/… . The two catalogues are deliberately separate — a
   * package need not correspond to a plan at all — so a card with no matching package simply falls
   * back to the plan path rather than breaking.
   */
  const packagesQuery = useQuery({
    queryKey: ["billing-packages"],
    queryFn: getSellablePackages,
  });

  const packageForPlan = (planKey: string) =>
    packagesQuery.data?.packages.find((p) => p.key.toUpperCase() === planKey.toUpperCase());

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
    /*
     * A neutral message, not the raw server string. (S3P.2a)
     *
     * syncWorkspaceSubscription picks its provider by reading the local workspace_subscriptions
     * row. A workspace that has paid through Razorpay but whose row was never written -- both
     * settlement observers missed, which is G56 -- falls through to the Stripe path and throws
     * "No Stripe subscription found for this workspace". Surfacing that verbatim tells a paying
     * Razorpay customer about a provider they did not use, which is the same defect as the Manage
     * button above wearing different words.
     *
     * The raw error still reaches the console for support. What the customer gets is what they can
     * act on: try again, then ask a human. Recovering that case is S3P.2b.
     */
    onError: (e) => {
      console.error("[billing] sync failed", e);
      toast.error(
        "Could not refresh billing just now. Try again, or contact support if your payment has not appeared.",
      );
    },
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

  /**
   * Buy a PACKAGE. (S5.2)
   *
   * Preferred over `checkoutMutation` wherever a package exists for the tier, because the package
   * path carries the capability ceiling and the plan path does not — and because it is the only way
   * to sell a tier the `Plan` enum has never heard of.
   *
   * ⚠️ No `provider` and no `currency` are sent. D19 made Razorpay the only gateway and S4.4
   * moved currency onto the customer's country, both resolved server-side. A client that could ask
   * for either would be a second place they could disagree.
   */
  const packageCheckoutMutation = useMutation({
    mutationFn: (body: PackageCheckoutInput) => createPackageCheckout(workspaceId, body),
    onSuccess: ({ checkoutUrl }) => {
      if (checkoutUrl) window.location.href = checkoutUrl;
    },
    onError: (e) => toast.error((e as Error).message),
  });

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

    /**
     * 🚩 The package path first, whenever a package exists for this tier. (S5.2)
     *
     * `POST /billing/package-checkout` is what makes packages the commercial reality rather than an
     * admin-console artefact: it carries the **capability ceiling**, which the plan path does not,
     * and it is the only way to sell a tier the `Plan` enum has never heard of — Growth.
     *
     * Matched by `key`: `BILLING_PLANS` is keyed `STARTER`/`GROWTH`, `packages.key` is
     * `starter`/`growth`. The catalogues are deliberately separate — a package need not correspond
     * to a plan — so a card with no matching package falls back to the plan path rather than
     * breaking.
     *
     * ✅ **Quarterly is not a concern here**, though S5.2 flagged it as one: `packageCheckoutSchema`
     * accepts monthly and yearly only, and **this page's interval state is already
     * `"monthly" | "yearly"`.** The quarterly selector lives on `/checkout` (`:136`), which is the
     * plan path and keeps its quarterly SKUs. Nothing is lost by routing this page to packages.
     */
    const pkg = packageForPlan(planKey);
    if (pkg) {
      packageCheckoutMutation.mutate({ packageId: pkg.id, interval });
      return;
    }

    if (gateway === "razorpay") {
      void startRazorpayCheckout(planKey);
    } else {
      checkoutMutation.mutate({ plan: planKey, interval, provider: "stripe" });
    }
  };

  // Always open the payment-type step, even with a single usable gateway — the user
  // should see and confirm how they are about to pay, never be bounced straight out.
  /**
   * D20's "Contact us" has to reach something. (S3P.2c)
   *
   * D20 settled that self-serve downgrade is NOT built for V1 — and correctly: `createCheckout`
   * never reads or cancels the existing subscription, so enabling the path would leave the customer
   * with two live subscriptions, both billing, with the first one orphaned beyond the product's
   * ability to cancel it (`12-downgrade.md` §2).
   *
   * But the button was `disabled` with the label "Contact us" and no contact attached — a label on
   * a dead control. **A customer who wants to pay you less rather than leave is the one you most
   * want to reach**, and the page was silently declining that conversation.
   *
   * This does not implement downgrade. It carries the workspace and the target tier to a human, so
   * the request is actionable without a round trip asking which workspace and which plan.
   */
  const handleDowngradeRequest = (planKey: string) => {
    const subject = `Downgrade request: ${sub?.plan ?? "current plan"} to ${planKey}`;
    const body = [
      `I would like to move this workspace to the ${planKey} plan.`,
      "",
      `Workspace: ${workspaceId}`,
      `Current plan: ${sub?.plan ?? "unknown"}`,
      `Requested plan: ${planKey}`,
    ].join("\n");
    window.location.href = `mailto:support@liffio.com?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
  };

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
  // Retired tiers are dropped, not merely disabled: a card nobody may buy is noise on a pricing
  // page. Sorted by the server's display order, which puts a retired tier last if one is ever
  // shown again.
  const plans = (configQuery.data?.plans ?? [])
    .filter((p) => p.sellable)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const invoices = invoicesQuery.data?.invoices ?? [];
  // Tier comparison uses `rank`, never `sortOrder`. A plan the server does not recognise has
  // rank null and is treated as not comparable, so nothing is labelled a downgrade by accident.
  const currentRank =
    configQuery.data?.plans.find((p) => p.plan === (sub?.plan ?? "FREE"))?.rank ?? null;

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
            {/*
             * Gated on stripeCustomerId, not on hasActiveSubscription. (S3P.2a)
             *
             * This rendered for ANY active subscription, provider-blind, and called
             * createPortalSession -> stripe.billingPortal.sessions.create, which throws when the
             * user has no Stripe customer. Under D19 that is EVERY Razorpay customer, so a paying
             * customer clicked "Manage" and got a toast reading "Stripe customer portal is not
             * available for this account" -- a broken control naming a provider they did not use.
             *
             * stripeCustomerId is the exact predicate the backend checks, so the button now
             * renders when and only when the call can succeed. NOT deleted outright: Stripe is
             * dormant, not removed, and the existing Stripe subscriptions still have a real portal
             * -- it is the only way those accounts can change a card.
             *
             * Razorpay has no hosted portal. The self-serve replacement is S3P.2d/e, deferred.
             */}
            {sub?.billing?.stripeCustomerId && (
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
                const isCurrent = plan.plan === sub?.plan;
                // D20: downgrade stays disabled and routed to support. This decides only WHICH
                // plans are downgrades -- which is what was broken. Unknown rank on either side
                // means "not comparable", so it is not offered as an upgrade either.
                const isDowngrade =
                  plan.rank !== null && currentRank !== null && plan.rank < currentRank;
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
                        checkoutMutation.isPending ||
                        payingRazorpay ||
                        plan.plan === "FREE"
                      }
                      onClick={() => {
                        if (isCurrent) return;
                        // A downgrade goes to a human, never to checkout: D20 keeps the mechanism
                        // unbuilt, and starting a checkout here would create a SECOND live
                        // subscription rather than replacing the first.
                        if (isDowngrade) {
                          handleDowngradeRequest(plan.plan);
                          return;
                        }
                        handleUpgradeClick(plan.plan);
                      }}
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
