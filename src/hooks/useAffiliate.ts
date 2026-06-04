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
  programConsentAt: string | null;
  programConsentVersion: string | null;
  hasProgramConsent: boolean;
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
    queryFn: () => apiRequest<AffiliateProfile>("/api/v1/affiliate/profile"),
  });
}

function useAffiliateConsentEnabled() {
  const { data: profile } = useAffiliateProfile();
  return Boolean(profile?.hasProgramConsent);
}

export function useAcceptAffiliateProgramConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      version: string;
      acceptedTerms: true;
      acceptedCommissionPolicy: true;
      acceptedPayoutPolicy: true;
    }) =>
      apiRequest<AffiliateProfile>("/api/v1/affiliate/program-consent", {
        method: "POST",
        body,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["affiliate"] });
    },
  });
}

export function useAffiliateLinks() {
  const enabled = useAffiliateConsentEnabled();
  return useQuery({
    queryKey: ["affiliate", "links"],
    enabled,
    queryFn: () =>
      apiRequest<{
        randomLink: string;
        customLink: string | null;
        shortRandomLink: string;
        shortCustomLink: string | null;
      }>("/api/v1/affiliate/links"),
  });
}

export function useAffiliateDashboard() {
  const enabled = useAffiliateConsentEnabled();
  return useQuery({
    queryKey: ["affiliate", "dashboard"],
    enabled,
    queryFn: () => apiRequest<AffiliateDashboard>("/api/v1/affiliate/dashboard"),
    refetchInterval: enabled ? 60_000 : false,
  });
}

export function useAffiliateReferrals() {
  const enabled = useAffiliateConsentEnabled();
  return useQuery({
    queryKey: ["affiliate", "referrals"],
    enabled,
    queryFn: () =>
      apiRequest<
        Array<{
          id: string;
          email: string;
          isActive: boolean;
          attributedAt: string;
          workspaces: Array<{ plan: string; isEligible: boolean }>;
        }>
      >("/api/v1/affiliate/referrals"),
  });
}

export function useAffiliatePayouts() {
  const enabled = useAffiliateConsentEnabled();
  return useQuery({
    queryKey: ["affiliate", "payouts"],
    enabled,
    queryFn: () =>
      apiRequest<
        Array<{ id: string; amount: number; status: string; method: string; requestedAt: string }>
      >("/api/v1/affiliate/payouts"),
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
