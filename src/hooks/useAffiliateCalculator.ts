import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

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

const CALCULATOR_PATH = "/api/v1/public/marketing/affiliate-calculator-config";

export function useAffiliateCalculatorConfig() {
  const { user } = useAuth();
  const countryQuery = user?.country ? `?countryCode=${encodeURIComponent(user.country)}` : "";

  return useQuery({
    queryKey: ["marketing", "affiliate-calculator-config", user?.country ?? "auto"],
    queryFn: () =>
      apiRequest<AffiliateCalculatorConfig>(`${CALCULATOR_PATH}${countryQuery}`, {
        token: null,
      }),
    staleTime: 1000 * 60 * 30,
  });
}
