import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { apiRequest } from "@/lib/api";

export type BioLinkItem = {
  id: string;
  title: string;
  url: string;
  order: number;
};
export type BioLinkSocialItem = {
  id: string;
  label: string;
  url: string;
  icon: string | null;
  emoji: string | null;
  platform?: "custom" | "instagram";
  mode?: "link" | "profile" | "posts" | "reels";
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
  sectionOrder: Array<"links" | "socials">;
  socialLayout: "horizontal" | "vertical";
  links: BioLinkItem[];
  socials: BioLinkSocialItem[];
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
  sectionOrder: Array<"links" | "socials">;
  socialLayout: "horizontal" | "vertical";
  links: Array<{
    id: string;
    title: string;
    clickUrl: string;
  }>;
  socials: Array<{
    id: string;
    label: string;
    icon: string | null;
    emoji: string | null;
    platform?: "custom" | "instagram";
    mode?: "link" | "profile" | "posts" | "reels";
    mediaItems?: Array<{ id: string; mediaUrl?: string; permalink?: string }>;
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
      sectionOrder?: Array<"links" | "socials">;
      socialLayout?: "horizontal" | "vertical";
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

export function useCreateBioLinkSocialMutation(workspaceId: string) {
  return useMutation({
    mutationFn: (payload: { label: string; url: string; icon?: string; emoji?: string; platform?: "custom" | "instagram"; mode?: "link" | "profile" | "posts" | "reels" }) =>
      apiRequest<BioLinkSocialItem>("/api/v1/biolink/socials", {
        method: "POST",
        workspaceId,
        body: payload
      })
  });
}

export function useUpdateBioLinkSocialMutation(workspaceId: string) {
  return useMutation({
    mutationFn: (payload: { id: string; label: string; url: string; icon?: string; emoji?: string; platform?: "custom" | "instagram"; mode?: "link" | "profile" | "posts" | "reels" }) =>
      apiRequest<BioLinkSocialItem>(`/api/v1/biolink/socials/item/${payload.id}`, {
        method: "PUT",
        workspaceId,
        body: payload
      })
  });
}

export function useDeleteBioLinkSocialMutation(workspaceId: string) {
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/api/v1/biolink/socials/item/${id}`, {
        method: "DELETE",
        workspaceId
      })
  });
}

export function useReorderBioLinkSocialsMutation(workspaceId: string) {
  return useMutation({
    mutationFn: (linkIds: string[]) =>
      apiRequest<BioLinkSocialItem[]>("/api/v1/biolink/socials/reorder", {
        method: "PUT",
        workspaceId,
        body: { linkIds }
      })
  });
}

export function useResetBioLinkMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<void>("/api/v1/biolink/reset", {
        method: "POST",
        workspaceId
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["biolink", workspaceId] });
      toast.success("Bio link reset to defaults");
    },
    onError: (error) => toast.error((error as Error).message)
  });
}

export async function getPublicBioLink(slug: string) {
  return apiRequest<PublicBioLinkPayload>(`/api/v1/public/biolink?slug=${encodeURIComponent(slug)}`, {
    token: null
  });
}
