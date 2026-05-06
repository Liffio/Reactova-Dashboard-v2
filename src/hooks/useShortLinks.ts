import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export type ShortLinkItem = {
  id: string;
  name: string;
  slug: string;
  destination: string;
  clickCount: number;
  createdAt: string;
  shortUrl: string;
};

type CreateShortLinkInput = {
  workspaceId: string;
  name: string;
  destination: string;
  slug?: string;
};

export function useShortLinksQuery(workspaceId: string) {
  return useQuery({
    queryKey: ["shortlinks", workspaceId],
    queryFn: () => apiRequest<ShortLinkItem[]>("/api/v1/shortlinks", { workspaceId }),
    enabled: Boolean(workspaceId)
  });
}

export function useCreateShortLinkMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, name, destination, slug }: CreateShortLinkInput) =>
      apiRequest<ShortLinkItem>("/api/v1/shortlinks", {
        workspaceId,
        method: "POST",
        body: { name, destination, slug: slug?.trim() || undefined }
      }),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["shortlinks", variables.workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", variables.workspaceId] });
    }
  });
}

export function useDeleteShortLinkMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/api/v1/shortlinks/${id}`, {
        workspaceId,
        method: "DELETE"
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["shortlinks", workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
    }
  });
}
