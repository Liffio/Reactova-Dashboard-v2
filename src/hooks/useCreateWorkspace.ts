import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

type CreateWorkspaceInput = {
  igHandle?: string;
  plan: "FREE" | "STARTER" | "PRO" | "BUSINESS" | "AGENCY";
};

export function useCreateWorkspaceMutation(onCreated?: (workspaceId: string) => Promise<void> | void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateWorkspaceInput) =>
      apiRequest<{ id: string }>("/api/v1/workspaces", {
        method: "POST",
        body: {
          igHandle: input.igHandle,
          plan: input.plan
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
