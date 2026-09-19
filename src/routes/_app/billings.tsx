import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Country } from "country-state-city";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Download, ExternalLink, IndianRupee, Loader2, RefreshCw, Zap } from "lucide-react";
import { toast } from "@/lib/toast";

import { PageHeader } from "@/components/dashboard/page-header";
import { getSwitcher } from "@/lib/api/workspace-switcher-api";
import { SlotBar } from "@/components/workspace-switcher/slot-bar";
import { Building2, ShieldCheck, Lock } from "lucide-react";
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
  fetchInvoiceViewHtml,
  fetchInvoicePdf,
  requestInvoicePdf,
  saveBlob,
  invoiceFileName,
  type BillingInvoiceRow,
  getSellablePackages,
  type PackageCheckoutInput,
  getBillingConfig,
  getBillingSubscription,
  listBillingInvoices,
  getBillingProfile,
  syncBilling,
  verifyRazorpayCheckout,
  type CheckoutInput,
} from "@/lib/api/billing-api";
import {
  openRazorpaySubscriptionCheckout,
  RazorpayCheckoutCancelled,
} from "@/lib/razorpay-checkout";
import {
  cardPriceText,
  formatInrPaise,
  formatUsdCents,
  inrPaiseForInterval,
  packageGatewayAvailability,
  usdCentsForInterval,
} from "@/lib/billing/pricing";
import { useAuthState } from "@/lib/auth/auth-store";
import { useApp } from "@/state/app-context";
import { PlanLimitsPanel } from "@/components/billing/plan-limits-panel";
/**
 * 🔴 `CountryPrompt` and `PlaceOfSupplyPrompt` WERE IMPORTED HERE, AND BOTH ARE DELETED.
 * (Billing address capture)
 *
 * Country and GST state are now two fields on `/checkout/review`, collected alongside the rest of
 * the address a tax invoice needs. The dialogs interrupted an in-flight checkout, which is what
 * forced every `overrides` / `pendingPurchase` / `dispatchingRef` workaround on this page.
 */
import { isWorkspaceReady } from "@/lib/api/active-workspace";

/** Razorpay only — Stripe was removed from the product in full. */
type Gateway = "razorpay";

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
  /** A group whose cycle has run out. Its workspaces are read-only together. (U8) */
  EXPIRED: "border-destructive/30 bg-destructive/10 text-destructive",
};

function BillingPage() {
  const { current, refreshAuth } = useApp();
  const workspaceId = current.id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { status: checkoutStatus } = Route.useSearch();
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const [cancelOpen, setCancelOpen] = useState(false);
  // 🔴 `gatewayChoice` is gone with the payment-type dialog — see `handleUpgradeClick`.
  // Razorpay is the only gateway, so there was never a second thing to choose.
  const [payingRazorpay, setPayingRazorpay] = useState(false);
  /**
   * 🔴 `pendingPurchase`, `countryPromptOpen`, `statePromptOpen` and `placeOfSupplyState` ARE GONE.
   *
   * All four existed to remember which plan card was clicked while a dialog was open, and to carry
   * a just-captured value past a `setState` that had not flushed. The review page holds the
   * purchase in its own URL (`?packageId=&interval=`), so there is nothing to remember and nothing
   * to resume.
   */
  const userEmail = useAuthState((s) => s.user?.email);
  /**
   * 🔴 The customer's own currency, resolved by the SERVER. (S5.7)
   *
   * The cards used to print a hardcoded `$` with no country read anywhere in this file — so an
   * Indian customer shopped in dollars and was charged in rupees. `undefined` while the session is
   * still loading is treated as `null`: USD, which is what was shown before, rather than a flicker.
   */
  const displayCurrency = useAuthState((s) => s.user?.displayCurrency) ?? null;

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
    enabled: isWorkspaceReady(workspaceId),
  });

  /** Which row's PDF is in flight, so only that button shows a spinner. */
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const invoicesQuery = useQuery({
    queryKey: ["billing-invoices", workspaceId],
    queryFn: () => listBillingInvoices(workspaceId),
    enabled: isWorkspaceReady(workspaceId),
  });

  /**
   * The billing address every invoice is issued against.
   *
   * Shared `queryKey` with `/checkout/review`, so saving there updates this card without a
   * refetch — one cache entry for one row.
   */
  const profileQuery = useQuery({
    queryKey: ["billing-profile", workspaceId],
    queryFn: () => getBillingProfile(workspaceId),
    enabled: isWorkspaceReady(workspaceId),
  });
  const billingProfile = profileQuery.data?.profile ?? null;
  const countryName = (iso: string) => Country.getCountryByCode(iso)?.name ?? iso;

  /**
   * Open a stored invoice document. Not a plain `<a href>` — see `fetchInvoiceViewHtml`'s comment:
   * the route is bearer-token authenticated and a bare navigation never attaches that header.
   */
  /**
   * Save an invoice PDF, producing it first if it was never rendered.
   *
   * Offered when the row has stored bytes (`hasPdf`) **or** can still produce them
   * (`canRenderPdf`). Keying on `hasPdf` alone is what made this button permanently dead for any
   * invoice whose issuance-time render failed: the flag was truthful and the state had no way out,
   * so the customer saw a disabled control on their own paid invoice forever.
   *
   * Still disabled, with a reason, when neither holds. Those rows genuinely have no document and
   * cannot honestly be given one — see the route, which refuses for the same reason rather than
   * composing a tax invoice out of today's configuration.
   */
  const downloadInvoicePdf = async (inv: BillingInvoiceRow) => {
    setDownloadingId(inv.id);
    try {
      const blob = inv.hasPdf
        ? await fetchInvoicePdf(workspaceId, inv.id)
        : await requestInvoicePdf(workspaceId, inv.id);
      saveBlob(blob, invoiceFileName(inv, "pdf"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not download invoice");
    } finally {
      setDownloadingId(null);
    }
  };

  const openInvoiceView = async (hostedInvoiceUrl: string) => {
    try {
      const blob = await fetchInvoiceViewHtml(workspaceId, hostedInvoiceUrl);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      // Give the new tab time to load the object URL before revoking it — matches the download
      // pattern in admin.plugins_.signing-keys.tsx.
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error("Could not open invoice");
    }
  };

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
     * syncWorkspaceSubscription reports provider-level failures verbatim, and those strings are
     * written for an operator rather than a customer -- "no subscription found for this workspace"
     * reads as data loss to the person who just paid. The neutral message is what they can act on.
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
   *
   * On success, open the Razorpay Checkout.js MODAL — never redirect to `checkoutUrl`
   * (Razorpay's hosted `short_url`). Mirrors `startRazorpayCheckout` below exactly: this
   * used to do `window.location.href = checkoutUrl`, which sends the browser to Razorpay's
   * own page and never comes back — the client's `?status=success` handler above never runs,
   * so a paid subscription never settles locally (no `workspace_subscriptions` row, no
   * invoice, no email). `createPackageCheckout` already returns `subscriptionId` alongside
   * `checkoutUrl`; that id is all the modal needs.
   *
   * 🚩 By the time this fires, `createPackageCheckout` has already created a LIVE Razorpay
   * subscription server-side (S0.6 — nothing is written locally, but the provider object
   * exists the moment this resolves). `dispatchingRef.current` therefore stays `true` for
   * this entire async body — through the modal being open and the verify call — and is only
   * cleared in `finally`, exactly like `startRazorpayCheckout`'s own dispatch/clear pair.
   * `setPayingRazorpay` is reused (not a second flag) so `checkoutInFlight` keeps the UI
   * disabled for the whole flow, the same way it does for the legacy plan path.
   */
  /**
   * 🔴 `packageCheckoutMutation` WAS HERE, AND IT IS GONE. (Billing address capture)
   *
   * It created the Razorpay subscription and drove the Checkout.js modal straight from this page.
   * Both moved to `/checkout/review`, which now owns the entire dispatch: save the billing
   * address, create the subscription, open the modal, verify.
   *
   * 🚩 The race this mutation's comment described is structurally gone rather than better
   * guarded. Two concurrent dispatches made two live, permanent Razorpay subscription objects,
   * because `createPackageCheckout` writes nothing locally (S0.6) and has no per-workspace
   * idempotency guard. This page can no longer dispatch at all — it navigates — so there is one
   * dispatch point in the product instead of three.
   */

  const checkoutMutation = useMutation({
    mutationFn: (body: CheckoutInput) => createBillingCheckout(workspaceId, body),
    onSuccess: ({ checkoutUrl }) => {
      if (checkoutUrl) window.location.href = checkoutUrl;
    },
    onError: (e) => toast.error((e as Error).message),
  });

  /**
   * Single source of truth for "a checkout is already being dispatched, anywhere on this page."
   *
   * ⚠️ Now covers only the LEGACY PLAN PATH. The package path no longer dispatches from here — it
   * navigates to `/checkout/review`, which owns its own guard — so `packageCheckoutMutation` is
   * gone from this expression along with the mutation itself.
   *
   * The race it guarded is worth keeping in view even though this page can no longer cause it:
   * `createPackageCheckout` writes nothing locally (S0.6) and has no per-workspace idempotency
   * guard on the server, so two concurrent dispatches create two live, permanent Razorpay
   * subscription objects. That is now prevented by there being a single dispatch point in the
   * product rather than by three pages each detecting their own double-click.
   */
  const checkoutInFlight = checkoutMutation.isPending || payingRazorpay;

  /**
   * The state-based flags above only become `true` for the render *after* a dispatch starts
   * — they go through React/TanStack Query's own batching, which is not instant relative to a
   * second, independently-resolving async chain (e.g. two `onCaptured` resumes racing off two
   * separate `refreshAuth()` calls). This ref closes that last, narrow gap: it is set
   * synchronously at the two actual dispatch points below, immediately visible to any other
   * call into `proceedCheckout` no matter how it got there, and cleared in every outcome
   * (success or error) of that same dispatch so nothing is ever left permanently blocked.
   */
  const dispatchingRef = useRef(false);

  /**
   * Every gateway, always. One the backend has not enabled (or that has no price for the chosen
   * interval) renders as a disabled row with the reason, rather than vanishing — the payment-type
   * step must always show what payment methods exist.
   */
  const gatewayOptions = (
    planKey: string,
  ): { value: Gateway; available: boolean; reason?: string }[] => {
    /**
     * 🔴 Availability comes from the PACKAGE, not from `plan.checkout`.
     *
     * Those flags are built from the plan path's env SKUs (`RAZORPAY_PLAN_*`), and GROWTH has none
     * declared — so every flag was false and `handleUpgradeClick` returned early before the
     * gateway chooser could open. `startCheckout` below already prefers the package path; this is
     * what lets anyone reach it. See `@/lib/billing/pricing`.
     */
    const providers = configQuery.data?.providers;
    return packageGatewayAvailability({
      pkg: packageForPlan(planKey),
      razorpayConfigured: Boolean(providers?.razorpay.configured && providers.razorpay.keyId),
    });
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
      dispatchingRef.current = false;
    }
  };

  /**
   * Hand off to the review page, which owns the address and the payment.
   *
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
   * ⚠️ The legacy plan path (`startRazorpayCheckout`) does NOT route through the review page. It
   * has no billing-profile gate on the server either, because `POST /billing/checkout` is retired
   * and unreachable — it is kept only so a tier with no package still has somewhere to go, and it
   * will be deleted with the plan path rather than rebuilt around the new flow.
   */
  const proceedCheckout = (planKey: string, gateway: Gateway) => {
    const pkg = packageForPlan(planKey);
    if (pkg) {
      void navigate({
        to: "/checkout/review",
        search: { packageId: pkg.id, interval, from: "billings" },
      });
      return;
    }

    // Razorpay is the only gateway, so there is no branch left to take. `gateway` is kept in the
    // signature because the payment-type step still passes the user's confirmed choice through,
    // and a second gateway would reinstate the branch rather than the parameter.
    void gateway;
    dispatchingRef.current = true;
    void startRazorpayCheckout(planKey);
  };

  const startCheckout = (planKey: string, gateway: Gateway) => {
    /**
     * ⚠️ No country guard here any more. (Billing address capture)
     *
     * It used to open `CountryPrompt` when `displayCurrency` was null, because
     * `createPackageCheckout` refuses with `CHECKOUT_COUNTRY_REQUIRED`. The review page asks for
     * country as a required field of the address, so a buyer with no country on file simply fills
     * it in there — and the price they see on the way is the one the server resolves from it.
     */
    proceedCheckout(planKey, gateway);
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

  /**
   * 🔴 The payment-type step is GONE. It picked between gateways that no longer exist.
   *
   * It opened a dialog to choose "how you want to pay" — a holdover from Stripe-vs-Razorpay.
   * Stripe was removed from the product in full (`plan/stripe-removal.md`), so the dialog
   * had exactly one option and asked the buyer to confirm a choice they did not have.
   *
   * ⚠️ It was never a card-vs-UPI chooser, which is the thing it looked like. Razorpay's own
   * modal picks the instrument, and it does it better — it knows which methods are actually
   * enabled on the account. This step sat in front of that asking a question with one answer.
   *
   * The availability check survives, because it answers something real: a package with no
   * published price cannot be bought, and saying so beats opening a checkout that fails.
   */
  const handleUpgradeClick = (planKey: string) => {
    const options = gatewayOptions(planKey);
    if (!options.some((o) => o.available)) {
      toast.error("This plan is not available for online checkout yet.");
      return;
    }
    startCheckout(planKey, "razorpay");
  };

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
  /**
   * May THIS person download these documents? (U4, spec 2.7)
   *
   * The server's verdict, sent with the list. Defaulted to true while the list is still loading so
   * the buttons do not flicker through a disabled state on every page load; nothing can be
   * downloaded before the list arrives anyway, and the endpoint refuses regardless.
   */
  const canDownloadInvoices = invoicesQuery.data?.canDownload ?? true;

  /**
   * The agency this workspace belongs to, if any, and whether the viewer owns it. (U4, spec 2.4)
   *
   * Read from the switcher payload rather than a new endpoint: it already resolves the group, the
   * slot counts an owner may see, the renew date, and the viewer flag, all through the one access
   * resolver. A second endpoint answering the same question is a second answer.
   */
  const switcherQuery = useQuery({
    queryKey: ["workspace-switcher"],
    queryFn: getSwitcher,
    enabled: isWorkspaceReady(workspaceId),
  });
  const group =
    switcherQuery.data?.groups.find((g) => g.workspaces.some((w) => w.id === workspaceId)) ?? null;
  const isOwner = group
    ? group.isOwner
    : (switcherQuery.data?.workspaces.find((w) => w.id === workspaceId)?.isOwner ?? true);
  const groupRenews = group?.renewsAt
    ? new Date(group.renewsAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })
    : null;
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
          // Owner only, and the server refuses it for anybody else regardless. (T4, spec 2.7)
          isOwner ? (
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
            </div>
          ) : null
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
                  {/*
                   * 🔴 A grouped workspace names the GROUP's plan, not its own. (spec 2.4.10, U8)
                   *
                   * `sub` is this workspace's own `workspace_subscriptions` row, and a workspace
                   * inside an agency has none: it is the group that is subscribed. Falling back to
                   * "Free" put the word Free at the top of the Billing page of a workspace on a
                   * paid Agency plan, directly under a card that says the agency renews next month.
                   * The group's own label is already in hand from the switcher payload.
                   */}
                  <h2 className="font-display text-2xl font-bold">
                    {group ? group.planLabel : (sub?.displayName ?? "Free")}
                  </h2>
                  {group ? (
                    <Badge
                      variant="outline"
                      className={group.readOnly ? (statusStyles.EXPIRED ?? "") : (statusStyles.ACTIVE ?? "")}
                    >
                      {group.readOnly ? "expired" : "active"}
                    </Badge>
                  ) : (
                    sub?.billingStatus && (
                      <Badge variant="outline" className={statusStyles[sub.billingStatus] ?? ""}>
                        {sub.billingStatus.toLowerCase().replace(/_/g, " ")}
                      </Badge>
                    )
                  )}
                </div>
              )}
              {/*
                An agency is ONE plan on ONE cycle, so a grouped workspace says whose plan it is
                and that the date covers all of them, instead of quietly showing a renewal that
                looks like this workspace's own. (U4, spec 2.4)
              */}
              {group ? (
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 aria-hidden className="size-3.5" />
                    {group.name}
                  </span>
                  {groupRenews ? (
                    <span className="inline-flex items-center gap-1.5">
                      <RefreshCw aria-hidden className="size-3.5" />
                      Renews {groupRenews} for all workspaces in the group
                    </span>
                  ) : null}
                  {isOwner && group.slotsUsed !== null && group.slotLimit !== null ? (
                    <span>
                      {group.slotsUsed} of {group.slotLimit} workspaces used
                    </span>
                  ) : null}
                </div>
              ) : sub?.billingCycleEnd ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {sub.cancelAtPeriodEnd ? "Cancels" : "Renews"}{" "}
                  {new Date(sub.billingCycleEnd).toLocaleDateString()}
                </p>
              ) : null}
            </div>
            {/* Billing actions are the owner's. A member sees the plan read-only. (spec 2.7) */}
            {isOwner && sub?.hasActiveSubscription && (
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

          {group && isOwner && group.slotsUsed !== null && group.slotLimit !== null ? (
            <SlotBar used={group.slotsUsed} limit={group.slotLimit} size="lg" className="mt-4" />
          ) : null}

          {group || !isOwner ? (
            <div className="mt-3 flex items-center gap-2 text-[12.5px] text-muted-foreground">
              <ShieldCheck aria-hidden className="size-3.5 shrink-0" />
              {isOwner
                ? "One plan and one invoice cover every workspace in this group."
                : "Only the owner can change billing."}
            </div>
          ) : null}
        </div>

        {/*
          The EFFECTIVE limits, read from the server's own resolver.

          The plan cards below advertise what a tier is sold with. Enforcement folds
          `package_limits` and any workspace-level override on top, so the two can disagree — and
          when they did, the customer was shown one number and refused at another. This panel is
          the authoritative one; the cards stay list capabilities.
        */}
        <PlanLimitsPanel workspaceId={workspaceId} />

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
                  {/*
                   * 🔴 "save ~20%" OVERSTATED the discount. MEASURED against live production
                   * prices: the yearly price is EXACTLY ten months' price on every tier in USD
                   * (9→90, 29→290, 59→590, 549→5490 — ratio 10.00), which is a 16.7% saving, not 20%.
                   * INR is the same shape at 10.00–10.02 (16.5–16.7%).
                   *
                   * "2 months free" is preferred over "save 17%" because it is exactly true rather
                   * than rounded, and it survives a price change as long as the 10× ratio holds —
                   * a percentage goes stale the moment any tier is repriced.
                   *
                   * ⚠️ It is exact in USD and 1.98 months in INR (₹4,999 against ten months at
                   * ₹4,990 — nine rupees). Immaterial, and it does not overstate the way 20% did.
                   *
                   * ✅ This also brings the app into line with the marketing page, which already
                   * says "SAVE 17%" — the two were contradicting each other.
                   */}
                  {iv === "yearly" ? "Yearly (2 months free)" : "Monthly"}
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
                // Authored INR lives on the package, which this page already fetches. Never converted.
                const priceText = cardPriceText({
                  displayCurrency,
                  pkg: packageForPlan(plan.plan),
                  planUsd: price,
                  interval,
                });
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
                      <span className="font-display text-3xl font-bold">{priceText}</span>
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
                      disabled={isCurrent || checkoutInFlight || plan.plan === "FREE"}
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

        {/* Billing details — the address every invoice is issued against. */}
        <div className="rounded-2xl border bg-card shadow-soft">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h2 className="font-display text-lg font-semibold">Billing details</h2>
            {billingProfile && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/checkout/review" search={{ interval, from: "billings" }}>
                  Edit
                </Link>
              </Button>
            )}
          </div>
          <div className="p-6 text-sm">
            {profileQuery.isLoading ? (
              <Skeleton className="h-16 rounded-lg" />
            ) : billingProfile ? (
              <div className="space-y-1">
                {billingProfile.address && (
                  <p className="whitespace-pre-line text-muted-foreground">
                    {billingProfile.address}
                  </p>
                )}
                <p className="text-muted-foreground">
                  {billingProfile.state} {billingProfile.postalCode}
                </p>
                <p className="text-muted-foreground">{countryName(billingProfile.country)}</p>
              </div>
            ) : (
              /*
               * No profile yet is the normal pre-purchase state, not an error — checkout collects
               * it. No "add now" link: the form needs a plan to price, and `/checkout/review`
               * without a `packageId` has nothing to show.
               */
              <p className="text-muted-foreground">
                You will add these when you subscribe. They appear on every invoice.
              </p>
            )}
          </div>
        </div>

        {/* Invoices */}
        <div className="rounded-2xl border bg-card shadow-soft">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-6 py-4">
            <h2 className="font-display text-lg font-semibold">Invoice history</h2>
            {/*
              Says whose invoices these are. A grouped workspace lists the GROUP's, and they appear
              identically on every workspace in it, so without this the customer sees the same
              invoice in several places and cannot tell why. (U4, spec 2.4)
            */}
            <span className="text-[12.5px] text-muted-foreground">
              {group ? `Shared by all workspaces in ${group.name}` : "For this workspace"}
            </span>
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
                    <th className="px-4 py-3 font-medium">Invoice</th>
                    <th className="px-4 py-3 font-medium">Plan</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Download</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-6 py-3 text-muted-foreground">
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        {inv.hostedInvoiceUrl && inv.invoiceNumber ? (
                          <button
                            type="button"
                            onClick={() => void openInvoiceView(inv.hostedInvoiceUrl!)}
                            className="inline-flex items-center gap-1 border-0 bg-transparent p-0 font-mono text-xs text-primary hover:underline"
                          >
                            {inv.invoiceNumber} <ExternalLink className="h-3 w-3" />
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
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
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={
                            !canDownloadInvoices ||
                            (!inv.hasPdf && !inv.canRenderPdf) ||
                            downloadingId === inv.id
                          }
                          onClick={() => void downloadInvoicePdf(inv)}
                          title={
                            !canDownloadInvoices
                              ? "Invoice downloads are turned off for you. Ask the owner if you need them."
                              : inv.hasPdf
                              ? "Download this invoice as a PDF"
                              : inv.canRenderPdf
                                ? "Prepare this invoice as a PDF and download it"
                                : inv.hasDocument
                                  ? "This invoice was issued before PDF support. Use View to open it."
                                  : "This payment was not issued as an invoice, so there is no document"
                          }
                        >
                          {downloadingId === inv.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                          <span className="ml-1.5">PDF</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/*
            The reason, under the table it applies to. (U4, spec 2.7)
            Only when there is something to be refused: an empty list with a lock note would be
            telling somebody they cannot have documents that do not exist.
          */}
          {!canDownloadInvoices && invoices.length > 0 ? (
            <div className="flex items-center gap-2 border-t px-6 py-3 text-[12.5px] text-muted-foreground">
              <Lock aria-hidden className="size-3.5 shrink-0" />
              Invoice downloads are turned off for you. Ask the owner if you need them.
            </div>
          ) : null}
        </div>
      </div>

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
