import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { apiRequest } from "@/lib/api";

export type BioLinkItem = {
  id: string;
  title: string;
  url: string;
  order: number;
};

export type BioLinkProfile = {
  id: string;
  workspaceId: string;
  slug: string;
  displayName: string;
  bio: string | null;
  theme: string;
  accentColor: string;
  buttonStyle: "filled" | "outlined" | "soft";
  backgroundType: "solid" | "gradient";
  backgroundColor: string;
  backgroundColorTo: string;
  textColor: string;
  cardStyle: "solid" | "glass" | "outline";
  cardColor: string;
  cardOpacity: number;
  fontFamily: "inter" | "poppins" | "space-grotesk" | "playfair";
  avatarUrl: string | null;
  buttonTextColor: string;
  buttonRadius: number;
  buttonBorderWidth: number;
  buttonShadow: boolean;
  links: BioLinkItem[];
  publicUrl: string;
  totalClicks: number;
};

export type BioLinkAnalytics = {
  totalClicks: number;
  links: Array<{
    id: string;
    title: string;
    url: string;
    order: number;
    clicks: number;
  }>;
};

type PublicBioLinkPayload = {
  id: string;
  slug: string;
  displayName: string;
  bio: string | null;
  accentColor: string;
  buttonStyle: "filled" | "outlined" | "soft";
  backgroundType: "solid" | "gradient";
  backgroundColor: string;
  backgroundColorTo: string;
  textColor: string;
  cardStyle: "solid" | "glass" | "outline";
  cardColor: string;
  cardOpacity: number;
  fontFamily: "inter" | "poppins" | "space-grotesk" | "playfair";
  avatarUrl: string | null;
  buttonTextColor: string;
  buttonRadius: number;
  buttonBorderWidth: number;
  buttonShadow: boolean;
  links: Array<{
    id: string;
    title: string;
    clickUrl: string;
  }>;
};

export function useBioLinkQuery(workspaceId: string) {
  return useQuery({
    queryKey: ["biolink", workspaceId],
    queryFn: () => apiRequest<BioLinkProfile>("/api/v1/biolink", { workspaceId }),
    enabled: Boolean(workspaceId)
  });
}

export function useBioLinkAnalyticsQuery(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: ["biolink", "analytics", workspaceId],
    queryFn: () => apiRequest<BioLinkAnalytics>("/api/v1/biolink/analytics", { workspaceId }),
    enabled: enabled && Boolean(workspaceId)
  });
}

export function useUpdateBioLinkMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      displayName: string;
      bio?: string;
      accentColor?: string;
      theme?: string;
      buttonStyle?: "filled" | "outlined" | "soft";
      slug?: string;
      backgroundType?: "solid" | "gradient";
      backgroundColor?: string;
      backgroundColorTo?: string;
      textColor?: string;
      cardStyle?: "solid" | "glass" | "outline";
      cardColor?: string;
      cardOpacity?: number;
      fontFamily?: "inter" | "poppins" | "space-grotesk" | "playfair";
      avatarUrl?: string;
      buttonTextColor?: string;
      buttonRadius?: number;
      buttonBorderWidth?: number;
      buttonShadow?: boolean;
    }) =>
      apiRequest<BioLinkProfile>("/api/v1/biolink", {
        method: "PUT",
        workspaceId,
        body: payload
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["biolink", workspaceId] });
      toast.success("Bio link updated");
    },
    onError: (error) => toast.error((error as Error).message)
  });
}

export function useCreateBioLinkItemMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { title: string; url: string }) =>
      apiRequest<BioLinkItem>("/api/v1/biolink/links", {
        method: "POST",
        workspaceId,
        body: payload
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["biolink", workspaceId] });
    },
    onError: (error) => toast.error((error as Error).message)
  });
}

export function useUpdateBioLinkItemMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string; title: string; url: string }) =>
      apiRequest<BioLinkItem>(`/api/v1/biolink/links/item/${payload.id}`, {
        method: "PUT",
        workspaceId,
        body: { title: payload.title, url: payload.url }
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["biolink", workspaceId] });
    },
    onError: (error) => toast.error((error as Error).message)
  });
}

export function useDeleteBioLinkItemMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/api/v1/biolink/links/item/${id}`, {
        method: "DELETE",
        workspaceId
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["biolink", workspaceId] });
    },
    onError: (error) => toast.error((error as Error).message)
  });
}

export function useReorderBioLinkItemsMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (linkIds: string[]) =>
      apiRequest<BioLinkItem[]>("/api/v1/biolink/links/reorder", {
        method: "PUT",
        workspaceId,
        body: { linkIds }
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["biolink", workspaceId] });
    },
    onError: (error) => toast.error((error as Error).message)
  });
}

export async function getPublicBioLink(slug: string) {
  return apiRequest<PublicBioLinkPayload>(`/api/v1/public/biolink?slug=${encodeURIComponent(slug)}`, {
    token: null
  });
}
