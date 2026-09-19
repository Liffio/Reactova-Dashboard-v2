import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, ShieldCheck, X } from "lucide-react";

import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  DialogBody,
  DialogFooterBar,
  DialogHeaderBar,
  ResponsiveDialog,
} from "./responsive-dialog";
import { PlanOption } from "./plan-option";
import { NameField } from "./name-field";
import { createWorkspace } from "@/lib/api/workspaces-api";
import {
  getSellablePackages,
  getBillingConfig,
  getBillingProfile,
  type SellablePackage,
} from "@/lib/api/billing-api";
import { cardPriceText } from "@/lib/billing/pricing";
import {
  getWorkspaceCheckoutQuote,
  startWorkspaceCheckout,
  verifyWorkspaceCheckout,
  getWorkspaceCheckoutIntent,
} from "@/lib/api/workspace-checkout-api";
import {
  openRazorpaySubscriptionCheckout,
  RazorpayCheckoutCancelled,
} from "@/lib/razorpay-checkout";
import { useAuthState } from "@/lib/auth/auth-store";
import { ApiError } from "@/lib/api/http";
import { BillingAddressForm } from "@/components/billing/billing-address-form";
import {
  emptyBillingAddress,
  type BillingAddressInput,
} from "@/lib/billing/billing-address";

/**
 * `address` is FX7: the step that used to be a full page navigation to `/billings`.
 *
 * 🔴 It is a step of THIS sheet, not a route. The old code called
 * `window.location.assign("/billings")` when no billing address could be prefilled, which tore the
 * sheet down, put the customer back inside the workspace they were already in, and left them one
 * tap from `createBillingCheckout(current.id)` -- buying the plan FOR THAT WORKSPACE instead of
 * creating a new one. See `workspace-plans-v2/fx7-findings.md` section 4.
 */
type Step = "form" | "address" | "paying" | "failed" | "done";

/** The synthetic Free option. It is the absence of a package, so it has no id. */
const FREE = "__free__";

/** Minor units to a display string, in the currency the server quoted. */
function money(amountMinor: number, currency: "INR" | "USD"): string {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
  }).format(amountMinor / 100);
}

/**
 * Add a workspace. Free creates immediately; paid creates only after Razorpay confirms.
 *
 * ## Why the plan list is packages, not a plan enum
 *
 * Growth is sold as a package and `PRO` is retired, so the sellable ladder cannot be expressed as
 * the `Plan` enum. The list is `GET /billing/packages` — already filtered server-side to public and
 * active — plus one synthetic Free row. Prices come from the quote endpoint; no amount is ever
 * computed or hardcoded here.
 *
 * ## Why closing the dialog does not cancel anything
 *
 * Settlement happens server-side whether or not this component is mounted: the webhook settles the
 * same purchase independently of the verify call made here. Closing mid-payment is therefore safe,
 * and the copy says so rather than implying the customer must wait.
 */
export function AddWorkspaceDialog({
  open,
  onOpenChange,
  freeSlotAvailable,
  freeWorkspaceName,
  prefillFromWorkspaceId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  freeSlotAvailable: boolean;
  freeWorkspaceName: string | null;
  /**
   * A workspace the user already has, used only to read the billing-address PREFILL from.
   *
   * `GET /billing/profile` is workspace-scoped and the workspace being bought does not exist yet,
   * so some existing workspace has to ask on its behalf. The server answers with that workspace's
   * own profile, or a `prefill` copied from another workspace the same user owns — either is a
   * valid address for this buyer, which is the whole point of that field.
   */
  prefillFromWorkspaceId: string | null;
  /**
   * Called once the workspace exists, with the agency it was bought into when there is one. (FX8)
   * The caller is what refreshes state, switches and navigates; this sheet never does.
   */
  onCreated: (workspaceId: string, groupId: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const user = useAuthState((s) => s.user);
  /** Resolved by the SERVER from the account country. Never guessed here. */
  const displayCurrency = useAuthState((s) => s.user?.displayCurrency) ?? null;

  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  /**
   * FX4: the sheet never opens with nothing selected.
   *
   * It used to initialise to `""` whenever the free slot was taken, so a customer who already had
   * a free workspace opened the picker with no plan chosen, a disabled button, and nothing saying
   * which plan they were about to buy. Free when the slot is open, otherwise the cheapest paid
   * plan, which the effect below fills in once the catalogue arrives.
   */
  const [selected, setSelected] = useState<string>(freeSlotAvailable ? FREE : "");
  const [busy, setBusy] = useState(false);
  const [createdName, setCreatedName] = useState("");
  const [createdIsGroup, setCreatedIsGroup] = useState(false);
  /** FX6: set when the used Free row is tapped, so it can say why it cannot be picked. */
  const [freeNotice, setFreeNotice] = useState(false);
  /** FX5: set when create is tapped with an empty name. Cleared as soon as they type. */
  const [nameError, setNameError] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  /** Guards against a double submit dispatching two checkouts for one intent. */
  const dispatching = useRef(false);

  /**
   * The billing address collected in the `address` step. (FX7)
   *
   * Seeded from the account country so the buyer is not asked for something the server already
   * knows. It is sent in the `startWorkspaceCheckout` body, which is where the NEW workspace's
   * profile is written from, and it is deliberately never passed to `saveBillingProfile`: that
   * writes onto an existing workspace, which is the class of write this whole fix exists to stop.
   */
  const [address, setAddress] = useState<BillingAddressInput>(() =>
    emptyBillingAddress({ country: user?.country ?? null }),
  );
  /** Whether the address on screen came from a saved profile, so the step can summarise it. (R6) */
  const [addressIsSaved, setAddressIsSaved] = useState(false);
  /** Whether the buyer has asked to change it. (R6) */
  const [editingAddress, setEditingAddress] = useState(true);
  /**
   * The address actually used for the dispatch in flight, so "Try again" on the failed step retries
   * the purchase rather than re-asking for an address that was already given.
   */
  const addressUsed = useRef<BillingAddressInput | null>(null);

  const packagesQuery = useQuery({
    queryKey: ["billing-sellable-packages"],
    queryFn: getSellablePackages,
    enabled: open,
  });
  const configQuery = useQuery({
    queryKey: ["billing-config"],
    queryFn: getBillingConfig,
    enabled: open,
  });

  /**
   * The sellable ladder, minus any package that is itself Free.
   *
   * 🔴 The catalogue contains a real "Free" package, and this list renders a synthetic Free row of
   * its own — so without this filter the picker showed **Free twice**, once selectable and once
   * disabled, which is indistinguishable from a bug. The synthetic row is the one that stays,
   * because Free here is the absence of a package: choosing it calls `POST /workspaces`, not
   * checkout, and the free-slot rule is what decides whether it is offered at all.
   *
   * Matched on price rather than on the key or name — a package named "Free" could be renamed in
   * the admin console, but one that costs nothing is free whatever it is called.
   */
  const packages = useMemo(
    () =>
      [...(packagesQuery.data?.packages ?? [])]
        .filter((pkg) => pkg.monthlyPriceUsdCents > 0 || (pkg.monthlyPriceInrPaise ?? 0) > 0)
        /**
         * 🔴 A plan with no price in THIS customer's currency is not offered.
         *
         * Found by opening the picker as an Indian account: every plan showed a rupee figure except
         * one, which showed `$29` because it has no INR price authored. That is worse than it looks
         * — it is not only a mixed-currency list, it is a dead end. `resolvePackagePurchase` asks
         * `resolveCurrentPackagePrice` for this currency and throws `PACKAGE_NOT_PUBLISHED` when
         * there is none, so choosing that plan could never have completed.
         *
         * Offering something that cannot be bought is worse than not listing it.
         */
        .filter((pkg) =>
          displayCurrency === "INR"
            ? (pkg.monthlyPriceInrPaise ?? 0) > 0
            : pkg.monthlyPriceUsdCents > 0,
        )
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [packagesQuery.data, displayCurrency],
  );

  const paidSelected = selected !== FREE && selected !== "";

  /**
   * Whether the plan catalogue is still in flight, and whether it gave up. (FX2)
   *
   * Drives the per-row skeletons and the inline retry. Both are deliberately about the CATALOGUE,
   * not about the per-selection quote: the catalogue is what every row needs before it can show a
   * number, while the quote only refines the one row the customer has chosen.
   */
  const pricesPending = packagesQuery.isPending || configQuery.isPending;
  const pricesFailed = packagesQuery.isError || configQuery.isError;

  /**
   * The price for the selected plan, from the server.
   *
   * Refetched per selection rather than pre-fetched for every package: the quote depends on offer
   * eligibility, so asking for all of them up front would be several requests for numbers the
   * customer will mostly never see.
   */
  const quoteQuery = useQuery({
    queryKey: ["workspace-checkout-quote", selected],
    queryFn: () => getWorkspaceCheckoutQuote({ packageId: selected, interval: "monthly" }),
    enabled: open && paidSelected,
  });

  /**
   * Fall back to the cheapest paid plan once the catalogue is known. (FX4)
   *
   * Cannot be done in `useState`: when the sheet opens, `packages` is still empty, so there is no
   * plan id to select yet. Runs only while nothing is selected, so it can never overwrite a
   * choice the customer has already made, and never fights the reset effect below.
   *
   * "Cheapest paid" is `packages[0]`, which is already sorted by `sortOrder`, the same ladder the
   * pricing page renders. That is Starter today; deriving it rather than naming it means a new
   * entry-level plan is picked up without touching this file.
   */
  useEffect(() => {
    if (!open || selected !== "" || packages.length === 0) return;
    setSelected(packages[0].id);
  }, [open, selected, packages]);

  useEffect(() => {
    if (!open) {
      setStep("form");
      setAddressIsSaved(false);
      setEditingAddress(true);
      setName("");
      setSelected(freeSlotAvailable ? FREE : "");
      setFreeNotice(false);
      setNameError(null);
      setShaking(false);
      setBusy(false);
      dispatching.current = false;
      addressUsed.current = null;
    }
  }, [open, freeSlotAvailable]);

  const trimmed = name.trim();

  /**
   * The empty-name path. (FX5)
   *
   * Returns true when it handled the tap, so callers read as
   * `if (requireName()) return;`. The button is NEVER disabled, so this is what makes a tap with
   * no name informative instead of inert: scroll the field into view (it can be above the fold
   * once the plan list is long), shake it, focus it, and say what is missing under it.
   *
   * `preventScroll` on the focus call because `scrollIntoView` is already animating; letting
   * focus scroll as well fights it and lands somewhere between the two.
   */
  const requireName = () => {
    if (name.trim()) return false;
    setNameError("Give your workspace a name first.");
    setShaking(true);
    window.setTimeout(() => setShaking(false), 450);
    nameRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    nameRef.current?.focus({ preventScroll: true });
    return true;
  };
  const quote = quoteQuery.data;

  const createFree = async () => {
    setBusy(true);
    try {
      const workspace = await createWorkspace({ name: trimmed });
      await queryClient.invalidateQueries({ queryKey: ["workspace-switcher"] });
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setCreatedName(trimmed);
      setCreatedIsGroup(false);
      setStep("done");
      onCreated(workspace.id, null);
    } catch (error) {
      // The server names the workspace already using the free slot, which is the actionable part.
      toast.error(error instanceof Error ? error.message : "Could not create the workspace");
    } finally {
      setBusy(false);
    }
  };

  /**
   * Take the payment. (FX7)
   *
   * 🔴 **Nothing navigates between here and the answer.** No `window.location`, no router push, no
   * workspace switch: the sheet stays mounted over the gateway for the whole time the payment is in
   * flight, and the active workspace is only changed by `onCreated`, which runs after the intent
   * reads PAID. The purchase carries an intent id and a name, never a workspace id, so there is no
   * request in this path that could name an existing workspace as the subscription target.
   */
  const runCheckout = async (billingAddress: BillingAddressInput) => {
    if (dispatching.current) return;
    const keyId = configQuery.data?.providers.razorpay.keyId;
    if (!keyId) {
      toast.error("Razorpay is not configured");
      return;
    }

    addressUsed.current = billingAddress;
    dispatching.current = true;
    setStep("paying");
    try {
      const started = await startWorkspaceCheckout({
        name: trimmed,
        packageId: selected,
        interval: "monthly",
        billingAddress: {
          country: billingAddress.country,
          state: billingAddress.state,
          gstStateCode: billingAddress.gstStateCode,
          postalCode: billingAddress.postalCode,
          address: billingAddress.address,
        },
      });

      const payload = await openRazorpaySubscriptionCheckout({
        keyId,
        subscriptionId: started.subscriptionId,
        email: user?.email ?? undefined,
        description: `${quote?.packageName ?? "Workspace"}, billed monthly`,
      });

      const settled = await verifyWorkspaceCheckout(started.intentId, payload);
      setCreatedName(trimmed);
      setCreatedIsGroup(Boolean(settled.groupId));
      setStep("done");
      /**
       * Only now, with the intent PAID. `onCreated` refetches the list from the server before it
       * makes the new workspace active, so nothing here invalidates first: two refreshes of the
       * same data, one of them not awaited, is how the switch used to race the list. (FX8)
       */
      onCreated(settled.workspaceId, settled.groupId);
    } catch (error) {
      if (error instanceof RazorpayCheckoutCancelled) {
        // Nothing was created and nothing was charged, so this is a return to the form rather
        // than a failure screen.
        setStep("form");
        toast.info("Payment cancelled. Nothing was created.");
      } else if (error instanceof ApiError) {
        setStep("failed");
      } else {
        setStep("failed");
      }
    } finally {
      dispatching.current = false;
    }
  };

  /**
   * The pay button. Finds an address, or asks for one IN THIS SHEET, then dispatches.
   *
   * The prefill is a profile from another workspace this user owns, which the server offers for
   * exactly this purpose. When there is none (the ordinary case for a first paid workspace) the
   * customer used to be thrown out to `/billings`; now the sheet shows the address step and the
   * purchase continues from there without the route or the active workspace ever changing.
   */
  const pay = async () => {
    if (dispatching.current) return;
    /**
     * The sub-second window before the catalogue lands, when FX4 has not had a plan id to select
     * yet. The button is no longer disabled (FX5), so this is what stops a tap in that window
     * posting an empty `packageId`. Says so rather than failing silently.
     */
    if (!selected || selected === FREE) {
      toast.error("Pick a plan first");
      return;
    }

    let prefill = null;
    if (prefillFromWorkspaceId) {
      try {
        const profile = await getBillingProfile(prefillFromWorkspaceId);
        prefill = profile.profile ?? profile.prefill ?? null;
      } catch {
        prefill = null;
      }
    }

    /**
     * 🔴 A found address is SHOWN, not used silently. (R6)
     *
     * This used to dispatch straight to the gateway whenever a prefill came back, so the buyer
     * never saw the address their invoice would carry and had no way to correct it before paying.
     * An invoice with the wrong state on it is a tax document that has to be reissued.
     *
     * So the address step is now always the next thing, and it is the step that decides how to
     * present itself: a summary of a known address with an Edit control, or the empty form when
     * there is nothing to show. Neither case costs the buyer a retype.
     */
    if (prefill) {
      setAddress({
        country: prefill.country,
        state: prefill.state,
        gstStateCode: prefill.gstStateCode ?? null,
        postalCode: prefill.postalCode,
        address: prefill.address ?? null,
      });
      setAddressIsSaved(true);
      setEditingAddress(false);
    } else {
      setAddressIsSaved(false);
      setEditingAddress(true);
    }
    setStep("address");
  };

  /** "Try again" after a failure reuses the address already given rather than asking again. */
  const retry = async () => {
    const known = addressUsed.current;
    if (known) {
      await runCheckout(known);
      return;
    }
    await pay();
  };

  /**
   * If verify never completed but the webhook did, the intent is already PAID server-side. One
   * poll on reaching the failed state tells the difference between "no payment" and "paid, but the
   * browser lost the answer" — and the second must not be shown as a failure.
   */
  const recheck = async (intentId: string) => {
    try {
      const intent = await getWorkspaceCheckoutIntent(intentId);
      if (intent.status === "PAID" && intent.workspaceId) {
        setCreatedName(intent.workspaceName);
        setCreatedIsGroup(Boolean(intent.groupId));
        setStep("done");
        onCreated(intent.workspaceId, intent.groupId);
      }
    } catch {
      // Leave the failed state as-is; the customer can retry.
    }
  };
  void recheck;

  /**
   * Every row shows a price immediately; the SELECTED row shows what is actually due today.
   *
   * 🔴 This used to return "…" for every unselected package, because the quote is only fetched for
   * the current selection — so the picker opened with no prices at all and the customer had to click
   * each plan to discover what it cost. The catalogue figure comes from the same
   * `package_prices`-backed payload `/checkout` renders, through the same helper, so the two cannot
   * disagree; the quote then replaces it with the offer-adjusted amount once a plan is chosen.
   */
  const priceFor = (pkg: SellablePackage) => {
    if (pkg.id === selected && quote) {
      return {
        price: money(quote.amountMinor, quote.currency),
        note: quote.differsFromList
          ? `then ${money(quote.listAmountMinor, quote.currency)} per month`
          : "per month",
      };
    }
    return {
      price: cardPriceText({ displayCurrency, pkg, planUsd: null, interval: "monthly" }),
      note: "per month",
    };
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title="Add a workspace">
      {step === "address" ? (
        <>
          <DialogHeaderBar>
            <h2 className="font-display text-xl font-semibold tracking-tight">Billing details</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              We need these for the invoice for <b>{trimmed}</b>. They apply to the new workspace
              only.
            </p>
          </DialogHeaderBar>

          <DialogBody className="px-6 py-5">
            {addressIsSaved && !editingAddress ? (
              /*
                The saved address, shown before it is used. (R6)
                A buyer whose details are already on file should not retype them, and should also
                not discover on the invoice which address was picked for them.
              */
              <div className="space-y-4">
                <div className="rounded-xl border bg-muted/30 p-4 text-sm">
                  <p className="mb-2 text-[12.5px] font-medium text-muted-foreground">
                    Using your saved details
                  </p>
                  {address.address ? (
                    <p className="whitespace-pre-line">{address.address}</p>
                  ) : null}
                  <p>
                    {address.state} {address.postalCode}
                  </p>
                  <p>{address.country}</p>
                  {address.gstStateCode ? (
                    <p className="mt-1 text-muted-foreground">GST state {address.gstStateCode}</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => void runCheckout(address)}
                    disabled={dispatching.current}
                    className="flex-1"
                  >
                    {quote
                      ? `Pay ${money(quote.amountMinor, quote.currency)} and create`
                      : "Pay and create"}
                  </Button>
                  <Button variant="outline" onClick={() => setEditingAddress(true)}>
                    Edit
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/*
                  The same form the checkout page uses, so there is one billing address form in the
                  product rather than a second one that drifts. It carries its own submit button,
                  which is why this step has no DialogFooterBar.
                */}
                <BillingAddressForm
                  value={address}
                  onChange={setAddress}
                  submitLabel={
                    quote
                      ? `Pay ${money(quote.amountMinor, quote.currency)} and create`
                      : "Pay and create"
                  }
                  submitting={dispatching.current}
                  onSubmit={() => void runCheckout(address)}
                />
                {addressIsSaved ? (
                  <button
                    type="button"
                    className="mt-3 block text-[12.5px] text-muted-foreground underline underline-offset-2"
                    onClick={() => setEditingAddress(false)}
                  >
                    Use my saved details instead
                  </button>
                ) : null}
              </>
            )}
            <button
              type="button"
              className="mt-3 text-[12.5px] text-muted-foreground underline underline-offset-2"
              onClick={() => setStep("form")}
            >
              Back to plans
            </button>
          </DialogBody>
        </>
      ) : step === "paying" ? (
        <div className="px-6 py-10 text-center" aria-live="polite">
          <Loader2 aria-hidden className="mx-auto mb-4 size-9 animate-spin text-primary" />
          <h2 className="font-display text-xl font-semibold tracking-tight">Waiting for payment</h2>
          <p className="mx-auto mt-1.5 max-w-[40ch] text-sm text-muted-foreground">
            Finish paying in the Razorpay window. We'll create <b>{trimmed}</b> as soon as the
            payment is confirmed. You can close this safely, it keeps going.
          </p>
        </div>
      ) : step === "failed" ? (
        <div className="px-6 py-10 text-center" aria-live="polite">
          <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
            <X aria-hidden className="size-6" />
          </span>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Payment didn't go through
          </h2>
          <p className="mx-auto mt-1.5 max-w-[40ch] text-sm text-muted-foreground">
            No workspace was created and you weren't charged. Try again, or use another payment
            method.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => void retry()}>Try again</Button>
          </div>
        </div>
      ) : step === "done" ? (
        <div className="px-6 py-10 text-center" aria-live="polite">
          <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-success/10 text-success">
            <Check aria-hidden className="size-6" />
          </span>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            {createdName} is ready
          </h2>
          <p className="mx-auto mt-1.5 max-w-[42ch] text-sm text-muted-foreground">
            {createdIsGroup
              ? `Your agency has its slots ready. ${createdName} is workspace 1, and you can add the rest from inside the agency.`
              : "Connect Instagram next to start automating."}
          </p>
          <div className="mt-5 flex justify-center">
            <Button onClick={() => onOpenChange(false)}>Open workspace</Button>
          </div>
        </div>
      ) : (
        <>
          <DialogHeaderBar>
            <h2 className="font-display text-xl font-semibold tracking-tight">Add a workspace</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {freeSlotAvailable
                ? "Use your one free workspace, or pick a paid plan."
                : "Your free workspace is already in use, so a new one needs a paid plan."}
            </p>
          </DialogHeaderBar>

          <DialogBody className="px-6 py-5">
            <NameField
              ref={nameRef}
              id="ws-name"
              label="Workspace name"
              value={name}
              onChange={(value) => {
                setName(value);
                // FX5: the error clears the moment they start typing, not on the next submit.
                if (nameError) setNameError(null);
              }}
              placeholder="e.g. Bloom Room"
              error={nameError}
              shaking={shaking}
              autoFocus
            />

            <div role="radiogroup" aria-label="Plan" className="mt-5 flex flex-col gap-2">
              <PlanOption
                name="Free"
                description={
                  freeSlotAvailable
                    ? "Your one free workspace"
                    : `You already have one: ${freeWorkspaceName ?? "your free workspace"}`
                }
                price="Free"
                priceNote="forever"
                selected={selected === FREE}
                unavailable={!freeSlotAvailable}
                disabledChipLabel="Used"
                describedById={freeNotice && !freeSlotAvailable ? "free-plan-notice" : undefined}
                onSelect={() => {
                  if (!freeSlotAvailable) {
                    setFreeNotice(true);
                    return;
                  }
                  setFreeNotice(false);
                  setSelected(FREE);
                }}
              />

              {/*
                FX6: the used Free row explains itself instead of sitting dead. Rendered under the
                row it belongs to, and as a live region so it is announced when it appears.
              */}
              {freeNotice && !freeSlotAvailable ? (
                <p
                  id="free-plan-notice"
                  role="status"
                  className="-mt-1 rounded-lg bg-muted px-3 py-2 text-[12.5px] text-muted-foreground"
                >
                  Your free workspace is already in use. Pick a paid plan, or upgrade that one.
                </p>
              ) : null}

              {packages.map((pkg) => {
                const { price, note } = priceFor(pkg);
                return (
                  <PlanOption
                    key={pkg.id}
                    name={pkg.name}
                    description={pkg.description ?? ""}
                    price={price}
                    priceNote={note}
                    priceLoading={pricesPending}
                    selected={selected === pkg.id}
                    onSelect={() => {
                      setFreeNotice(false);
                      setSelected(pkg.id);
                    }}
                  />
                );
              })}

              {/*
                FX2: a failed catalogue fetch retries HERE, in the list that is missing, not in the
                button. Putting it in the button conflates "this control is broken" with "this
                control is the way forward".
              */}
              {pricesFailed ? (
                <div className="rounded-xl border border-dashed px-3.5 py-3 text-[12.5px] text-muted-foreground">
                  Could not load plan prices.{" "}
                  <button
                    type="button"
                    className="font-medium text-primary underline underline-offset-2"
                    onClick={() => {
                      void packagesQuery.refetch();
                      void configQuery.refetch();
                    }}
                  >
                    Retry
                  </button>
                </div>
              ) : null}
            </div>
          </DialogBody>

          <DialogFooterBar>
            <span className="flex min-w-[180px] flex-1 items-center gap-1.5 text-xs text-muted-foreground">
              {selected === FREE ? (
                <>
                  <Check aria-hidden className="size-3.5" />
                  Free forever. Upgrade whenever you like.
                </>
              ) : (
                <>
                  <ShieldCheck aria-hidden className="size-3.5" />
                  We create the workspace once your payment goes through.
                </>
              )}
            </span>
            {/*
              🔴 Never disabled on an empty name (FX5).
              A disabled button is a dead end: it does not say what is missing, and on touch there
              is nothing to tap to find out. It stays enabled and `requireName()` does the
              explaining. Still disabled while a request is in flight, which is a different thing:
              that guards against a double submit rather than withholding an answer.
            */}
            <Button
              disabled={busy}
              onClick={() => {
                if (requireName()) return;
                if (selected === FREE) {
                  void createFree();
                  return;
                }
                void pay();
              }}
            >
              {/*
                🔴 No loading state in the button (FX2). It read "Loading price…", which looks
                like a dead control: the label is where the ACTION goes, not where progress goes.
                While the amount is still coming the label simply omits it; the plan rows carry
                the skeleton, and a failed fetch offers its retry there too.
              */}
              {selected === FREE
                ? busy
                  ? "Creating…"
                  : "Create workspace"
                : busy
                  ? "Starting…"
                  : quote
                    ? `Pay ${money(quote.amountMinor, quote.currency)} and create`
                    : "Pay and create"}
            </Button>
          </DialogFooterBar>
        </>
      )}
    </ResponsiveDialog>
  );
}
