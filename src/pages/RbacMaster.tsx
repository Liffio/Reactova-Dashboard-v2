import { useMemo, useState } from "react";
import { Shield, Save } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useRbacOverviewQuery, useUpdateRolePermissionsMutation } from "@/hooks/useRbacMaster";

export default function RbacMaster() {
  const overviewQuery = useRbacOverviewQuery();
  const updateRoleMutation = useUpdateRolePermissionsMutation();
  const [activeRoleKey, setActiveRoleKey] = useState<string>("");
  const [draftPermissions, setDraftPermissions] = useState<Set<string>>(new Set());

  const roles = overviewQuery.data?.roles ?? [];
  const allPermissions = useMemo(
    () =>
      (overviewQuery.data?.modules ?? []).flatMap((module) =>
        module.permissions.map((permission) => ({
          ...permission,
          moduleName: module.name
        }))
      ),
    [overviewQuery.data]
  );

  const activeRole =
    roles.find((role) => role.key === activeRoleKey) ??
    roles.find((role) => role.key !== "SUPER_ADMIN") ??
    null;

  const activeKey = activeRole?.key ?? "";
  const canEdit = activeRole?.key !== "SUPER_ADMIN";

  const syncDraft = (roleKey: string) => {
    const role = roles.find((item) => item.key === roleKey);
    setActiveRoleKey(roleKey);
    setDraftPermissions(new Set(role?.permissions ?? []));
  };

  const togglePermission = (permissionKey: string) => {
    setDraftPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(permissionKey)) {
        next.delete(permissionKey);
      } else {
        next.add(permissionKey);
      }
      return next;
    });
  };

  return (
    <DashboardLayout title="RBAC Master" subtitle="Manage global roles, permissions, and policy visibility.">
      <section className="rounded-xl bg-card border border-border p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Shield className="h-4 w-4 text-primary" />
          <span>Immutable super admins: {(overviewQuery.data?.superAdmins ?? []).join(", ") || "None configured"}</span>
        </div>
      </section>

      <section className="grid lg:grid-cols-[260px_1fr] gap-4 mt-5">
        <div className="rounded-xl bg-card border border-border p-4">
          <h3 className="font-semibold mb-3">Roles</h3>
          <div className="space-y-2">
            {roles.map((role) => (
              <button
                key={role.key}
                onClick={() => syncDraft(role.key)}
                className={`w-full text-left px-3 py-2 rounded-lg border text-sm ${
                  (activeRoleKey || activeRole?.key) === role.key
                    ? "border-primary text-primary bg-primary/10"
                    : "border-border hover:bg-background"
                }`}
              >
                <div className="font-medium">{role.name}</div>
                <div className="text-xs text-muted-foreground">{role.key}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Permissions {activeRole ? `for ${activeRole.name}` : ""}</h3>
              <p className="text-xs text-muted-foreground">
                {canEdit
                  ? "Toggle module permissions and save role matrix."
                  : "SUPER_ADMIN permissions are immutable."}
              </p>
            </div>
            <Button
              disabled={!canEdit || !activeKey || updateRoleMutation.isPending}
              onClick={async () => {
                if (!activeKey || !canEdit) return;
                await updateRoleMutation.mutateAsync({
                  roleKey: activeKey,
                  permissionKeys: Array.from(draftPermissions.values()).sort()
                });
              }}
            >
              <Save className="h-4 w-4" />
              Save Role Permissions
            </Button>
          </div>

          {overviewQuery.isLoading && <p className="text-sm text-muted-foreground">Loading RBAC overview...</p>}
          {overviewQuery.error && (
            <p className="text-sm text-destructive">{(overviewQuery.error as Error).message}</p>
          )}

          <div className="grid md:grid-cols-2 gap-2">
            {allPermissions.map((permission) => (
              <label
                key={permission.key}
                className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm"
              >
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={draftPermissions.has(permission.key)}
                  onChange={() => togglePermission(permission.key)}
                />
                <span className="flex-1">
                  <span className="font-medium">{permission.key}</span>
                  <span className="text-xs text-muted-foreground block">{permission.moduleName}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </section>
    </DashboardLayout>
  );
}
