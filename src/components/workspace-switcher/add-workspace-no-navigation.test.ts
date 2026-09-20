import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * FX7, as it stands after R2. Buying a workspace must never write to an existing one.
 *
 * ## What changed, and why these assertions moved rather than went
 *
 * FX7's defect was a literal `window.location.assign("/billings")` in the sheet's pay handler, so
 * the original test asserted three things about **the sheet**: that it never navigates, that it has
 * its own address step, and that it buys through the checkout-intent endpoint.
 *
 * R2 deliberately reverses two of those. The sheet no longer owns a payment UI at all: the address
 * step, the paying screen, the failure screen and the success card were deleted, and the purchase
 * now happens on `/checkout/review`, which already had the discount code box, the order summary and
 * the address form. So "the sheet has an address step" and "the sheet calls
 * `startWorkspaceCheckout`" are now assertions about a design that was replaced on purpose.
 *
 * **The rule underneath them did not change**, and neither did this file's job: a purchase must
 * never target an existing workspace. So every assertion is kept and pointed at whichever file now
 * owns the behaviour. The sheet is still checked for the things it must never do, and the checkout
 * route is now checked for the things it must do.
 *
 * ## What this test is, and what it is not
 *
 * A source-level assertion, which is normally the weak kind: a test that merely asserts new code
 * exists passes against the old code too. These do not. Each one fails against the code as it was
 * before the change it guards.
 *
 * It is a source scan rather than a rendered-component test because this repo has no React test
 * harness. The rendered behaviour is proved by the screenshot pairs in
 * `workspace-plans-v4/ui-actual/`, and the database-level rule by
 * `Backend/src/services/billing/paidCreateLeavesExistingAlone.integration.test.ts`, which is the
 * stronger proof: it compares every subscription row before and after a real purchase.
 *
 * See `liffio-workspace/workspace-plans-v2/fx7-findings.md` for the original trace.
 */

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/** Comments describe the bug on purpose, so they must not count as the bug. */
const strip = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");

const sheetSource = read("./add-workspace-dialog.tsx");
const sheet = strip(sheetSource);

const routeSource = read("../../routes/checkout_.review.tsx");
const route = strip(routeSource);

describe("the Add workspace sheet never bills an existing workspace", () => {
  it("contains no full-page navigation at all", () => {
    // The literal defect FX7 was written for. Still forbidden.
    expect(sheet).not.toMatch(/window\.location/);
  });

  it("never sends the buyer to the billing page", () => {
    expect(sheet).not.toMatch(/["'`]\/billings/);
  });

  /**
   * The sheet MAY now navigate, to exactly one place: the checkout route, carrying the new
   * workspace's name. That is R2. It is pinned rather than left open, because "the sheet may
   * navigate" without saying where is how `/billings` would creep back.
   */
  it("navigates only to the checkout route, and only with a new workspace name", () => {
    expect(sheet).toMatch(/to:\s*["']\/checkout\/review["']/);
    expect(sheet).toMatch(/newWorkspace:\s*trimmed/);

    const destinations = [...sheet.matchAll(/to:\s*["']([^"']+)["']/g)].map((m) => m[1]);
    expect(destinations).toEqual(["/checkout/review"]);
  });

  it("never dispatches a checkout for an existing workspace", () => {
    // The two calls that change an EXISTING workspace's subscription.
    expect(sheet).not.toMatch(/createBillingCheckout\s*\(/);
    expect(sheet).not.toMatch(/createPackageCheckout\s*\(/);
  });

  it("never writes the address onto an existing workspace's profile", () => {
    expect(sheet).not.toMatch(/saveBillingProfile\s*\(/);
  });

  /**
   * The sheet reads no billing profile at all any more. (R2)
   *
   * It used to fetch one to decide whether to show its own address step. That step is gone, so the
   * prefill moved to the checkout route, where the form that uses it lives. Asserted as an absence
   * here and as a presence on the route below, so the responsibility cannot end up in both places
   * or in neither.
   */
  it("reads no billing profile, because the form that needs one is not here", () => {
    expect(sheet).not.toMatch(/getBillingProfile\s*\(/);
  });

  /** The payment UI is gone. If any of it comes back, two copies exist again. (R2) */
  it("no longer owns a payment flow", () => {
    expect(sheet).not.toMatch(/startWorkspaceCheckout\s*\(/);
    expect(sheet).not.toMatch(/verifyWorkspaceCheckout\s*\(/);
    expect(sheet).not.toMatch(/openRazorpaySubscriptionCheckout\s*\(/);
    expect(sheet).not.toMatch(/step === ["'](?:address|paying|failed|done)["']/);
  });
});

describe("the checkout route buys a NEW workspace without touching the current one", () => {
  it("buys through the checkout-intent endpoint", () => {
    expect(route).toMatch(/startWorkspaceCheckout\(/);
    expect(route).toMatch(/verifyWorkspaceCheckout\(/);
  });

  it("prefills the address from the buyer's saved profile", () => {
    // R6's prefill, now on the surface that owns the form.
    expect(route).toMatch(/getBillingProfile\(/);
    expect(route).toMatch(/prefill/);
  });

  it("collects the address with the shared form rather than a second one", () => {
    expect(route).toMatch(/BillingAddressForm/);
    expect(routeSource).toMatch(/from ["']@\/components\/billing\/billing-address-form["']/);
  });

  /**
   * 🔴 The heart of HARD RULE 5 at the client boundary.
   *
   * `saveBillingProfile` and `createPackageCheckout` are both workspace-scoped, and both still
   * exist on this page for the UPGRADE path, which is legitimate. What must never happen is either
   * of them running on the new-workspace branch, so the branch is read in isolation and checked to
   * contain neither.
   */
  it("never writes to the current workspace on the new-workspace branch", () => {
    const branchStart = route.indexOf("if (buyingNewWorkspace) {");
    expect(branchStart, "the new-workspace branch must exist").toBeGreaterThan(-1);
    const branch = route.slice(branchStart, route.indexOf("\n      }", branchStart));

    expect(branch).not.toMatch(/saveBillingProfile\s*\(/);
    expect(branch).not.toMatch(/createPackageCheckout\s*\(/);
    expect(branch).not.toMatch(/verifyRazorpayCheckout\s*\(/);

    /**
     * And it must not name the workspace the buyer is standing in.
     *
     * `settled.workspaceId` is the NEW workspace, read off the settled intent, and is exactly what
     * this branch is supposed to end with. It is removed before the check so that anything left is
     * a reference to the component's own `workspaceId`, which is the current one.
     */
    const withoutTheNewOne = branch.replace(/settled\.workspaceId/g, "");
    expect(withoutTheNewOne).not.toMatch(/\bworkspaceId\b/);
  });

  it("switches workspace only after the intent has settled", () => {
    // `landInNewWorkspace` takes the id off the SETTLED intent, never off the search params.
    expect(route).toMatch(/landInNewWorkspace\(settled\.workspaceId,\s*settled\.groupId\)/);
  });

  it("carries the intent id in the route, as R2 requires", () => {
    expect(route).toMatch(/intentId:\s*started\.intentId/);
  });

  it("applies the discount code to the new workspace's purchase", () => {
    expect(route).toMatch(/discountCode:\s*appliedCode\s*\|\|\s*undefined/);
  });
});
