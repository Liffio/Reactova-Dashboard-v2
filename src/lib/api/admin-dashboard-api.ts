import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

/**
 * Platform metrics client for the admin overview page. Mirrors the backend's
 * `AdminDashboardOverview` (server: services/adminDashboardMetrics.ts). The backend returns raw
 * `{ current, previous }` window pairs; the fraction StatCard expects is computed here so the two
 * sides never disagree about units.
 */

export const ADMIN_DASHBOARD_RANGES = ["7d", "30d", "90d"] as const;
export type AdminDashboardRange = (typeof ADMIN_DASHBOARD_RANGES)[number];

export type WindowPair = { current: number; previous: number };

export type PlanKey = "FREE" | "STARTER" | "PRO" | "BUSINESS" | "AGENCY";

export type AdoptionBasis = "period-activity" | "all-time-state" | "volume-only";

export type FeatureUsageItem = {
  key: string;
  label: string;
  adoptionBasis: AdoptionBasis;
  adoptedWorkspaces: number;
  adoptionPct: number;
  volume: WindowPair;
  volumeLabel: string;
};

export type AdminDashboardOverview = {
  range: AdminDashboardRange;
  period: { start: string; end: string; prevStart: string; prevEnd: string };
  users: {
    total: number;
    banned: number;
    newInPeriod: WindowPair;
    activeInPeriod: WindowPair;
    signupTrend: Array<{ day: string; count: number }>;
  };
  workspaces: {
    total: number;
    active: number;
    newInPeriod: WindowPair;
    igAccounts: { total: number; newInPeriod: WindowPair };
  };
  plans: {
    distribution: Array<{ plan: PlanKey; count: number; pct: number }>;
    freeCount: number;
    paidCount: number;
    bestBySubscribers: { plan: PlanKey; count: number } | null;
    bestByRevenue: { plan: PlanKey; revenueCents: number } | null;
    recentActivity: Array<{
      workspaceId: string;
      workspaceName: string;
      plan: PlanKey;
      status: string;
      interval: string | null;
      cancelAtPeriodEnd: boolean;
      createdAt: string;
      updatedAt: string;
    }>;
  };
  revenue: {
    mrr: { usdCents: number; byCurrency: Array<{ currency: string; monthlyMinorUnits: number }> };
    arrUsdCents: number;
    collectedInPeriod: WindowPair;
    collectedTrend: Array<{ day: string; amountCents: number }>;
    byPlanInPeriod: Array<{ plan: PlanKey | null; amountCents: number }>;
    cancellations: WindowPair;
    totalPaidAllTimeCents: number;
  };
  features: { denominator: number; items: FeatureUsageItem[] };
  health: {
    queues: Array<{
      name: string;
      available: boolean;
      waiting: number;
      active: number;
      delayed: number;
      failed: number;
    }>;
    dmJobsFailedInPeriod: number;
    scheduledPostsFailedInPeriod: number;
  };
  pending: {
    affiliatePayouts: number;
    affiliateKyc: number;
    creatorApplications: number;
    marketingCreatorApplications: number;
  };
};

export function getAdminDashboardOverview(range: AdminDashboardRange) {
  return apiRequest<AdminDashboardOverview>(apiUri.admin.dashboard.overview(range));
}

/**
 * StatCard's `delta` is a fraction (it renders ×100). Undefined when there is no previous-period
 * baseline — a delta against zero reads as +∞ and the pill is better omitted.
 */
export function deltaFraction(pair: WindowPair | undefined): number | undefined {
  if (!pair || pair.previous === 0) return undefined;
  return (pair.current - pair.previous) / pair.previous;
}
