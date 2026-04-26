import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

type RbacOverview = {
  superAdmins: string[];
  modules: Array<{
    id: string;
    key: string;
    name: string;
    permissions: Array<{ id: string; key: string; action: string }>;
  }>;
  roles: Array<{
    id: string;
    key: string;
    name: string;
    description: string | null;
    permissions: string[];
  }>;
  policies: Array<{
    id: string;
    key: string;
    effect: "ALLOW" | "DENY";
    roleKey: string | null;
    moduleKey: string | null;
    action: string | null;
    priority: number;
    description: string | null;
  }>;
};

export function useRbacOverviewQuery() {
  return useQuery({
    queryKey: ["rbac-overview"],
    queryFn: () => apiRequest<RbacOverview>("/api/v1/admin/rbac/overview")
  });
}

export function useUpdateRolePermissionsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { roleKey: string; permissionKeys: string[] }) =>
      apiRequest<void>(`/api/v1/admin/rbac/roles/${input.roleKey}/permissions`, {
        method: "PUT",
        body: { permissionKeys: input.permissionKeys }
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rbac-overview"] });
    }
  });
}
