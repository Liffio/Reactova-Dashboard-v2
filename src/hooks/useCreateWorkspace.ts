import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

type CreateWorkspaceInput = {
  name?: string;
};

export function useCreateWorkspaceMutation(onCreated?: (workspaceId: string) => Promise<void> | void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateWorkspaceInput) =>
      apiRequest<{ id: string }>("/api/v1/workspaces", {
        method: "POST",
        body: {
          name: input.name?.trim() || undefined
        }
      }),
    onSuccess: async (workspace) => {
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      if (onCreated) {
        await onCreated(workspace.id);
      }
    }
  });
}
