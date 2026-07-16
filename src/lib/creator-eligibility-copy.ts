/**
 * Human-readable copy for the Creator Eligibility System, sourced from
 * ENDPOINT-CONTRACT.md §2.3 / liffio-creator-eligibility-frontend.md §1.3 —
 * one canonical mapping shared by the creator-facing UI (Phase 5) and the
 * admin dashboard (Phase 4), per that section's "one canonical source, not
 * duplicated copy in two places" instruction.
 */

export type NotEligibleReason =
  | "InstagramNotConnected"
  | "PrivateAccount"
  | "PersonalAccount"
  | "InsufficientContent"
  | "InactiveAccount";

export type NeedsAttentionReason =
  | "DmShortfall"
  | "InsufficientActiveAutomations"
  | "InstagramDisconnected"
  | "PersonalAccount"
  | "PrivateAccount"
  | "MetricsUnavailable";

export type PendingReviewReason =
  | "LowEngagementConfidence"
  | "BorderlineScore"
  | "ManualFlagged"
  | "ProgramCapReached";

export type RejectedReason = "EligibilityChanged" | "ScoreBelowThreshold" | "ManualRejected";

export type AnyReason =
  | NotEligibleReason
  | NeedsAttentionReason
  | PendingReviewReason
  | RejectedReason
  | string;

/** Short plain-language label for a reason code — used everywhere a reason is displayed. */
export const REASON_LABEL: Record<string, string> = {
  InstagramNotConnected: "Instagram not connected",
  InstagramDisconnected: "Instagram disconnected",
  PrivateAccount: "Instagram account is private",
  PersonalAccount: "Instagram account is a personal account",
  InsufficientContent: "Not enough posts yet",
  InactiveAccount: "No recent posting activity",
  DmShortfall: "Below monthly DM minimum",
  InsufficientActiveAutomations: "Not enough active automations",
  MetricsUnavailable: "Metrics temporarily unavailable",
  LowEngagementConfidence: "Engagement needs a closer look",
  BorderlineScore: "Borderline eligibility score",
  ManualFlagged: "Flagged for manual review",
  ProgramCapReached: "Program at capacity — waitlisted",
  EligibilityChanged: "Eligibility changed since applying",
  ScoreBelowThreshold: "Below our current bar",
  ManualRejected: "Rejected by review",
};

/** What the creator should do to resolve a reason — ENDPOINT-CONTRACT.md §2.3. */
export const RESOLUTION_COPY: Record<string, string> = {
  InstagramNotConnected: "Reconnect your Instagram account.",
  InstagramDisconnected: "Reconnect your Instagram account.",
  PrivateAccount: "Switch your Instagram account to public.",
  PersonalAccount: "Switch your Instagram account to a Business or Creator account.",
  InsufficientContent: "Post more content to reach the minimum post count.",
  InactiveAccount: "Resume regular posting activity.",
  DmShortfall: "Increase automated DM volume to meet the monthly minimum.",
  InsufficientActiveAutomations: "Activate more automation campaigns.",
  MetricsUnavailable:
    "No action needed — we retry automatically. If this persists, contact support.",
  ProgramCapReached:
    "No action needed — you're on the waitlist and will be approved automatically as capacity frees up.",
};

export function reasonLabel(reason: string | null | undefined): string {
  if (!reason) return "—";
  return REASON_LABEL[reason] ?? reason;
}

export function resolutionCopy(reason: string | null | undefined): string | null {
  if (!reason) return null;
  return RESOLUTION_COPY[reason] ?? null;
}
