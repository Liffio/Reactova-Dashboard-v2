import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

export type MarketingPlan = {
  plan: string;
  displayName: string;
  description: string | null;
  monthlyPriceUsd: number;
  badge?: string | null;
  highlight?: boolean;
  popular?: boolean;
  features?: string[];
};

export function getMarketingPlans() {
  return apiRequest<{ plans: MarketingPlan[] }>(apiUri.marketing.plans, { token: null });
}

export function getAffiliateCalculatorConfig() {
  return apiRequest<Record<string, unknown>>(apiUri.marketing.affiliateCalculatorConfig, {
    token: null,
  });
}
