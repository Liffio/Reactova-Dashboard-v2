import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

export type AnalyticsApiRange = "7d" | "30d" | "90d";

export type DashboardResponse = {
  workspace: {
    id: string;
    handle: string | null;
    plan: "FREE" | "STARTER" | "PRO" | "BUSINESS" | "AGENCY";
    status: "ACTIVE" | "PAUSED" | "PAYMENT_FAILED" | "INSTAGRAM_DISCONNECTED";
    billingCycleEnd: string | null;
  };
  /**
   * The connected Instagram account. Separate from `workspace.handle` because the topbar pill
   * needs the expiry too — a token that lapses stops every automation in the workspace silently.
   */
  instagram: {
    connected: boolean;
    handle: string | null;
    avatarUrl: string | null;
    followerCount: number | null;
    tokenExpiresAt: string | null;
  };
  /**
   * The four stages as one funnel. `commentsMatched` counts DM jobs at every status, so the first
   * gate is delivery rate and the two after it are conversion.
   */
  funnel: {
    commentsMatched: number;
    dmsSent: number;
    leadsCaptured: number;
    linkClicks: number;
  };
  /** Daily, gap-filled, over the selected window. */
  series: {
    dms: Array<{ day: string; value: number }>;
    leads: Array<{ day: string; value: number }>;
    clicks: Array<{ day: string; value: number }>;
  };
  period: {
    start: string;
    end: string;
    /** Panels that do NOT re-window with the date picker, named by the server. */
    ignoredBy: string[];
  };
  totals: {
    dmsSentThisMonth: number;
    dmsSentLastMonth: number;
    dmsTrendPercent: number | null;
    activeAutomations: number;
    pausedAutomations: number;
    draftAutomations: number;
    totalAutomations: number;
    leadsCapturedThisMonth: number;
    linkClicksThisMonth: number;
    linkClicksLastMonth: number;
    clickTrendPercent: number | null;
    leadsCapturedLastMonth: number;
    leadsTrendPercent: number | null;
    /**
     * All-time scheduler tallies. `null` means the server could not read them — render
     * "unavailable", never `0`. `undefined` only on an older API build.
     */
    schedulerScheduled?: number | null;
    schedulerDrafts?: number | null;
    schedulerFailed?: number | null;
    postInsightsTracked?: number | null;
    /** False when the scheduler aggregate query failed server-side. */
    schedulerStatsAvailable?: boolean;
  };
  recentActivities: Array<{
    id: string;
    title: string;
    keyword: string | null;
    status: "ACTIVE" | "PAUSED" | "DRAFT";
    dmsSentThisMonth: number;
    createdAt: string;
  }>;
  /** Newest first. Seeds the live feed so it is populated before the first socket event. */
  activityFeed: Array<{
    id: string;
    type: "dm" | "lead" | "click";
    title: string;
    subtitle: string | null;
    at: string;
  }>;
  workspaceSummaries: Array<{
    id: string;
    handle: string | null;
    plan: "FREE" | "STARTER" | "PRO" | "BUSINESS" | "AGENCY";
    status: "ACTIVE" | "PAUSED" | "PAYMENT_FAILED" | "INSTAGRAM_DISCONNECTED";
    instagramConnected: boolean;
    billingCycleEnd: string | null;
    dmsThisMonth: number;
    leadsThisMonth: number;
    clicksThisMonth: number;
    activeAutomations: number;
  }>;
};

export type AnalyticsPageResponse = {
  range: AnalyticsApiRange | "custom";
  period?: { start: string; end: string };
  /**
   * The window actually queried, after the plan's analytics-history depth was applied.
   *
   * `clamped: true` means the server narrowed the request — the chart covers less time than the
   * picker says, and the UI MUST disclose that rather than presenting a truncated series as
   * complete. `historyDays` is `null` when the plan grants unlimited history.
   * Absent on an older API build.
   */
  historyWindow?: {
    from: string;
    to: string;
    requestedFrom: string;
    clamped: boolean;
    historyDays: number | null;
  };
  summary: {
    totalDmsSent: number;
    dmDeliveryRate: number;
    totalLinkClicks: number;
    /**
     * Lead -> click: of the leads captured in the window, the share that clicked.
     * NOT DM -> click. Same value as `rates.leadClickRate`.
     */
    conversionRate: number;
    leadsCaptured: number;
    bioLinkClicks: number;
    dmsQueued: number;
    dmsFailed: number;
  };
  /**
   * Four measured stages in strictly non-increasing order.
   *
   * The previous shape had `commentsReceived` and `keywordMatched` both set to the lead count and
   * `saleAttributed` pinned to `0`; all three are gone rather than renamed.
   */
  funnel: {
    /** DM jobs created in the window, at any status. The top of the funnel. */
    dmsAttempted: number;
    /** Of those, status = SENT. */
    dmsDelivered: number;
    leadsCaptured: number;
    /** Of the captured leads, the ones that clicked. */
    linkClicked: number;
  };
  lineSeries: Array<{ day: string; value: number }>;
  clickLineSeries: Array<{ day: string; value: number }>;
  leadLineSeries: Array<{ day: string; value: number }>;
  bioClickLineSeries: Array<{ day: string; value: number }>;
  topKeywords: Array<{ keyword: string; value: number }>;
  automationPerformance: Array<{
    id: string;
    name: string;
    keyword: string | null;
    status: string;
    dmsSent: number;
    linkClicks: number;
    leadsCaptured: number;
    /** Attributed link clicks per DM sent, as a percentage. Legacy name. */
    conversionRate: number;
    /** Same number as `conversionRate`, named for what it measures. */
    clickThroughRate?: number;
    /** Band of the click-through rate. Named `roiBand` for compatibility; it is not an ROI. */
    roiBand: "high" | "medium" | "low";
  }>;
  rates: {
    /**
     * Leads that clicked, per DM sent. The numerator counts LEADS, not clicks, despite the
     * name. Superseded by `linkClicksPerDmRate`; kept only for compatibility.
     */
    clickRate: number;
    /** Leads captured per DM sent. */
    leadRate: number;
    /** Short-link clicks per DM sent — clicks in the numerator, as the name implies. */
    linkClicksPerDmRate?: number;
    /** Of the leads captured, the share that clicked. */
    leadClickRate?: number;
  };
  channels: {
    shortLinks: {
      totalClicks: number;
      topLinks: Array<{ id: string; name: string; slug: string; clicks: number }>;
    };
    bioLink: {
      totalClicksAllTime: number;
      clicksInRange: number;
    };
    dms: {
      sent: number;
      failed: number;
      queued: number;
      deliveryRate: number;
    };
    leads: {
      captured: number;
      linkClicked: number;
    };
    scheduler: {
      /** False when the server could not read the scheduler tables; counts are then null. */
      available?: boolean;
      scheduled: number | null;
      draft: number | null;
      failed: number | null;
      published: number | null;
    };
    posts: {
      /** False when the server could not read `post_analytics`; every field is then null. */
      available?: boolean;
      tracked: number | null;
      /**
       * `null` means Meta never returned the metric for any post in scope — which is a
       * different fact from a total of zero. Never render null as `0`.
       */
      impressions: number | null;
      reach: number | null;
      likes: number | null;
      comments: number | null;
      saves: number | null;
      dmsFromPosts: number | null;
      clicksFromPosts: number | null;
    };
  };
};

export type AnalyticsWindowParams = { range?: string; start?: string; end?: string };

const windowQs = (params: AnalyticsWindowParams): string => {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
};

export function getDashboard(workspaceId: string, params: AnalyticsWindowParams = {}) {
  return apiRequest<DashboardResponse>(`${apiUri.analytics.dashboard}${windowQs(params)}`, {
    workspaceId,
  });
}

export function getAnalyticsPage(workspaceId: string, params: AnalyticsWindowParams) {
  return apiRequest<AnalyticsPageResponse>(`${apiUri.analytics.page}${windowQs(params)}`, {
    workspaceId,
  });
}
