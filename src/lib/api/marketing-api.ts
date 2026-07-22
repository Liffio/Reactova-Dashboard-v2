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

export type AffiliateCalculatorConfig = {
  region: "global" | "india";
  currency: "USD" | "INR";
  currencyLabel: string;
  countryCode: string | null;
  regionSource: "profile" | "ip" | "default";
  planName: string;
  planMonthly: number;
  monthlyCommissionPerReferral: number;
  commissionRate: number;
  commissionRatePercent: number;
};

export function getAffiliateCalculatorConfig(countryCode?: string) {
  const query = countryCode ? `?countryCode=${encodeURIComponent(countryCode)}` : "";
  return apiRequest<AffiliateCalculatorConfig>(
    `${apiUri.marketing.affiliateCalculatorConfig}${query}`,
    {
      token: null,
    },
  );
}
