import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Info, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformPermissionRoute } from "@/components/auth/guards";
import { UserMultiSelect } from "@/components/access/user-multi-select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  applyAccessMatrix,
  getAccessCatalogue,
  getAccessState,
  getSharedWorkspaces,
  type AccessUser,
} from "@/lib/api/access-api";

const USER_MANAGE = "platform:user_manage";

/** A cell is on for everyone, off for everyone, or mixed across the selected users. */
type TriState = boolean | "indeterminate";

export const Route = createFileRoute("/_app/access-management")({
  head: () => ({ meta: [{ title: "Access Management — Admin" }] }),
  component: AccessManagementRoute,
});

function AccessManagementRoute() {
  return (
    <PlatformPermissionRoute permission={USER_MANAGE}>
      <AccessManagementPage />
    </PlatformPermissionRoute>
  );
}

/** Backend orders the columns (common CRUD first); this only makes the labels readable. */
const prettyAction = (action: string) =>
  ({ read: "View", create: "Create", update: "Edit / Update", delete: "Delete", export: "Export" })[
    action
  ] ?? action.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

function AccessManagementPage() {
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [reason, setReason] = useState("");
  /** The permission set being composed. `null` until the current state has loaded. */
  const [ticked, setTicked] = useState<Set<string> | null>(null);

  const userIds = users.map((u) => u.id);

  const catalogueQuery = useQuery({
    queryKey: ["access-catalogue"],
    queryFn: getAccessCatalogue,
    staleTime: 5 * 60 * 1000,
  });

  const workspacesQuery = useQuery({
    queryKey: ["access-workspaces", userIds.join(",")],
    queryFn: () => getSharedWorkspaces(userIds),
    enabled: userIds.length > 0,
  });

  const stateQuery = useQuery({
    queryKey: ["access-state", userIds.join(","), workspaceId],
    queryFn: () => getAccessState(userIds, workspaceId),
    enabled: userIds.length > 0 && !!workspaceId,
  });

  // A workspace stays selected only while every selected user is still a member of it.
  useEffect(() => {
    const options = workspacesQuery.data?.items ?? [];
    if (workspaceId && !options.some((w) => w.workspaceId === workspaceId)) setWorkspaceId("");
    if (!workspaceId && options.length === 1) setWorkspaceId(options[0].workspaceId);
  }, [workspacesQuery.data, workspaceId]);

  // Memoised: a fresh `[]` each render would re-run every downstream memo/effect.
  const states = useMemo(() => stateQuery.data?.items ?? [], [stateQuery.data]);

  // Seed the matrix from what the selected users actually have. Where they disagree the cell is
  // indeterminate, and the operator must resolve it before it can be written.
  const seeded = useMemo(() => {
    if (states.length === 0) return null;
    const counts = new Map<string, number>();
    for (const s of states) {
      for (const key of s.effectivePermissions) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return { counts, total: states.length };
  }, [states]);

  useEffect(() => {
    if (!seeded) {
      setTicked(null);
      return;
    }
    // Start from the permissions every selected user already has; mixed cells render as
    // indeterminate off `mixedKeys` below rather than being silently granted or revoked.
    const all = new Set<string>();
    for (const [key, n] of seeded.counts) if (n === seeded.total) all.add(key);
    setTicked(all);
  }, [seeded]);

  const mixedKeys = useMemo(() => {
    const out = new Set<string>();
    if (!seeded) return out;
    for (const [key, n] of seeded.counts) if (n > 0 && n < seeded.total) out.add(key);
    return out;
  }, [seeded]);

  /** Cells the operator has explicitly resolved stop being "mixed". */
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  useEffect(() => setResolved(new Set()), [seeded]);

  const cellState = (key: string): TriState => {
    if (mixedKeys.has(key) && !resolved.has(key)) return "indeterminate";
    return ticked?.has(key) ?? false;
  };

  const setCell = (key: string, next: boolean) => {
    setResolved((prev) => new Set(prev).add(key));
    setTicked((prev) => {
      const copy = new Set(prev ?? []);
      if (next) copy.add(key);
      else copy.delete(key);
      return copy;
    });
  };

  const unresolvedCount = useMemo(
    () => Array.from(mixedKeys).filter((k) => !resolved.has(k)).length,
    [mixedKeys, resolved]
  );

  const catalogue = catalogueQuery.data;

  const mutation = useMutation({
    mutationFn: () =>
      applyAccessMatrix({
        userIds,
        workspaceId,
        permissionKeys: Array.from(ticked ?? []),
        reason: reason.trim() || null,
      }),
    onSuccess: (res) => {
      toast.success(`Access updated for ${res.applied} user${res.applied === 1 ? "" : "s"}`);
      setReason("");
      void stateQuery.refetch();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const ready = userIds.length > 0 && !!workspaceId && !!ticked && !!catalogue;
  const immutable = states.filter((s) => s.isImmutable);

  return (
    <div>
      <PageHeader
        eyebrow="Platform admin"
        title="Access Management"
        description="Pick users, pick a workspace, and set exactly what they can do."
        actions={
          <Button
            size="sm"
            className="gap-1.5 bg-brand-gradient text-primary-foreground shadow-glow hover:opacity-95"
            disabled={!ready || mutation.isPending || immutable.length > 0}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending
              ? "Saving…"
              : `Save access${userIds.length > 1 ? ` (${userIds.length} users)` : ""}`}
          </Button>
        }
      />

      <div className="space-y-5 p-4 sm:p-6 md:p-10">
        <div className="grid gap-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-sm">Users</Label>
            <UserMultiSelect selected={users} onChange={setUsers} />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Workspace</Label>
            <Select
              value={workspaceId}
              onValueChange={setWorkspaceId}
              disabled={userIds.length === 0 || (workspacesQuery.data?.items.length ?? 0) === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    userIds.length === 0
                      ? "Select users first"
                      : workspacesQuery.isLoading
                        ? "Loading…"
                        : (workspacesQuery.data?.items.length ?? 0) === 0
                          ? "No workspace shared by all selected users"
                          : "Select a workspace"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {(workspacesQuery.data?.items ?? []).map((w) => (
                  <SelectItem key={w.workspaceId} value={w.workspaceId}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {userIds.length > 1 && (
              <p className="text-xs text-muted-foreground">
                Only workspaces all {userIds.length} selected users belong to are listed.
              </p>
            )}
          </div>
        </div>

        {states.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {states.map((s) => (
              <Badge key={s.userId} variant="outline" className="font-normal">
                {s.email}
                {s.role && <span className="ml-1 text-muted-foreground">· {s.role.name}</span>}
              </Badge>
            ))}
          </div>
        )}

        {immutable.length > 0 && (
          <Banner tone="danger" icon={<AlertTriangle className="h-4 w-4" />}>
            {immutable.map((i) => i.email).join(", ")}{" "}
            {immutable.length === 1 ? "is" : "are"} an environment-configured super admin and cannot
            be modified. Remove {immutable.length === 1 ? "them" : "those users"} from the selection
            to continue.
          </Banner>
        )}

        {unresolvedCount > 0 && (
          <Banner tone="warning" icon={<AlertTriangle className="h-4 w-4" />}>
            {unresolvedCount} permission{unresolvedCount === 1 ? "" : "s"} differ between the
            selected users (shown as <span className="font-medium">–</span>). Click each one to
            decide, or save to apply the matrix exactly as shown to everyone.
          </Banner>
        )}

        {ready && (
          <Banner tone="info" icon={<Info className="h-4 w-4" />}>
            A tick is the user&apos;s <span className="font-medium">effective</span> permission.
            Unticking something their role grants writes a per-user denial, so it applies to them
            without changing the role for anyone else.
          </Banner>
        )}

        {!ready ? (
          <EmptyOrLoading
            loading={catalogueQuery.isLoading || stateQuery.isLoading}
            hasUsers={userIds.length > 0}
            hasWorkspace={!!workspaceId}
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
            {/* The matrix is intentionally wide; it scrolls inside this container so the page
                body never scrolls sideways on a phone. */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="sticky left-0 z-10 bg-muted/50 px-4 py-3 text-left font-medium">
                      Module / Feature
                    </th>
                    {catalogue!.actions.map((action) => (
                      <th key={action} className="px-4 py-3 text-center font-medium">
                        {prettyAction(action)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <AllModulesRow
                    actions={catalogue!.actions}
                    modules={catalogue!.modules}
                    ticked={ticked!}
                    onBulk={(keys, next) => {
                      setResolved((prev) => {
                        const copy = new Set(prev);
                        keys.forEach((k) => copy.add(k));
                        return copy;
                      });
                      setTicked((prev) => {
                        const copy = new Set(prev ?? []);
                        keys.forEach((k) => (next ? copy.add(k) : copy.delete(k)));
                        return copy;
                      });
                    }}
                  />
                  {catalogue!.modules.map((mod) => (
                    <tr key={mod.key} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="sticky left-0 z-10 bg-card px-4 py-2.5">
                        <span className="block">{mod.name}</span>
                        <code className="text-[11px] text-muted-foreground">{mod.key}</code>
                      </td>
                      {catalogue!.actions.map((action) => {
                        const perm = mod.permissions.find((p) => p.action === action);
                        return (
                          <td key={action} className="px-4 py-2.5 text-center">
                            {perm ? (
                              <Checkbox
                                checked={cellState(perm.key)}
                                onCheckedChange={(v) => setCell(perm.key, v === true)}
                                aria-label={`${mod.name} ${prettyAction(action)}`}
                                className="mx-auto"
                              />
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {ready && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full space-y-2 sm:max-w-md">
              <Label className="text-sm">Reason (recorded in the audit log)</Label>
              <Input
                value={reason}
                maxLength={500}
                placeholder="e.g. onboarding new support team"
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <Button
              className="bg-brand-gradient text-primary-foreground shadow-glow hover:opacity-95"
              disabled={mutation.isPending || immutable.length > 0}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending
                ? "Saving…"
                : `Save access${userIds.length > 1 ? ` (${userIds.length} users)` : ""}`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function AllModulesRow({
  actions,
  modules,
  ticked,
  onBulk,
}: {
  actions: string[];
  modules: Array<{ permissions: Array<{ key: string; action: string }> }>;
  ticked: Set<string>;
  onBulk: (keys: string[], next: boolean) => void;
}) {
  return (
    <tr className="border-b bg-muted/20 font-medium">
      <td className="sticky left-0 z-10 bg-muted/20 px-4 py-2.5">All Modules</td>
      {actions.map((action) => {
        const keys = modules
          .flatMap((m) => m.permissions)
          .filter((p) => p.action === action)
          .map((p) => p.key);
        const on = keys.filter((k) => ticked.has(k)).length;
        const state: TriState = on === 0 ? false : on === keys.length ? true : "indeterminate";
        return (
          <td key={action} className="px-4 py-2.5 text-center">
            <Checkbox
              checked={state}
              onCheckedChange={(v) => onBulk(keys, v === true)}
              aria-label={`All modules ${action}`}
              className="mx-auto"
            />
          </td>
        );
      })}
    </tr>
  );
}

function Banner({
  tone,
  icon,
  children,
}: {
  tone: "info" | "warning" | "danger";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const toneClass = {
    info: "border-primary/30 bg-primary/5 text-foreground",
    warning: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    danger: "border-destructive/40 bg-destructive/10 text-destructive",
  }[tone];
  return (
    <div className={`flex items-start gap-2 rounded-xl border p-3 text-xs ${toneClass}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p>{children}</p>
    </div>
  );
}

function EmptyOrLoading({
  loading,
  hasUsers,
  hasWorkspace,
}: {
  loading: boolean;
  hasUsers: boolean;
  hasWorkspace: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-dashed bg-card/50 p-10 text-center">
      <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        {!hasUsers
          ? "Select one or more users to begin."
          : !hasWorkspace
            ? "Select a workspace to load the permission matrix."
            : "Nothing to show."}
      </p>
    </div>
  );
}
