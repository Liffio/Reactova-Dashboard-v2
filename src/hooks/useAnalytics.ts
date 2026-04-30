import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export type AnalyticsRange = "7d" | "30d" | "90d" | "Custom";
export type AnalyticsApiRange = Exclude<AnalyticsRange, "Custom">;

type AnalyticsPageResponse = {
  summary: {
    totalDmsSent: number;
    dmDeliveryRate: number;
    totalLinkClicks: number;
    conversionRate: number;
  };
  funnel: {
    commentsReceived: number;
    keywordMatched: number;
    dmsSent: number;
    linkClicked: number;
    saleAttributed: number;
  };
  lineSeries: Array<{ day: string; value: number }>;
  topKeywords: Array<{ keyword: string; value: number }>;
  automationPerformance: Array<{
    id: string;
    name: string;
    keyword: string | null;
    dmsSent: number;
    linkClicks: number;
    conversionRate: number;
    roiBand: "high" | "medium" | "low";
  }>;
  rates: {
    clickRate: number;
    leadRate: number;
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
