import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * FX7. Buying a workspace must not navigate, and must not write to an existing workspace.
 *
 * ## What this test is, and what it is not
 *
 * It is a source-level assertion, which is normally the weak kind: a test that merely asserts new
 * code exists passes against the old code too. **This one does not.** The defect was a literal
 * `window.location.assign("/billings")` in this file's pay handler, so "this file contains no
 * navigation call" fails against the old code and passes against the new. That is the same
 * old-versus-new discrimination a behavioural test would give.
 *
 * It is a source scan rather than a rendered-component test because this repo has no React test
 * harness (no `@testing-library/react`, no DOM environment), and adding one is a new dependency,
 * which the run that produced this file was not allowed to introduce. The rendered behaviour is
 * proved instead by the screenshot pairs fx5 (gateway opening over the sheet, workspace unchanged),
 * fx6 (the address step) and fx7 (landing in the NEW workspace).
 *
 * See `liffio-workspace/workspace-plans-v2/fx7-findings.md` for the full trace of what the old path
 * did and why zero checkout intents were ever written on production.
 */

const source = readFileSync(
  fileURLToPath(new URL("./add-workspace-dialog.tsx", import.meta.url)),
  "utf8",
);

/** Comments describe the bug on purpose, so they must not count as the bug. */
const code = source
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .filter((line) => !line.trim().startsWith("//"))
  .join("\n");

describe("the Add workspace sheet never navigates while a purchase is in flight", () => {
  it("contains no full-page navigation at all", () => {
    expect(code).not.toMatch(/window\.location/);
  });

  it("contains no router navigation at all", () => {
    expect(code).not.toMatch(/\buseNavigate\b/);
    expect(code).not.toMatch(/\bnavigate\s*\(/);
    expect(code).not.toMatch(/\bredirect\s*\(/);
  });

  it("never sends the buyer to the billing page", () => {
    // The exact destination of the defect. Named literally so the test reads as what it prevents.
    expect(code).not.toMatch(/["'`]\/billings/);
  });
});

describe("the sheet asks for a billing address instead of leaving", () => {
  it("has an address step", () => {
    expect(code).toMatch(/setStep\(["']address["']\)/);
    expect(code).toMatch(/step === ["']address["']/);
  });

  it("collects it with the shared billing address form rather than a second one", () => {
    expect(code).toMatch(/BillingAddressForm/);
    expect(source).toMatch(/from ["']@\/components\/billing\/billing-address-form["']/);
  });
});

describe("the purchase targets a new workspace only", () => {
  it("buys through the checkout-intent endpoint", () => {
    expect(code).toMatch(/startWorkspaceCheckout\(/);
    expect(code).toMatch(/verifyWorkspaceCheckout\(/);
  });

  it("never dispatches a checkout for an existing workspace", () => {
    // These are the two calls that change an EXISTING workspace's subscription.
    expect(code).not.toMatch(/createBillingCheckout\s*\(/);
    expect(code).not.toMatch(/createPackageCheckout\s*\(/);
  });

  it("never writes the address onto an existing workspace's profile", () => {
    // `saveBillingProfile(workspaceId, address)` is workspace-scoped. The new workspace's profile
    // is written server-side from the intent instead.
    expect(code).not.toMatch(/saveBillingProfile\s*\(/);
  });

  it("reads the prefill workspace only to PREFILL, never to bill it", () => {
    // `getBillingProfile` is a read, and it is the only thing the existing workspace is used for.
    expect(code).toMatch(/getBillingProfile\(prefillFromWorkspaceId\)/);
  });
});
