/**
 * Admin-facing Creator Eligibility System API — ENDPOINT-CONTRACT.md §4.
 * All endpoints require `requireAuth` + `requirePermissionOrSuperAdmin("creatorProgram", ...)`;
 * override (§4.7/§4.8) and settings (§4.9) are additionally Super-Admin-only.
 * This client is consumed only from routes gated by `PlatformAdminRoute`
 * (see src/components/auth/guards.tsx), matching the existing pattern used
 * by the other Platform-admin pages in this codebase — super admins always
 * satisfy `requirePermissionOrSuperAdmin`.
 */
import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

export type CreatorProfileState =
  | "NotEligible"
  | "Eligible"
  | "Active"
  | "NeedsAttention"
  | "Paused";
export type CreatorApplicationState = "Submitted" | "PendingReview" | "Approved" | "Rejected";

export type CreatorMetricsSnapshot = {
  igAccountType: "Business" | "Creator" | "Personal";
  isConnected: boolean;
  isPrivate: boolean;
  followerCount: number;
  postCount: number;
  lastPostAt: string | null;
  engagementRate: number | null;
  insightsAvailable: boolean;
  dmCountCurrentPeriod: number;
  activeAutomationCount: number;
  lastSyncSucceeded: boolean;
  consecutiveSyncFailures: number;
  syncedAt: string;
};

export type AdminApplicationListItem = {
  id: string;
  state: CreatorApplicationState;
  reason: string;
  score: number;
  scoreAlgorithmVersion: string;
  submittedAt: string;
  reviewedAt: string | null;
  creatorProfile: {
    id: string;
    userId: string;
    userEmail: string;
    userName: string;
  };
};

export type AdminApplicationListResponse = {
  items: AdminApplicationListItem[];
  page: number;
  limit: number;
  total: number;
};

export function listAdminCreatorApplications(
  params: { page?: number; limit?: number; state?: string } = {},
) {
  return apiRequest<AdminApplicationListResponse>(apiUri.admin.creator.applications(params));
}

export type AdminApplicationDetail = {
  id: string;
  state: CreatorApplicationState;
  reason: string;
  score: number;
  scoreAlgorithmVersion: string;
  scoreBreakdown: {
    accountQuality: number;
    audience: number;
    engagement: number;
    consistency: number;
    normalized: boolean;
  };
  submittedAt: string;
  reviewedAt: string | null;
  reviewer: string | null;
  metricsSnapshot: CreatorMetricsSnapshot;
  thresholdsSnapshot: Record<string, unknown>;
  creatorProfile: {
    id: string;
    userId: string;
    userEmail: string;
    userName: string;
    state: CreatorProfileState;
  };
};

export function getAdminCreatorApplication(id: string) {
  return apiRequest<AdminApplicationDetail>(apiUri.admin.creator.application(id));
}

export function approveAdminCreatorApplication(id: string) {
  return apiRequest<{ ok: boolean }>(apiUri.admin.creator.approve(id), { method: "POST" });
}

export function rejectAdminCreatorApplication(id: string) {
  return apiRequest<{ ok: boolean }>(apiUri.admin.creator.reject(id), { method: "POST" });
}

export type AdminCreatorOverview = {
  profilesByState: Record<CreatorProfileState, number>;
  pendingReviewCount: number;
  waitlistedCount: number;
  capacity: { activeCreatorCount: number; maxActiveCreators: number };
  generatedAt: string;
};

export function getAdminCreatorOverview() {
  return apiRequest<AdminCreatorOverview>(apiUri.admin.creator.overview);
}

export type CreatorProgress = {
  dmCount: number;
  dmTarget: number;
  automationCount: number;
  automationTarget: number;
};

export type AdminCreatorApplicationHistoryItem = {
  id: string;
  state: CreatorApplicationState;
  reason: string;
  score: number;
  scoreAlgorithmVersion: string;
  submittedAt: string;
  reviewedAt: string | null;
};

/** `data` is a raw `creator_events` or `creator_audit_log` row — shape not pinned down by the contract beyond §6.2, rendered defensively. */
export type AdminCreatorTimelineEntry = {
  type: "event" | "audit";
  at: string;
  data: Record<string, unknown>;
};

export type AdminCreatorNote = {
  id: string;
  adminId: string;
  note: string;
  createdAt: string;
};

/** Row shape not formally specified by ENDPOINT-CONTRACT.md §6.2 beyond "creator_metrics_history rows" — accessed defensively. */
export type AdminCreatorMetricsHistoryRow = Record<string, unknown>;

export type AdminCreatorDetail = {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  state: CreatorProfileState;
  stateSince: string;
  eligibilityAlgorithmVersion: string;
  healthAlgorithmVersion: string;
  primaryReason: string | null;
  secondaryReasons: string[];
  metrics: CreatorMetricsSnapshot;
  override: { active: boolean; until: string | null; reason: string | null; by: string | null };
  // Phase 6 additive fields — ENDPOINT-CONTRACT.md §6.2 (same endpoint as §4.6, always present now).
  removed: { removedAt: string | null; removedReason: string | null; removedBy: string | null };
  progress: CreatorProgress;
  metricsHistory: AdminCreatorMetricsHistoryRow[];
  applications: AdminCreatorApplicationHistoryItem[];
  timeline: AdminCreatorTimelineEntry[];
  notes: AdminCreatorNote[];
};

export function getAdminCreatorDetail(profileId: string) {
  return apiRequest<AdminCreatorDetail>(apiUri.admin.creator.creator(profileId));
}

/** Super-Admin only — ENDPOINT-CONTRACT.md §4.7. */
export function setAdminCreatorOverride(
  profileId: string,
  body: { until: string; reason: string },
) {
  return apiRequest<{ ok: boolean; overrideUntil: string }>(
    apiUri.admin.creator.override(profileId),
    {
      method: "POST",
      body,
    },
  );
}

/** Super-Admin only — ENDPOINT-CONTRACT.md §4.8. */
export function clearAdminCreatorOverride(profileId: string) {
  return apiRequest<{ ok: boolean }>(apiUri.admin.creator.override(profileId), {
    method: "DELETE",
  });
}

export type AdminCreatorSettings = {
  auto_approve_threshold: number;
  manual_review_threshold: number;
  min_posts: number;
  max_days_since_last_post: number;
  min_monthly_dms: number;
  min_active_automations: number;
  cooldown_days: number;
  max_active_creators: number;
  active_creator_count: number;
  max_consecutive_sync_failures: number;
};

/** Super-Admin only, read-only view — ENDPOINT-CONTRACT.md §4.9. */
export function getAdminCreatorSettings() {
  return apiRequest<AdminCreatorSettings>(apiUri.admin.creator.settings);
}

/** Super-Admin only — ENDPOINT-CONTRACT.md §7.2. Atomic multi-key update; returns the full updated settings object. */
export function updateAdminCreatorSettings(entries: Array<{ key: string; value: number }>) {
  return apiRequest<AdminCreatorSettings>(apiUri.admin.creator.settings, {
    method: "PATCH",
    body: entries,
  });
}

/* -------------------------------------------------------------------------
 * Phase 6 — Creator Management Dashboard (ENDPOINT-CONTRACT.md §6)
 * ---------------------------------------------------------------------- */

export type AdminCreatorListItem = {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  state: CreatorProfileState;
  stateSince: string;
  createdAt: string;
};

export type AdminCreatorListResponse = {
  items: AdminCreatorListItem[];
  nextCursor: string | null;
  limit: number;
};

/** Cursor-paginated creator search/list — ENDPOINT-CONTRACT.md §6.1. */
export function listAdminCreatorsManaged(
  params: { limit?: number; cursor?: string; search?: string; state?: string } = {},
) {
  return apiRequest<AdminCreatorListResponse>(apiUri.admin.creator.list(params));
}

export function pauseAdminCreator(profileId: string) {
  return apiRequest<{ ok: boolean }>(apiUri.admin.creator.pause(profileId), { method: "POST" });
}

export function reactivateAdminCreator(profileId: string) {
  return apiRequest<{ reactivated: boolean; reason?: string }>(
    apiUri.admin.creator.reactivate(profileId),
    { method: "POST" },
  );
}

/** Super-Admin only — ENDPOINT-CONTRACT.md §6.5. Does not revoke plan/role (documented backend limitation). */
export function removeAdminCreator(profileId: string, reason: string) {
  return apiRequest<{ ok: boolean }>(apiUri.admin.creator.remove(profileId), {
    method: "POST",
    body: { reason },
  });
}

export function forceEligibilityCheckAdminCreator(profileId: string) {
  return apiRequest<{ pass: boolean; score?: number; reason?: string }>(
    apiUri.admin.creator.forceEligibilityCheck(profileId),
    { method: "POST" },
  );
}

export function forceHealthCheckAdminCreator(profileId: string) {
  return apiRequest<{ skipped: boolean; conditions?: string[] }>(
    apiUri.admin.creator.forceHealthCheck(profileId),
    { method: "POST" },
  );
}

export function forceMetricsSyncAdminCreator(profileId: string) {
  return apiRequest<Record<string, unknown>>(apiUri.admin.creator.forceMetricsSync(profileId), {
    method: "POST",
  });
}

export type CreatorPlanTier = "FREE" | "STARTER" | "PRO" | "BUSINESS" | "AGENCY";

/** Super-Admin only — ENDPOINT-CONTRACT.md §6.9. Stopgap: only updates the `plan` column, no billing integration. */
export function changeAdminCreatorPlan(profileId: string, plan: CreatorPlanTier) {
  return apiRequest<{ ok: boolean; before: string; after: string }>(
    apiUri.admin.creator.plan(profileId),
    { method: "POST", body: { plan } },
  );
}

export function addAdminCreatorNote(profileId: string, note: string) {
  return apiRequest<{ ok: boolean; note: AdminCreatorNote }>(
    apiUri.admin.creator.notes(profileId),
    {
      method: "POST",
      body: { note },
    },
  );
}

export type BulkCreatorAction =
  | "pause"
  | "reactivate"
  | "force-health-check"
  | "force-metrics-sync";

export type BulkCreatorActionResult = {
  results: Array<{ profileId: string; ok: boolean; error?: string }>;
};

export function bulkAdminCreatorAction(action: BulkCreatorAction, profileIds: string[]) {
  return apiRequest<BulkCreatorActionResult>(apiUri.admin.creator.bulk(action), {
    method: "POST",
    body: { profileIds },
  });
}

export type AdminCreatorExportRow = {
  id: string;
  state: string;
  created_at: string;
  email: string;
  name: string;
  [key: string]: unknown;
};

/** No request body; filters by the same `?state=`/`?search=` as the list endpoint — ENDPOINT-CONTRACT.md §6.11. */
export function exportAdminCreators(params: { state?: string; search?: string } = {}) {
  return apiRequest<{ items: AdminCreatorExportRow[] }>(
    apiUri.admin.creator.bulk("export", params),
    {
      method: "POST",
    },
  );
}

/**
 * ENDPOINT-CONTRACT.md §6.12 documents these rate/percentage fields as `number`,
 * but the live API actually returns them as numeric strings (a common
 * Postgres NUMERIC-column-serialization gotcha) — typed as `number | string`
 * here so callers are forced to go through `parseRate` rather than call
 * `.toFixed` directly and crash on a string.
 */
export type AdminCreatorAnalyticsSnapshot = {
  id: string;
  approvalRate: number | string;
  rejectionRate: number | string;
  avgEligibilityScore: number | string;
  activeCreatorPct: number | string;
  healthyCreatorPct: number | string;
  monthlyCompliancePct: number | string;
  pausedPct: number | string;
  reactivationPct: number | string;
  manualReviewPct: number | string;
  computedAt: string;
};

/** Safely coerces a rate/percentage field that may arrive as a number or a numeric string. */
export function parseRate(v: number | string | null | undefined): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

/** Materialized snapshot, refreshed ~every 15 min — never computed live. `snapshot` is `null` before the first refresh job runs. */
export function getAdminCreatorAnalytics() {
  return apiRequest<{ snapshot: AdminCreatorAnalyticsSnapshot | null }>(
    apiUri.admin.creator.analytics,
  );
}

/* -------------------------------------------------------------------------
 * Section 7 additions — waitlist visibility, settings PATCH, audit log
 * (ENDPOINT-CONTRACT.md §7)
 * ---------------------------------------------------------------------- */

export type AdminWaitlistApplication = {
  applicationId: string;
  userId: string;
  instagramUsername: string | null;
  followerCount: number;
  score: number;
  submittedAt: string;
  position: number;
};

export type AdminWaitlistResponse = {
  applications: AdminWaitlistApplication[];
  total: number;
  nextCursor: string | null;
};

/** Read-only, FIFO oldest-first — ENDPOINT-CONTRACT.md §7.1. No approve/reject; these resolve automatically. */
export function listAdminWaitlist(params: { limit?: number; cursor?: string } = {}) {
  return apiRequest<AdminWaitlistResponse>(apiUri.admin.creator.waitlist(params));
}

export type AuditLogEntry = {
  id: string;
  type: "decision" | "event";
  eventType: string | null;
  decision: string | null;
  actor: string;
  createdAt: string;
  payload: Record<string, unknown>;
};

export type AuditLogResponse = {
  entries: AuditLogEntry[];
  total: number;
  nextCursor: string | null;
};

/** Merged creator_audit_log + creator_events timeline across all creators — ENDPOINT-CONTRACT.md §7.3. */
export function getAdminAuditLog(
  params: {
    creatorProfileId?: string;
    decisionType?: string;
    from?: string;
    to?: string;
    limit?: number;
    cursor?: string;
  } = {},
) {
  return apiRequest<AuditLogResponse>(apiUri.admin.creator.auditLog(params));
}
