/**
 * Creator-facing Creator Eligibility System API — ENDPOINT-CONTRACT.md §3.
 * All endpoints require `requireAuth` only; they resolve "the caller's own
 * creator profile" server-side via the JWT, so nothing here takes a userId.
 *
 * The response types are NOT defined here. `/status`, `/thresholds` and
 * `/apply` are shaped by `@/features/creator-program/contract`, which is the
 * backend's file copied in verbatim and diffed in CI — a type written twice is
 * a type that drifts. This module only knows how to call the endpoints.
 */
import { apiUri } from "./apiUri";
import { apiRequest } from "./http";
import type {
  CreatorApplyResponse,
  CreatorStatusResponse,
  CreatorThresholdsResponse,
} from "@/features/creator-program/contract";

export type {
  CreatorApplyResponse,
  CreatorStatusResponse,
  CreatorThresholdsResponse,
} from "@/features/creator-program/contract";

export function getCreatorStatus() {
  return apiRequest<CreatorStatusResponse>(apiUri.creator.status);
}

/**
 * Flatter, single-fixed-shape alternative to `GET /status` — ENDPOINT-CONTRACT.md §3.2.
 * The Creator Program page no longer reads it: everything it used to supply
 * (handle, avatar, follower/post counts, connection state) now arrives on
 * `/status` under `account`, so the page fetches once instead of twice. Kept
 * because the endpoint is live and this is its only client binding.
 *
 * Throws (via `apiRequest`/`ApiError`, `status: 404`) if the caller has no
 * `CreatorProfile` yet — unlike `/status`, which returns `{ state: "none" }`.
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

/** Submits (or re-verifies) the caller's application. No request body — see ENDPOINT-CONTRACT.md §3.2. */
export function applyToCreatorProgram() {
  return apiRequest<CreatorApplyResponse>(apiUri.creator.apply, { method: "POST" });
}

export function getCreatorThresholds() {
  return apiRequest<CreatorThresholdsResponse>(apiUri.creator.thresholds);
}
