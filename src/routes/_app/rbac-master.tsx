import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformAdminRoute } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getRbacOverview, grantPlan, updateRolePermissions } from "@/lib/api/admin-rbac-api";

export const Route = createFileRoute("/_app/rbac-master")({
  head: () => ({ meta: [{ title: "RBAC Master — Admin" }] }),
  component: RbacMasterRoute,
});

function RbacMasterRoute() {
  return (
    <PlatformAdminRoute>
      <RbacMasterPage />
    </PlatformAdminRoute>
  );
}

function RbacMasterPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [grantOpen, setGrantOpen] = useState(false);

  const overviewQuery = useQuery({
    queryKey: ["rbac-overview"],
    queryFn: getRbacOverview,
  });

  const data = overviewQuery.data;

  const filteredRoles = (data?.roles ?? []).filter(
    (r) =>
      !search ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.key.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        eyebrow="Platform admin"
        title="RBAC Master"
        description="Manage roles, permissions and grant plans across the platform."
        actions={
          <Button
            size="sm"
            className="gap-1.5 bg-brand-gradient text-primary-foreground shadow-glow hover:opacity-95"
            onClick={() => setGrantOpen(true)}
          >
            Grant plan
          </Button>
        }
      />

      <div className="space-y-6 p-4 sm:p-6 md:p-10">
        {overviewQuery.isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        ) : (
          <Tabs defaultValue="roles">
            <TabsList className="mb-4">
              <TabsTrigger value="roles">Roles ({data?.roles.length ?? 0})</TabsTrigger>
              <TabsTrigger value="modules">Modules ({data?.modules.length ?? 0})</TabsTrigger>
              <TabsTrigger value="policies">Policies ({data?.policies.length ?? 0})</TabsTrigger>
              <TabsTrigger value="admins">Super admins</TabsTrigger>
            </TabsList>

            <TabsContent value="roles">
              <div className="mb-4">
                <div className="relative max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search roles…"
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-4">
                {filteredRoles.map((role) => (
                  <RoleCard
                    key={role.key}
                    role={role}
                    allPermissions={(data?.modules ?? []).flatMap((m) =>
                      m.permissions.map((p) => ({ ...p, moduleName: m.name, moduleKey: m.key }))
                    )}
                    onUpdate={() =>
                      void queryClient.invalidateQueries({ queryKey: ["rbac-overview"] })
                    }
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="modules">
              <div className="space-y-4">
                {(data?.modules ?? []).map((mod) => (
                  <div key={mod.key} className="rounded-2xl border bg-card p-5 shadow-soft">
                    <div className="mb-3 flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <span className="font-display font-semibold">{mod.name}</span>
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                        {mod.key}
                      </code>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {mod.permissions.map((p) => (
                        <Badge key={p.key} variant="outline" className="font-mono text-xs">
                          {p.key}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="policies">
              <div className="rounded-2xl border bg-card shadow-soft overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-6 py-3 font-medium">Key</th>
                      <th className="px-4 py-3 font-medium">Effect</th>
                      <th className="px-4 py-3 font-medium">Role</th>
                      <th className="px-4 py-3 font-medium hidden md:table-cell">Module</th>
                      <th className="px-6 py-3 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.policies ?? []).map((policy) => (
                      <tr key={policy.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-6 py-3 font-mono text-xs">{policy.key}</td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={
                              policy.effect === "ALLOW"
                                ? "border-success/30 bg-success/10 text-success"
                                : "border-destructive/30 bg-destructive/10 text-destructive"
                            }
                          >
                            {policy.effect}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {policy.roleKey ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                          {policy.moduleKey ?? "—"}
                        </td>
                        <td className="px-6 py-3 text-xs text-muted-foreground">
                          {policy.description ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="admins">
              <div className="rounded-2xl border bg-card p-6 shadow-soft">
                <h2 className="mb-4 font-display font-semibold">Platform super admins</h2>
                {(data?.superAdmins ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No super admins found.</p>
                ) : (
                  <ul className="space-y-2">
                    {(data?.superAdmins ?? []).map((email) => (
                      <li
                        key={email}
                        className="flex items-center gap-2 rounded-lg border bg-muted/30 px-4 py-2 text-sm"
                      >
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        {email}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      <GrantPlanDialog
        open={grantOpen}
        onOpenChange={setGrantOpen}
        onSuccess={() => void queryClient.invalidateQueries({ queryKey: ["rbac-overview"] })}
      />
    </div>
  );
}

function RoleCard({
  role,
  allPermissions,
  onUpdate,
}: {
  role: { key: string; name: string; description: string | null; permissions: string[] };
  allPermissions: Array<{ key: string; action: string; moduleName: string; moduleKey: string }>;
  onUpdate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<string[]>(role.permissions);

  const updateMutation = useMutation({
    mutationFn: () => updateRolePermissions(role.key, selected),
    onSuccess: () => {
      toast.success(`${role.name} permissions updated`);
      onUpdate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const toggle = (key: string) =>
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );

  return (
    <div className="rounded-2xl border bg-card shadow-soft">
      <button
        className="flex w-full items-center justify-between px-6 py-4 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div>
          <span className="font-display font-semibold">{role.name}</span>
          <code className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{role.key}</code>
          {role.description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{role.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{role.permissions.length} permissions</span>
          <span className="text-muted-foreground">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>
      {expanded && (
        <div className="border-t px-6 pb-5 pt-4">
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {allPermissions.map((perm) => (
              <label key={perm.key} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={selected.includes(perm.key)}
                  onCheckedChange={() => toggle(perm.key)}
                />
                <span>
                  <span className="text-muted-foreground text-xs">{perm.moduleName} · </span>
                  {perm.action}
                </span>
              </label>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              size="sm"
              disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate()}
            >
              {updateMutation.isPending ? "Saving…" : "Save permissions"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function GrantPlanDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [workspaceId, setWorkspaceId] = useState("");
  const [plan, setPlan] = useState("PRO");
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: () => grantPlan({ workspaceId, plan, note: note || undefined }),
    onSuccess: () => {
      toast.success(`Plan ${plan} granted to workspace`);
      onSuccess();
      onOpenChange(false);
      setWorkspaceId("");
      setNote("");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Grant plan</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Workspace ID</Label>
            <Input
              placeholder="ws_..."
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Plan</Label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
            >
              {["FREE", "STARTER", "PRO", "BUSINESS", "AGENCY"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Note (internal)</Label>
            <Input
              placeholder="Reason for grant…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={mutation.isPending || !workspaceId.trim()}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Granting…" : "Grant plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
