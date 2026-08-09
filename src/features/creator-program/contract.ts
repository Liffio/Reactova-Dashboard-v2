/**
 * Creator Program — shared contract types (v1).
 *
 * Copy this file verbatim into both repos:
 *   reactova-api  → src/api/routes/creatorEligibility.contract.ts
 *   Client-v2     → src/features/creator-program/contract.ts
 *
 * Backend owns it. Frontend never edits it. Keep the two copies byte-identical —
 * a diff between them is a bug, and a `diff` in CI is the cheapest way to catch it.
 */

export type CreatorState =
  | "none"
  | "NotEligible"
  | "Eligible"
  | "Active"
  | "NeedsAttention"
  | "Paused";

export type IgAccountType = "Business" | "Creator" | "Personal";

/** Mirrors NeedsAttentionReason + NotEligibleReason in src/entities/enums.ts. */
export type PrimaryReason =
  | "InstagramDisconnected"
  | "PersonalAccount"
  | "PrivateAccount"
  | "MetricsUnavailable"
  | "DmShortfall"
  | "InsufficientActiveAutomations"
  | "InstagramNotConnected"
  | "InsufficientContent"
  | "InactiveAccount";

/**
 * 1 = connection-breaking, render a takeover (the numbers below would be stale).
 * 2 = usage shortfall, render a banner and keep the numbers (they're real).
 * Source of truth is CONDITION_PRIORITY in CreatorHealthService.ts — never
 * re-derive this map on the client.
 */
export type ConditionPriority = 1 | 2;

/**
 * Fixed order. This is the render order; do not re-sort on the client.
 *
 * PublicAccount is deliberately absent: Instagram does not allow a Business or
 * Creator account to be private, so it can never fail independently of
 * ProfessionalAccount. Showing both would spend a checklist row on a condition
 * the row above already guarantees. The server still evaluates it and
 * CreatorScoreV1 still short-circuits on it — defensive, and costs nothing —
 * it simply isn't a row the creator is asked to read.
 */
export type CheckKey =
  | "InstagramConnected"
  | "ProfessionalAccount"
  | "MinPosts"
  | "RecentPost";

export interface EligibilityCheck {
  key: CheckKey;
  passed: boolean;
  /** MinPosts: post count. RecentPost: days since last post. Others: null. */
  current: number | null;
  /** MinPosts: min_posts. RecentPost: max_days_since_last_post. Others: null. */
  required: number | null;
}

export interface CreatorAccount {
  handle: string | null;
  profilePictureUrl: string | null;
  accountType: IgAccountType;
  isConnected: boolean;
  followerCount: number | null;
  postCount: number | null;
  /**
   * Percentage points, e.g. 4.2. Null whenever insightsAvailable is false —
   * which is the DEFAULT today, since instagram_business_manage_insights is
   * still pending review. Render the null case, don't treat it as exceptional.
   */
  engagementRate: number | null;
  insightsAvailable: boolean;
}

export interface CreatorPeriod {
  /** ISO. Month boundary at 00:00 UTC — presents as 5:30 AM IST. */
  start: string;
  /** ISO, exclusive. */
  end: string;
  daysLeft: number;
}

export interface CreatorProgress {
  dmCount: number;
  dmTarget: number;
  automationCount: number;
  automationTarget: number;
}

export type ApplicationState = "Submitted" | "PendingReview" | "Approved" | "Rejected";

export interface LatestApplication {
  id: string;
  state: ApplicationState;
  submittedAt: string;
  /** True when PendingReview because ProgramCapReached — drives the Waitlisted frame. */
  isWaitlisted: boolean;
}

export type TimelineEventType =
  | "Joined"
  | "RequirementsMet"
  | "HealthRestored"
  | "InstagramSynced"
  | "Paused"
  | "Reactivated";

export interface TimelineEvent {
  type: TimelineEventType;
  at: string;
}

/**
 * GET /api/creator/v1/status
 *
 * Inapplicable fields are null, never absent — so the client destructures once
 * instead of branching on presence.
 */
export interface CreatorStatusResponse {
  state: CreatorState;
  /** Last *successful* sync. A failed attempt does not advance this. */
  syncedAt: string | null;
  account: CreatorAccount | null;
  /** Active and NeedsAttention only. */
  period: CreatorPeriod | null;
  /** Active and NeedsAttention only. */
  progress: CreatorProgress | null;
  joinedAt: string | null;
  primaryReason: PrimaryReason | null;
  primaryPriority: ConditionPriority | null;
  secondaryReasons: PrimaryReason[];
  /** NotEligible and Eligible only. */
  checks: EligibilityCheck[] | null;
  cooldown: { active: boolean; reapplyAt: string | null } | null;
  latestApplication: LatestApplication | null;
  /** Max 4, newest first, allowlisted types only. */
  timeline: TimelineEvent[];
}

/** GET /api/creator/v1/thresholds */
export interface CreatorThresholdsResponse {
  minMonthlyDms: number;
  minActiveAutomations: number;
  minPosts: number;
  maxDaysSinceLastPost: number;
  cooldownDays: number;
  /** The "capped at 50" figure. Remaining spots are never exposed to creators. */
  maxActiveCreators: number;
}

/** POST /api/creator/v1/apply */
export type CreatorApplyResponse =
  | { outcome: "decided"; applicationId: string; decision: string }
  | { outcome: "blocked_by_cooldown"; reapplyAt: string }
  | { outcome: "rejected_eligibility_changed"; applicationId: string; reason: "EligibilityChanged" }
  /**
   * No creator profile for this user, which — since profile creation is 1:1 with
   * Instagram connect — means no Instagram account has ever been connected.
   * Previously a 400 carrying a raw internal message; render "connect Instagram
   * first" rather than a generic failure.
   */
  | { outcome: "instagram_not_connected" }
  /**
   * The pre-scoring Instagram sync produced no metrics, and none were stored
   * from a previous sync — typically a transient Meta failure on a creator who
   * has never synced. Nothing was written and no application exists, so this is
   * safe and expected to retry: render a "try again in a moment" affordance, not
   * a permanent failure or a rejection.
   */
  | { outcome: "metrics_unavailable" };

/** The frame the page renders. Derived client-side; see deriveFrame below. */
export type CreatorFrame =
  | "Active"
  | "AttentionBanner"
  | "AttentionTakeover"
  | "MetricsUnavailable"
  | "NotEligible"
  | "Waitlisted"
  | "InReview"
  | "Rejected"
  | "Offer"
  | "Paused"
  | "Loading"
  | "Error";

/**
 * Single place the state→frame mapping lives. Both the page and its tests import
 * this; nothing else is allowed to branch on `state` directly.
 */
export function deriveFrame(s: CreatorStatusResponse): CreatorFrame {
  switch (s.state) {
    case "Active":
      return "Active";
    case "NeedsAttention":
      if (s.primaryReason === "MetricsUnavailable") return "MetricsUnavailable";
      return s.primaryPriority === 1 ? "AttentionTakeover" : "AttentionBanner";
    case "Paused":
      return "Paused";
    case "none":
      return "NotEligible";
    case "NotEligible":
      return "NotEligible";
    case "Eligible": {
      const app = s.latestApplication;
      if (app?.state === "PendingReview") return app.isWaitlisted ? "Waitlisted" : "InReview";
      if (app?.state === "Submitted") return "InReview";
      if (app?.state === "Rejected") return "Rejected";
      return "Offer";
    }
  }
}
