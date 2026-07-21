import { usePermissions } from "@/hooks/use-auth";

/**
 * Feature-level capability checks.
 *
 * Feature permissions share the same `module:action` key space as CRUD permissions and arrive in
 * the same `permissions` array on the session, so this reads from exactly one source of truth —
 * the backend. The UI never decides what a user may do; it only renders the answer it was given,
 * and the API denies independently regardless of what is on screen.
 *
 * Keys must match `server/src/config/featurePermissions.ts`.
 */

export const AUTOMATION_FEATURE_KEYS = [
  "keywords",
  "excluded_keywords",
  "any_comment",
  "trigger_blocks",
  "block_auto_reply",
  "block_dm_message",
  "block_button",
  "post_scope_specific",
  "post_scope_any",
  "post_scope_next",
  "public_auto_reply",
  "reply_variants",
  "dm_button",
  "dm_button_tracking",
  "follow_before_dm",
] as const;

export type AutomationFeatureKey = (typeof AUTOMATION_FEATURE_KEYS)[number];

export type AutomationFeatures = Record<AutomationFeatureKey, boolean>;

/**
 * Every automation feature flag for the current user in the current workspace.
 *
 * Returned as one object rather than a hook-per-feature so a component can destructure what it
 * needs without violating the rules of hooks when the set of checks varies by branch.
 */
export function useAutomationFeatures(): AutomationFeatures {
  const permissions = usePermissions();
  const held = new Set(permissions);
  return AUTOMATION_FEATURE_KEYS.reduce((acc, key) => {
    acc[key] = held.has(`automation:${key}`);
    return acc;
  }, {} as AutomationFeatures);
}

/** Single feature check, for components that only need one. */
export function useFeature(moduleKey: string, feature: string): boolean {
  const permissions = usePermissions();
  return permissions.includes(`${moduleKey}:${feature}`);
}
