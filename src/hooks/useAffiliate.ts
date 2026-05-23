import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export type AffiliateProfile = {
  id: string;
  randomCode: string;
  customCode: string | null;
  totalReferrals: number;
  activeReferrals: number;
  totalEarned: number;
  pendingBalance: number;
  availableBalance: number;
  lifetimePaid: number;
  isSuspended: boolean;
};

export type AffiliateDashboard = {
  totalEarned: number;
  availableBalance: number;
  pendingBalance: number;
  lifetimePaid: number;
  totalReferrals: number;
  activeReferrals: number;
  recentCommissions: Array<{
    id: string;
    amount: number;
    status: string;
    workspace: string;
    plan: string;
    createdAt: string;
  }>;
  recentPayouts: Array<{
    id: string;
    amount: number;
    status: string;
    method: string;
    requestedAt: string;
  }>;
};

export function useAffiliateProfile() {
  return useQuery({
    queryKey: ["affiliate", "profile"],
    queryFn: () => apiRequest<AffiliateProfile>("/api/v1/affiliate/profile")
  });
}

export function useAffiliateLinks() {
  return useQuery({
    queryKey: ["affiliate", "links"],
    queryFn: () =>
      apiRequest<{
        randomLink: string;
        customLink: string | null;
        shortRandomLink: string;
        shortCustomLink: string | null;
      }>("/api/v1/affiliate/links")
  });
}

export function useAffiliateDashboard() {
  return useQuery({
    queryKey: ["affiliate", "dashboard"],
    queryFn: () => apiRequest<AffiliateDashboard>("/api/v1/affiliate/dashboard"),
    refetchInterval: 60_000
  });
}

export function useAffiliateReferrals() {
  return useQuery({
    queryKey: ["affiliate", "referrals"],
    queryFn: () =>
      apiRequest<
        Array<{
          id: string;
          email: string;
          isActive: boolean;
          attributedAt: string;
          workspaces: Array<{ plan: string; isEligible: boolean }>;
        }>
      >("/api/v1/affiliate/referrals")
  });
}

export function useAffiliatePayouts() {
  return useQuery({
    queryKey: ["affiliate", "payouts"],
    queryFn: () =>
      apiRequest<
        Array<{ id: string; amount: number; status: string; method: string; requestedAt: string }>
      >("/api/v1/affiliate/payouts")
  });
}

export function useSetCustomAffiliateCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (customCode: string) =>
      apiRequest<{ customCode: string }>("/api/v1/affiliate/custom-code", {
        method: "POST",
        body: { customCode }
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["affiliate"] });
    }
  });
}

export function useRequestAffiliatePayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      amount: number;
      payoutMethod: string;
      payoutDetails: Record<string, string>;
    }) =>
      apiRequest("/api/v1/affiliate/payouts/request", {
        method: "POST",
        body: input
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["affiliate"] });
    }
  });
}
