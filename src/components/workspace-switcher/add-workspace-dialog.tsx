import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
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
/**
 * Only the QUOTE is still imported from the checkout client. (R2)
 *
 * `startWorkspaceCheckout`, `verifyWorkspaceCheckout`, `getWorkspaceCheckoutIntent`,
 * `openRazorpaySubscriptionCheckout` and `RazorpayCheckoutCancelled` all went with the payment UI.
 * The sheet prices plans; `/checkout/review` takes the money.
 */
import { getWorkspaceCheckoutQuote } from "@/lib/api/workspace-checkout-api";
import { useAuthState } from "@/lib/auth/auth-store";

/**
 * `address` is FX7: the step that used to be a full page navigation to `/billings`.
 *
 * 🔴 It is a step of THIS sheet, not a route. The old code called
 * `window.location.assign("/billings")` when no billing address could be prefilled, which tore the
 * sheet down, put the customer back inside the workspace they were already in, and left them one
 * tap from `createBillingCheckout(current.id)` -- buying the plan FOR THAT WORKSPACE instead of
 * creating a new one. See `workspace-plans-v2/fx7-findings.md` section 4.
 */
/**
 * One screen. (R2)
 *
 * It was `"form" | "address" | "paying" | "failed" | "done"`, a five-state payment machine living
 * beside the one on `/checkout/review`. The other four moved there with the rest of the payment UI.
 */
type Step = "form";

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
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  freeSlotAvailable: boolean;
  freeWorkspaceName: string | null;
  /**
   * Called once the workspace exists, with the agency it was bought into when there is one. (FX8)
   * The caller is what refreshes state, switches and navigates; this sheet never does.
   */
  onCreated: (workspaceId: string, groupId: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
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
  /** FX6: set when the used Free row is tapped, so it can say why it cannot be picked. */
  const [freeNotice, setFreeNotice] = useState(false);
  /** FX5: set when create is tapped with an empty name. Cleared as soon as they type. */
  const [nameError, setNameError] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  /** Guards against a double submit dispatching two checkouts for one intent. */
  const dispatching = useRef(false);

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
      setName("");
      setSelected(freeSlotAvailable ? FREE : "");
      setFreeNotice(false);
      setNameError(null);
      setShaking(false);
      setBusy(false);
      dispatching.current = false;
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
      /**
       * Straight into the new workspace. (R2)
       *
       * There was a "done" card here with an Open workspace button. It went with the rest of the
       * sheet's payment UI: `onCreated` lands the buyer IN the workspace they just made, so the
       * card was a step between them and it.
       */
      onOpenChange(false);
      onCreated(workspace.id, null);
    } catch (error) {
      // The server names the workspace already using the free slot, which is the actionable part.
      toast.error(error instanceof Error ? error.message : "Could not create the workspace");
    } finally {
      setBusy(false);
    }
  };

  /**
   * 🔴 A paid workspace is bought on the CHECKOUT ROUTE, not in this sheet. (R2)
   *
   * This sheet used to own a second, parallel payment UI: an address step, a "Waiting for payment"
   * screen, a "Payment didn't go through" screen with a retry, and a success card. All four are
   * gone, and so is the `runCheckout` that drove them. What replaced them is `/checkout/review`,
   * which already had the discount code box, the order summary and the address form with its
   * prefill, and which is the page every other purchase in the product already goes through.
   *
   * Two copies of a payment flow is how they drift. The sheet's copy never grew discount codes and
   * the route's copy never learned to buy a workspace that does not exist yet. One had to go, and
   * it was the one with fewer features.
   *
   * What travels is the NAME and the plan. No workspace id, because there is no workspace yet, and
   * naming the current one is precisely what HARD RULE 5 exists to prevent.
   */
  const goToCheckout = () => {
    if (requireName()) return;
    if (!selected || selected === FREE) {
      toast.error("Pick a plan first");
      return;
    }
    onOpenChange(false);
    void navigate({
      to: "/checkout/review",
      search: {
        packageId: selected,
        interval: "monthly" as const,
        from: "switcher" as const,
        newWorkspace: trimmed,
      },
    });
  };

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
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add a workspace"
      /**
       * 🔴 Not modal while the gateway is up. (R5)
       *
       * `paying` is set immediately before `openRazorpaySubscriptionCheckout` and cleared in every
       * branch of its `catch`, so it spans exactly the window in which Razorpay owns the screen.
       *
       * A modal sheet sets `pointer-events: none` on `body` and paints a `fixed inset-0 z-50`
       * overlay. Razorpay's checkout is appended to `body` by third-party script, outside this
       * React portal, so it inherited the dead pointer events and was painted over. The gateway was
       * fully visible and completely unclickable. The sheet stays MOUNTED throughout either way,
       * which is what FX7 and FX8 depend on.
       */
      /**
       * Always modal now. (R2)
       *
       * R5 made this conditional because the gateway opened OVER this sheet. It no longer opens
       * from here at all: it opens on `/checkout/review`, which is a page, not a dialog. The prop
       * stays on `ResponsiveDialog`, where R5's fix lives.
       */
      modal
    >
      <>
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
                goToCheckout();
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
      </>
    </ResponsiveDialog>
  );
}
