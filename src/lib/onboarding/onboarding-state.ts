import type { OnboardingGoal, OnboardingRole, TemplateId } from "./templates";

/**
 * The client's view of `workspace.onboarding_state`.
 *
 * Mirrors the server's `onboardingPatchSchema` (`api/routes/workspaces.ts`) on the writable side,
 * plus the three keys the server owns and the client only reads. Ids and ISO timestamps only —
 * see `templates.ts` for why no copy is ever stored here.
 */
export type SuggestedTemplateState = {
  id: TemplateId;
  version: 1;
  /** Set by "Not now" on the Home suggestion card. Hides the card; keeps the checklist steps. */
  dismissedAt?: string;
  /**
   * Set by "Skip for now" on Set it up, and by "Not now" on the card.
   *
   * This is the one that changes the shape of Home: it drops the automation steps from the
   * checklist and stops anything suggesting an automation. It has to survive reloads and new
   * sessions, which is the whole reason it lives on the workspace and not in component state.
   */
  skippedAt?: string;
};

/** What the client may write. Anything else is rejected by the server, by design. */
export type OnboardingPatch = {
  role?: OnboardingRole | null;
  goal?: OnboardingGoal | null;
  suggestedTemplate?: SuggestedTemplateState | null;
  checklistHiddenAt?: string | null;
  completeNoteDismissedAt?: string | null;
};

/** What the client may read — the patch keys plus the three the server owns. */
export type OnboardingState = OnboardingPatch & {
  isOnboarded?: boolean;
  completedAt?: string;
  ig?: { connected?: boolean; connectedAt?: string; username?: string | null };
};

const ROLES: OnboardingRole[] = ["creator", "business", "agency"];
const GOALS: OnboardingGoal[] = ["link", "resource", "code", "prices", "unsure"];
const TEMPLATE_IDS: TemplateId[] = ["link", "resource", "code", "prices"];

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

/**
 * Parse the raw jsonb into the typed shape, discarding anything unrecognised.
 *
 * Defensive on purpose. The column is shared with the Meta callback and with the liffio.com
 * onboarding, it has held an unvalidated client record for the whole life of the product (see the
 * server's `onboardingPatchSchema` note), and it is read on the first render of the dashboard. A
 * malformed value here must render as "not answered", never throw — a workspace whose Home page
 * crashes because someone once PATCHed a bad `role` is not a recoverable state for the user.
 */
export function parseOnboardingState(raw: unknown): OnboardingState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const record = raw as Record<string, unknown>;
  const state: OnboardingState = {};

  /**
   * 🚩 `null` is preserved, and that is load-bearing — it is not the same as an absent key.
   *
   * "Skip" on screen 1 stores `role: null`; a workspace that never reached screen 1 has no `role`
   * key at all. Collapsing the two to `undefined` loses the only durable record that someone was
   * *asked* — and `useNeedsNewOnboarding` reads exactly that distinction to decide whether an
   * account still needs the new flow. Without this, skipping screen 1 and then reaching the
   * dashboard would send the user straight back into onboarding, forever.
   */
  if (record.role === null) {
    state.role = null;
  } else if (typeof record.role === "string" && ROLES.includes(record.role as OnboardingRole)) {
    state.role = record.role as OnboardingRole;
  }
  if (record.goal === null) {
    state.goal = null;
  } else if (typeof record.goal === "string" && GOALS.includes(record.goal as OnboardingGoal)) {
    state.goal = record.goal as OnboardingGoal;
  }

  const suggested = record.suggestedTemplate;
  if (suggested && typeof suggested === "object" && !Array.isArray(suggested)) {
    const candidate = suggested as Record<string, unknown>;
    if (typeof candidate.id === "string" && TEMPLATE_IDS.includes(candidate.id as TemplateId)) {
      state.suggestedTemplate = {
        id: candidate.id as TemplateId,
        version: 1,
        dismissedAt: asString(candidate.dismissedAt),
        skippedAt: asString(candidate.skippedAt),
      };
    }
  }

  state.checklistHiddenAt = asString(record.checklistHiddenAt) ?? null;
  state.completeNoteDismissedAt = asString(record.completeNoteDismissedAt) ?? null;
  state.isOnboarded = record.isOnboarded === true;
  state.completedAt = asString(record.completedAt);

  const ig = record.ig;
  if (ig && typeof ig === "object" && !Array.isArray(ig)) {
    const igRecord = ig as Record<string, unknown>;
    state.ig = {
      connected: igRecord.connected === true,
      connectedAt: asString(igRecord.connectedAt),
      username: asString(igRecord.username) ?? null,
    };
  }

  return state;
}

/**
 * Strip `undefined` so a partial patch cannot accidentally clear a key.
 *
 * `{ role: undefined }` serializes to `{}` in JSON, which is harmless — but `{ suggestedTemplate:
 * undefined, goal: "link" }` would still send `goal` alone, and a caller reading this code has to
 * be able to tell "leave it alone" (`undefined`, omitted) from "clear it" (`null`, sent). Doing
 * the strip here means every call site gets that distinction for free.
 */
export function compactPatch(patch: OnboardingPatch): OnboardingPatch {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return out as OnboardingPatch;
}

/** Has the first automation been explicitly skipped? Drives the whole "skipped" shape of Home. */
export function hasSkippedFirstAutomation(state: OnboardingState): boolean {
  return Boolean(state.suggestedTemplate?.skippedAt);
}
