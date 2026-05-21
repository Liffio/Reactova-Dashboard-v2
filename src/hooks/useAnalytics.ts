import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export type AnalyticsRange = "7d" | "30d" | "90d" | "Custom";
export type AnalyticsApiRange = Exclude<AnalyticsRange, "Custom">;

export type AnalyticsPageResponse = {
  range: AnalyticsApiRange;
  summary: {
    totalDmsSent: number;
    dmDeliveryRate: number;
    totalLinkClicks: number;
    conversionRate: number;
    leadsCaptured: number;
    bioLinkClicks: number;
    dmsQueued: number;
    dmsFailed: number;
  };
  funnel: {
    commentsReceived: number;
    keywordMatched: number;
    dmsSent: number;
    linkClicked: number;
    saleAttributed: number;
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
    conversionRate: number;
    roiBand: "high" | "medium" | "low";
  }>;
  rates: {
    clickRate: number;
    leadRate: number;
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
      scheduled: number;
      draft: number;
      failed: number;
      published: number;
    };
    posts: {
      tracked: number;
      impressions: number;
      reach: number;
      likes: number;
      comments: number;
      saves: number;
      dmsFromPosts: number;
      clicksFromPosts: number;
    };
  };
};

export function useAnalyticsPageQuery(workspaceId: string, range: AnalyticsApiRange) {
  return useQuery({
    queryKey: ["analytics-page", workspaceId, range],
    queryFn: () =>
      apiRequest<AnalyticsPageResponse>(`/api/v1/analytics/page?range=${range}`, {
        workspaceId
      }),
    enabled: Boolean(workspaceId)
  });
}
