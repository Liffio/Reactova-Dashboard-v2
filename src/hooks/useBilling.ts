import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export type BillingPlanConfig = {
  plan: string;
  displayName: string;
  description: string;
  highlights: string[];
  sortOrder: number;
  pricing: {
    monthlyUsd: number;
    quarterlyUsd: number | null;
    yearlyUsd: number | null;
  };
  limits: Record<string, number>;
  features: Record<string, boolean>;
  gates: Record<string, string>;
  checkout?: {
    stripe: Record<"monthly" | "quarterly" | "yearly", boolean>;
    razorpay: Record<"monthly" | "quarterly" | "yearly", boolean>;
  };
};

export type BillingConfigResponse = {
  mode: "sandbox" | "production";
  isSandbox: boolean;
  currency: string;
  razorpayCurrency: string;
  providers: {
    stripe: { configured: boolean; publishableKey: string | null; webhookConfigured: boolean };
    razorpay: { configured: boolean; keyId: string | null; webhookConfigured: boolean };
  };
  plans: BillingPlanConfig[];
};

export type BillingSubscription = {
  workspaceId: string;
  plan: string;
  displayName: string;
  status: string;
  billingCycleEnd: string | null;
  limits: Record<string, number>;
  features: Record<string, boolean>;
  hasActiveSubscription: boolean;
};

export function useBillingConfigQuery() {
  return useQuery({
    queryKey: ["billing-config"],
    queryFn: () => apiRequest<BillingConfigResponse>("/api/v1/billing/config"),
    staleTime: 300_000
  });
}

export function useBillingSubscriptionQuery(workspaceId: string) {
  return useQuery({
    queryKey: ["billing-subscription", workspaceId],
    queryFn: () => apiRequest<BillingSubscription>("/api/v1/billing/subscription", { workspaceId }),
    enabled: Boolean(workspaceId)
  });
}

export function useBillingCheckoutMutation(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      plan: string;
      interval: "monthly" | "quarterly" | "yearly";
      provider: "stripe" | "razorpay";
    }) =>
      apiRequest<{ checkoutUrl: string | null; provider: string }>("/api/v1/billing/checkout", {
        method: "POST",
        body,
        workspaceId
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["billing-subscription", workspaceId] });
    }
  });
}

export function useBillingPortalMutation(workspaceId: string) {
  return useMutation({
    mutationFn: () =>
      apiRequest<{ url: string }>("/api/v1/billing/portal", { method: "POST", workspaceId })
  });
}

export function useBillingCancelMutation(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<{ plan: string }>("/api/v1/billing/cancel", { method: "POST", workspaceId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["billing-subscription", workspaceId] });
    }
  });
}
