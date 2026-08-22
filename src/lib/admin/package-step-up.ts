/**
 * Which package writes need a six-digit authenticator code, and what to send.
 *
 * S0.11 put `requireTotpConfirm` on five admin package routes. Four of them are unconditional —
 * `PUT /features`, `PUT /limits`, `POST /publish`, `POST /apply-live`. The fifth,
 * `PATCH /admin/packages/:id`, steps up only when the body touches a *structural* field, and it
 * decides that by **key presence** on the raw body, before its zod parse:
 *
 *     const touchesGuarded = TOTP_REQUIRED_PATCH_FIELDS.some((f) => f in body);
 *     if (touchesGuarded && !(await verifyTotpConfirm(req, res))) return;
 *
 * Two consequences drive everything in this file.
 *
 * 1. **`in`, not "changed".** Sending `isActive` at its current value still trips the guard. The
 *    console's save used to post a fixed body — name, description, both prices, badge, isPublic,
 *    isActive — on every details edit, so renaming a package would have demanded a code. That is
 *    the failure the guard is meant to prevent: a prompt on a typo fix teaches operators to type
 *    codes reflexively, and a reflex is not a second factor. `buildPackagePatch` therefore emits
 *    only the keys whose value actually differs, which makes "did the operator change something
 *    structural?" and "will the server ask for a code?" the same question.
 *
 * 2. **The list must match the server's, exactly.** `PACKAGE_STEP_UP_FIELDS` is a transcription of
 *    `TOTP_REQUIRED_PATCH_FIELDS` in `src/api/routes/adminRegistry.ts`. Fall behind it and the
 *    console either prompts for nothing or posts a body the server rejects with no prompt shown.
 *    The yearly price keys are here even though no console field writes them yet — the server
 *    guards them, so a future field gets the prompt for free instead of a 400.
 *
 * Kept free of React and of `@/lib/api/*` imports so it stays unit-testable under the repo's
 * node-environment vitest setup (see `vitest.config.ts` — no jsdom, `src/**\/*.test.ts` only).
 */

/**
 * The server's `TOTP_REQUIRED_PATCH_FIELDS`, verbatim.
 *
 * Prices are obvious. `isActive`, `isPublic` and `sortOrder` are here because they are structural:
 * they change what customers can buy, which package is sellable, and the ladder order. `name`,
 * `description` and `badge` are deliberately absent.
 */
export const PACKAGE_STEP_UP_FIELDS = [
  "monthlyPriceUsdCents",
  "monthlyPriceInrPaise",
  "yearlyPriceUsdCents",
  "yearlyPriceInrPaise",
  "isActive",
  "isPublic",
  "sortOrder",
] as const;

/** The details half of the package form, normalised to what `PATCH /admin/packages/:id` accepts. */
export type PackagePatchValues = {
  name: string;
  description: string | null;
  monthlyPriceUsdCents: number;
  monthlyPriceInrPaise: number | null;
  badge: string | null;
  isPublic: boolean;
  isActive: boolean;
};

export type PackagePatch = Partial<PackagePatchValues>;

/**
 * The minimal PATCH body: every key whose value differs from what is saved, and nothing else.
 *
 * Returns `{}` when nothing changed — the caller should skip the request entirely rather than
 * post an empty patch.
 */
export function buildPackagePatch(
  saved: PackagePatchValues,
  next: PackagePatchValues,
): PackagePatch {
  const patch: PackagePatch = {};
  for (const key of Object.keys(next) as Array<keyof PackagePatchValues>) {
    if (next[key] !== saved[key]) {
      // Each branch is assigning the same key on both sides; TS can't narrow that across a
      // generic key, so the union is widened once here rather than per-field.
      (patch as Record<string, unknown>)[key] = next[key];
    }
  }
  return patch;
}

/**
 * Would the server demand a code for this PATCH body?
 *
 * Mirrors `TOTP_REQUIRED_PATCH_FIELDS.some((f) => f in body)` — **key presence, not a value
 * comparison**. Ask this of the body you are about to send, never of the form state.
 *
 * The one deliberate divergence: a key whose value is `undefined` is treated as absent, because
 * `JSON.stringify` drops it and the server therefore never sees the key. Reading it as present
 * here would open a dialog for a code the server is not going to ask for, and the save would
 * succeed with a code nobody needed to type.
 */
export function packagePatchNeedsStepUp(body: object): boolean {
  return packageStepUpFieldsIn(body).length > 0;
}

/**
 * The structural fields this body carries, in the server's order.
 *
 * `packagePatchNeedsStepUp` is this, asked as a yes/no. The list itself is what lets the dialog
 * name *what* needs the code — "Monthly price (USD), Active" rather than a bare demand for one.
 * Naming it is the difference between a prompt that explains the rule and a prompt that trains
 * the reflex the guard exists to prevent.
 */
export function packageStepUpFieldsIn(
  body: object,
): Array<(typeof PACKAGE_STEP_UP_FIELDS)[number]> {
  return PACKAGE_STEP_UP_FIELDS.filter(
    (field) => field in body && (body as Record<string, unknown>)[field] !== undefined,
  );
}

/** Field-name → what the console calls it, for the dialog's "this needs a code because…" list. */
export const PACKAGE_STEP_UP_FIELD_LABELS: Record<(typeof PACKAGE_STEP_UP_FIELDS)[number], string> =
  {
    monthlyPriceUsdCents: "Monthly price (USD)",
    monthlyPriceInrPaise: "Monthly price (INR)",
    yearlyPriceUsdCents: "Yearly price (USD)",
    yearlyPriceInrPaise: "Yearly price (INR)",
    isActive: "Active",
    isPublic: "Show on the public pricing page",
    sortOrder: "Ladder position",
  };
