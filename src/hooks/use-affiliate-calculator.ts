import { useQuery } from "@tanstack/react-query";
import { getAffiliateCalculatorConfig } from "@/lib/api/marketing-api";
import { useAuth } from "@/hooks/use-auth";

export function useAffiliateCalculatorConfig() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["marketing", "affiliate-calculator-config", user?.country ?? "auto"],
    queryFn: () => getAffiliateCalculatorConfig(user?.country ?? undefined),
    staleTime: 1000 * 60 * 30,
  });
}
