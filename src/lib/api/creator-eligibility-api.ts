/**
 * Creator-facing Creator Eligibility System API — ENDPOINT-CONTRACT.md §3.
 * All endpoints require `requireAuth` only; they resolve "the caller's own
 * creator profile" server-side via the JWT, so nothing here takes a userId.
 */
import { apiUri } from "./apiUri";
import { apiRequest } from "./http";
import type { NeedsAttentionReason, NotEligibleReason } from "@/lib/creator-eligibility-copy";

export type CreatorApplicationSummary = {
  id: string;
  state: "Submitted" | "PendingReview" | "Approved" | "Rejected";
  submittedAt: string;
  isWaitlisted: boolean;
};

export type CreatorProgress = {
  dmCount: number;
  dmTarget: number;
  automationCount: number;
  automationTarget: number;
};

export type CreatorStatus =
  | { state: "none" }
  | {
      state: "NotEligible";
      primaryReason: NotEligibleReason | null;
      secondaryReasons: string[];
      latestApplication: CreatorApplicationSummary | null;
    }
  | { state: "Eligible"; cooldown: { active: boolean; reapplyAt: string | null } }
  | { state: "Eligible"; latestApplication: CreatorApplicationSummary }
  | { state: "Active"; joinedAt: string; progress: CreatorProgress }
  | {
      state: "NeedsAttention";
      primaryReason: NeedsAttentionReason;
      secondaryReasons: string[];
      progress: CreatorProgress;
    }
  | { state: "Paused" };

export function getCreatorStatus() {
  return apiRequest<CreatorStatus>(apiUri.creator.status);
}

/**
 * Flatter, single-fixed-shape alternative to `GET /status` — ENDPOINT-CONTRACT.md §3.2.
 * Added alongside `/status`, not a replacement: `/status` is still the source of truth
 * for cooldown/application-in-flight details on the `Eligible` state, which this
 * endpoint doesn't carry. Throws (via `apiRequest`/`ApiError`, `status: 404`) if the
 * caller has no `CreatorProfile` yet — unlike `/status`, which returns `{ state: "none" }`
 * for the same situation.
 */
export type CreatorProfile = {
  state: "NotEligible" | "Eligible" | "Active" | "NeedsAttention" | "Paused";
  primaryReason: string | null;
  secondaryReasons: string[];
  monthlyDms: number;
  minMonthlyDms: number;
  activeAutomations: number;
  minActiveAutomations: number;
  instagramConnected: boolean;
  instagramUsername: string | null;
  followerCount: number | null;
  eligibilityAlgorithmVersion: string;
  approvedAt: string | null;
};

export function getCreatorProfile() {
  return apiRequest<CreatorProfile>(apiUri.creator.profile);
}

export type ApplyOutcome =
  | { outcome: "blocked_by_cooldown"; reapplyAt: string }
  | { outcome: "rejected_eligibility_changed"; applicationId: string; reason: "EligibilityChanged" }
  | {
      outcome: "decided";
      applicationId: string;
      decision:
        | "auto_approved"
        | "queued_for_review"
        | "waitlisted"
        | "auto_rejected"
        | "already_submitted";
    };

/** Submits (or re-verifies) the caller's application. No request body — see ENDPOINT-CONTRACT.md §3.2. */
export function applyToCreatorProgram() {
  return apiRequest<ApplyOutcome>(apiUri.creator.apply, { method: "POST" });
}

export type CreatorThresholds = {
  minMonthlyDms: number;
  minActiveAutomations: number;
  minPosts: number;
  maxDaysSinceLastPost: number;
  cooldownDays: number;
};

export function getCreatorThresholds() {
  return apiRequest<CreatorThresholds>(apiUri.creator.thresholds);
}
