import { describe, it, expect } from "vitest";
import {
  PACKAGE_STEP_UP_FIELDS,
  buildPackagePatch,
  packagePatchNeedsStepUp,
  type PackagePatchValues,
} from "./package-step-up";

/**
 * The console had no way to supply `confirmCode`, so every guarded package write failed with
 * "Confirmation code required" and no prompt. Prompting is the easy half; prompting *only when the
 * server will ask* is the half worth pinning, because the server decides by key presence on the
 * raw body and the console decides from form state — two different questions that have to agree.
 *
 * ⚠️ These assert behaviour, not that the new code exists: every case below is a body the console
 * would actually post, checked against the rule in `adminRegistry.ts`
 * (`TOTP_REQUIRED_PATCH_FIELDS.some((f) => f in body)`, evaluated BEFORE the zod parse).
 *
 * The field list is transcribed from the server. `mirrors the server's field list` is the test
 * that fails when the two drift, which is the failure mode with no other detector — a stale list
 * shows up in production as either a missing prompt or an unprompted 400.
 */

const saved: PackagePatchValues = {
  name: "Growth",
  description: "For teams shipping weekly.",
  monthlyPriceUsdCents: 4900,
  monthlyPriceInrPaise: 399900,
  badge: null,
  isPublic: true,
  isActive: true,
};

const edit = (over: Partial<PackagePatchValues>): PackagePatchValues => ({ ...saved, ...over });

describe("buildPackagePatch", () => {
  it("emits nothing when nothing changed", () => {
    expect(buildPackagePatch(saved, edit({}))).toEqual({});
  });

  it("emits only the changed key, not the whole form", () => {
    expect(buildPackagePatch(saved, edit({ name: "Growth Pro" }))).toEqual({ name: "Growth Pro" });
  });

  it("keeps a null-valued change (clearing the badge is a change to null, not a no-op)", () => {
    const patch = buildPackagePatch(edit({ badge: "Most popular" }), edit({ badge: null }));
    expect(patch).toEqual({ badge: null });
    expect("badge" in patch).toBe(true);
  });

  it("emits several keys when several changed", () => {
    expect(buildPackagePatch(saved, edit({ name: "Scale", monthlyPriceUsdCents: 9900 }))).toEqual({
      name: "Scale",
      monthlyPriceUsdCents: 9900,
    });
  });
});

describe("packagePatchNeedsStepUp", () => {
  it("does not prompt for a name-only edit", () => {
    expect(packagePatchNeedsStepUp(buildPackagePatch(saved, edit({ name: "Growth Pro" })))).toBe(
      false,
    );
  });

  it("does not prompt for a description or badge edit", () => {
    const patch = buildPackagePatch(saved, edit({ description: "Rewritten.", badge: "New" }));
    expect(packagePatchNeedsStepUp(patch)).toBe(false);
  });

  it("does not prompt for an empty patch", () => {
    expect(packagePatchNeedsStepUp({})).toBe(false);
  });

  it.each([
    ["a USD price change", { monthlyPriceUsdCents: 9900 }],
    ["an INR price change", { monthlyPriceInrPaise: 799900 }],
    ["deactivating", { isActive: false }],
    ["going private", { isPublic: false }],
  ] as const)("prompts for %s", (_label, over) => {
    expect(packagePatchNeedsStepUp(buildPackagePatch(saved, edit(over)))).toBe(true);
  });

  it("prompts when a structural change rides along with a cosmetic one", () => {
    const patch = buildPackagePatch(saved, edit({ name: "Scale", isPublic: false }));
    expect(patch).toEqual({ name: "Scale", isPublic: false });
    expect(packagePatchNeedsStepUp(patch)).toBe(true);
  });

  it("prompts on key presence even when the value is unchanged, as the server does", () => {
    // Not something buildPackagePatch can emit — this pins the rule itself, because a caller that
    // hand-rolls a body (the list page's Active toggle) is subject to it.
    expect(packagePatchNeedsStepUp({ isActive: true })).toBe(true);
  });

  it("treats an undefined value as absent, because JSON.stringify drops the key", () => {
    // The server sees `{}` for this body, so it will not ask for a code; prompting anyway would
    // demand a code for a request that does not need one.
    expect(packagePatchNeedsStepUp({ isActive: undefined })).toBe(false);
  });

  it("mirrors the server's field list", () => {
    // Transcribed from TOTP_REQUIRED_PATCH_FIELDS in Backend src/api/routes/adminRegistry.ts.
    expect([...PACKAGE_STEP_UP_FIELDS]).toEqual([
      "monthlyPriceUsdCents",
      "monthlyPriceInrPaise",
      "yearlyPriceUsdCents",
      "yearlyPriceInrPaise",
      "isActive",
      "isPublic",
      "sortOrder",
    ]);
  });
});
