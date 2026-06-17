import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

export type RbacOverview = {
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

export function getRbacOverview() {
  return apiRequest<RbacOverview>(apiUri.admin.rbac.overview);
}

export function updateRolePermissions(roleKey: string, permissionKeys: string[]) {
  return apiRequest<void>(apiUri.admin.rbac.rolePermissions(roleKey), {
    method: "PUT",
    body: { permissionKeys },
  });
}

export function updateUserWorkspaceAccess(
  userId: string,
  workspaceId: string,
  body: Record<string, unknown>
) {
  return apiRequest<void>(apiUri.admin.rbac.userWorkspaceAccess(userId, workspaceId), {
    method: "PUT",
    body,
  });
}

export function grantPlan(body: { workspaceId: string; plan: string; note?: string }) {
  return apiRequest<unknown>(apiUri.admin.rbac.grantPlan, { method: "POST", body });
}

export function getAdminWorkspaceSubscription(workspaceId: string) {
  return apiRequest<unknown>(apiUri.admin.rbac.subscription(workspaceId));
}
