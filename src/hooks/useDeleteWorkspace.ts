import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export function useDeleteWorkspaceMutation(onDeleted?: (workspaceId: string) => Promise<void> | void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (workspaceId: string) =>
      apiRequest<void>(`/api/v1/workspaces/${workspaceId}`, {
        method: "DELETE"
      }),
    onSuccess: async (_, workspaceId) => {
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (onDeleted) {
        await onDeleted(workspaceId);
      }
    }
  });
}
