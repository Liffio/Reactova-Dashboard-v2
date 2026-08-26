import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  ChevronRight,
  KeyRound,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldQuestion,
} from "lucide-react";

import { PlatformPermissionRoute } from "@/components/auth/guards";
import { PageErrorBoundary } from "@/components/error-boundary";
import { BackLink, CopyableKey, EmptyState, FormActions } from "@/components/admin/form-page";
import { EnforcementBadge } from "@/components/admin/enforcement-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatDateTime, formatHandle } from "@/lib/format";
import { toast } from "@/lib/toast";
import { ApiError } from "@/lib/api/http";
import { usePlatformCan } from "@/hooks/use-platform-authz";
import { getRegistryTree, listPackages, type PackageRow } from "@/lib/api/registry-api";
import { getRbacOverview, type RbacOverview } from "@/lib/api/admin-rbac-api";
import {
  assignWorkspacePackageAdmin,
  unassignWorkspacePackageAdmin,
  patchWorkspaceLimits,
  listWorkspaceInstagramAccounts,
  refreshWorkspaceInstagramToken,
  listWorkspaceDmJobs,
  listWorkspaceInvitesAdmin,
  resendWorkspaceInviteAdmin,
  revokeWorkspaceInviteAdmin,
  type AdminDmJobStatus,
  type AdminIgAccountHealth,
  type AdminWorkspaceInvite,
} from "@/lib/api/admin-workspaces-api";
import {
  getAdminUserWorkspaces,
  getEffectiveAccess,
  bulkSetUserModuleOverrides,
  createUserPermissionOverride,
  deleteUserPermissionOverride,
  changeUserWorkspaceRole,
  assignUserPolicy,
  removeUserPolicy,
  type AdminUserEffectiveAccess,
  type BulkModuleOverrideChangeInput,
  type BulkModuleOverrideEffect,
  type EffectiveAccessChild,
  type EffectiveAccessDecidedBy,
  type EffectiveAccessLayer,
  type EffectiveAccessPermission,
  type EffectiveAccessTraceEntry,
} from "@/lib/api/admin-users-api";

/**
 * Access drill-down (Task 10) — read-only. Reachable from a row in the Workspaces tab
 * (`admin.users.$userId.workspaces.tsx`). Filename uses the trailing-underscore escape
 * (`workspaces_.$wsId`) rather than the brief's literal `workspaces.$wsId`: verified empirically
 * (build + inspecting `routeTree.gen.ts`) that a plain-dot `workspaces.$wsId.tsx` nests under
 * `admin.users.$userId.workspaces.tsx` — which, being a leaf with no `<Outlet/>` (Task 8 built it
 * as a plain table), would swallow this route and render nothing. The escape makes it a SIBLING
 * of the four tab routes under the shell (`admin.users.$userId.tsx`, which does render an
 * `<Outlet/>`) instead — exactly the same fix already precedented in this codebase for
 * `admin.plugins_.docs.tsx` escaping `admin.plugins.tsx`, and exactly what the pre-flight conflict
 * scan in `plan/PHASE-3-user-management.md` calls for ("drill-down is a sibling route under
 * $userId"). The URL is unaffected — `path: '/workspaces/$wsId'` in the generated tree, no
 * literal underscore reaches the browser.
 */

const USER_MANAGE = "platform:user_manage";
/** Gates package assign/unassign and the limits PATCH — task-11-report.md §3's route table.
 *  Distinct from `USER_MANAGE`, which gates the page itself plus every Task 12 endpoint (module
 *  bulk, permission overrides, role, policy) — an operator can hold one without the other, so
 *  each mutation section gates independently rather than assuming the page-level grant covers
 *  everything on it (requirement 9). */
const PACKAGE_MANAGE = "platform:package_manage";
/** Gates the light support-ops surfaces (Task 22 §6.9, Task 23 item 5) — Instagram health,
 *  DM job history, and invite management, all `platform:workspace_manage`-gated server-side.
 *  A third, independent axis from `USER_MANAGE`/`PACKAGE_MANAGE` above (requirement 9). */
const WORKSPACE_MANAGE = "platform:workspace_manage";

export const Route = createFileRoute("/_app/admin/users/$userId/workspaces_/$wsId")({
  head: () => ({ meta: [{ title: "Workspace Access — User — Admin" }] }),
  component: EffectiveAccessRoute,
});

function EffectiveAccessRoute() {
  return (
    <PlatformPermissionRoute permission={USER_MANAGE}>
      <PageErrorBoundary label="admin-user-effective-access">
        <EffectiveAccessPage />
      </PageErrorBoundary>
    </PlatformPermissionRoute>
  );
}

/** What's selected in the left pane — a module-tree child or a permission — drives the right
 *  pane's provenance trace. Local, ephemeral; never persisted, never a query param. */
type Selection =
  | { kind: "child"; parentKey: string; childKey: string }
  | { kind: "permission"; key: string }
  | null;

/** Below this total child count, every parent starts expanded — above it, collapsed. An operator
 *  scanning a handful of modules wants everything visible at once; scanning the full ~125-child
 *  tree wants to open only what they're looking for (the filter box is the primary tool there).
 *  No contract value pins this threshold, so it's a judgment call, called out per the brief. */
const AUTO_EXPAND_CHILD_THRESHOLD = 40;

/** A module/permission row's three-state control. `"INHERIT"` means "no override — clear it if
 *  one exists"; this is intentionally NOT a boolean, per the brief: "Inherit" must be distinct
 *  from "explicitly allow" because they resolve differently once ABAC/plugin layers are added
 *  later, even though both currently read as an effective ALLOW in some cases. */
type ControlState = "INHERIT" | "ALLOW" | "DENY";

/** The staging map's value uses the bulk endpoint's own vocabulary (`ALLOW`/`DENY`/`CLEAR`) —
 *  `"CLEAR"` is what actually gets sent for a row staged back to Inherit; `ControlState`'s
 *  `"INHERIT"` never appears as a map value, only as a row's *baseline* or *display* state. */
type StageMap = Map<string, BulkModuleOverrideEffect>;

/** Thin wrapper: extracts route params and remounts `EffectiveAccessPageInner` (keyed on
 *  `userId:wsId`) on every param change. All local UI state — filter, selection, expand/collapse,
 *  and every Task 13 staging map/dialog — lives in the Inner component, so a fresh key is a full,
 *  effect-free reset (hygiene requirement 10) rather than a bespoke `useEffect` watching two
 *  params to manually clear half a dozen `useState`s. */
function EffectiveAccessPage() {
  const { userId, wsId } = useParams({
    from: "/_app/admin/users/$userId/workspaces_/$wsId",
  });
  return <EffectiveAccessPageInner key={`${userId}:${wsId}`} userId={userId} wsId={wsId} />;
}

function EffectiveAccessPageInner({ userId, wsId }: { userId: string; wsId: string }) {
  const queryClient = useQueryClient();
  const canEditAccess = usePlatformCan(USER_MANAGE);
  const canManagePackage = usePlatformCan(PACKAGE_MANAGE);

  // Reuses the Workspaces tab's exact query key/fn — if that tab was visited first (the only way
  // to reach this route today), this is a cache hit, not a second round trip. The effective-access
  // contract itself carries no workspace name/id, so this is the only source for display purposes.
  const workspacesQuery = useQuery({
    queryKey: ["admin-user", userId, "workspaces"],
    queryFn: () => getAdminUserWorkspaces(userId),
  });
  const membership = workspacesQuery.data?.items.find((w) => w.workspaceId === wsId);

  const accessQuery = useQuery({
    queryKey: ["admin-user", userId, "effective-access", wsId],
    queryFn: () => getEffectiveAccess(userId, wsId),
  });

  /**
   * `key -> id` lookups the mutation endpoints need but the effective-access response never
   * carries (`EffectiveAccessChild`/`EffectiveAccessPermission` only expose `key`, never the row's
   * own uuid — confirmed against both the resolver source and task-11/12-report.md's verbatim
   * request bodies, which require `childModuleId`/`permissionId`). Both catalogues already exist
   * and are already used elsewhere in the admin console — reused here rather than inventing a
   * third read endpoint: `getRegistryTree()` backs `/module-registry` and carries `{id, key}` per
   * child module; `getRbacOverview()` backs `/rbac-master` and carries `{id, key}` per permission
   * (plus the role and ABAC-policy catalogues the role/ABAC sections below also need).
   */
  const registryQuery = useQuery({
    queryKey: ["admin-registry-tree"],
    queryFn: getRegistryTree,
    staleTime: 5 * 60 * 1000,
    enabled: canEditAccess,
  });
  const rbacQuery = useQuery({
    queryKey: ["admin-rbac-overview"],
    queryFn: getRbacOverview,
    staleTime: 5 * 60 * 1000,
    enabled: canEditAccess,
  });

  // The Select's source list — reuses the existing packages catalogue (`packages.assign.tsx` uses
  // the exact same call) rather than a second read endpoint, per the brief's explicit instruction.
  // The catalogue is small (a handful in production, per that route's own comment) so one page is
  // every package, same precedent.
  const packagesQuery = useQuery({
    queryKey: ["packages", "all-for-assign"],
    queryFn: () => listPackages({ page: 1, limit: 100 }),
    staleTime: 5 * 60 * 1000,
    enabled: canManagePackage,
  });

  const childIdByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of registryQuery.data?.modules ?? []) {
      for (const c of m.children) map.set(c.key, c.id);
    }
    return map;
  }, [registryQuery.data]);

  const permissionIdByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of rbacQuery.data?.modules ?? []) {
      for (const p of m.permissions) map.set(p.key, p.id);
    }
    return map;
  }, [rbacQuery.data]);

  const [filterText, setFilterText] = useState("");
  const [selection, setSelection] = useState<Selection>(null);
  const [expandedParents, setExpandedParents] = useState<Set<string> | null>(null);

  // ── Task 13 staging (requirement 4) ──────────────────────────────────────────────────────────
  // Local maps of key -> the diff vs the resolver's committed state. Never mutated by anything
  // that issues a network call — only `CommitDialog`'s confirm handler does that, and only once,
  // for the whole batch. Both keyed by the row's `key` (not its uuid) so `ChildRow`/permission-row
  // rendering never needs the id lookups above; ids are resolved once, at commit time.
  const [stagedModules, setStagedModules] = useState<StageMap>(new Map());
  const [stagedPermissions, setStagedPermissions] = useState<StageMap>(new Map());
  // Off by default (requirement 3) — a page-level switch, not per-row, per the brief's wording.
  const [showNonEnforcing, setShowNonEnforcing] = useState(false);
  const [commitDialogOpen, setCommitDialogOpen] = useState(false);

  const data = accessQuery.data;

  const moduleBaseline = (child: EffectiveAccessChild): ControlState =>
    child.decidedBy === "USER_OVERRIDE" ? child.effective : "INHERIT";
  const permissionBaseline = (perm: EffectiveAccessPermission): ControlState =>
    perm.decidedBy === "USER_OVERRIDE" ? perm.effective : "INHERIT";

  /** Stages (or un-stages, if the new value matches the baseline — no real diff) one row's
   *  control. Shared by both module and permission rows; which map to write is the only thing
   *  that differs, so it's passed in rather than duplicating this function per map. */
  const stage = (
    setMap: Dispatch<SetStateAction<StageMap>>,
    key: string,
    baseline: ControlState,
    next: ControlState,
  ) => {
    setMap((prev) => {
      const copy = new Map(prev);
      if (next === baseline) copy.delete(key);
      else copy.set(key, next === "INHERIT" ? "CLEAR" : next);
      return copy;
    });
  };

  const discardStaged = () => {
    setStagedModules(new Map());
    setStagedPermissions(new Map());
  };

  const totalStaged = stagedModules.size + stagedPermissions.size;

  /** Every staged module row that is not currently `ENFORCED` — the §3.4 confirm-dialog warning
   *  fires whenever this is non-empty. Can only be non-empty if `showNonEnforcing` was on when
   *  the row was staged (its control is otherwise disabled) — no extra gate needed here. */
  const stagedNonEnforcedChildren = useMemo(() => {
    if (!data || stagedModules.size === 0) return [];
    const byKey = new Map(data.parents.flatMap((p) => p.children).map((c) => [c.key, c]));
    const out: EffectiveAccessChild[] = [];
    for (const key of stagedModules.keys()) {
      const child = byKey.get(key);
      if (child && child.enforcementState !== "ENFORCED") out.push(child);
    }
    return out;
  }, [data, stagedModules]);

  // Seed the expand/collapse set once the tree is known — a second `useState(() => ...)` can't
  // see the query result, so this seeds lazily on first successful load rather than in an effect
  // (no timer, no extra render-then-correct flash).
  const effectiveExpanded = useMemo(() => {
    if (expandedParents) return expandedParents;
    if (!data) return new Set<string>();
    const totalChildren = data.parents.reduce((n, p) => n + p.children.length, 0);
    return totalChildren <= AUTO_EXPAND_CHILD_THRESHOLD
      ? new Set(data.parents.map((p) => p.key))
      : new Set<string>();
  }, [data, expandedParents]);

  /** Filtered-in parents are force-expanded (see `displayExpanded` below) and their chevrons are
   *  disabled while a filter is active — see the `Collapsible`'s `disabled` prop in `ParentRow`,
   *  which is the primary mechanism (Radix skips `onOpenChange` entirely while disabled). This
   *  early return is belt-and-suspenders: even if something ever calls `onToggle` while filtered
   *  (e.g. a future keyboard-shortcut path that bypasses the trigger), it must not silently write
   *  an unrequested manual state that only becomes visible after the filter clears — that was
   *  exactly the round-1 fix's bug. */
  const toggleParent = (key: string) => {
    if (filterText.trim()) return;
    setExpandedParents((prev) => {
      const base = prev ?? effectiveExpanded;
      const next = new Set(base);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filteredParents = useMemo(() => {
    if (!data) return [];
    const q = filterText.trim().toLowerCase();
    if (!q) return data.parents;
    return data.parents
      .map((parent) => {
        const parentMatches =
          parent.name.toLowerCase().includes(q) || parent.key.toLowerCase().includes(q);
        const children = parentMatches
          ? parent.children
          : parent.children.filter(
              (c) => c.name.toLowerCase().includes(q) || c.key.toLowerCase().includes(q),
            );
        return { ...parent, children };
      })
      .filter((parent) => parent.children.length > 0);
  }, [data, filterText]);

  /**
   * What's actually rendered as expanded. While a filter is active, every parent that survived
   * the filter is forced open — `CollapsibleContent` unmounts when closed (Radix), so a collapsed
   * match would show the parent row with an updated count badge but no visible matching children,
   * defeating the filter's purpose. This is a pure display derivation over `effectiveExpanded`; it
   * never writes to `expandedParents`, so clearing the filter reverts to whatever the user had
   * manually expanded/collapsed before typing — no clobbering.
   */
  const displayExpanded = useMemo(() => {
    if (!filterText.trim()) return effectiveExpanded;
    return new Set(filteredParents.map((p) => p.key));
  }, [filterText, filteredParents, effectiveExpanded]);

  const selectedChild: EffectiveAccessChild | null =
    data && selection?.kind === "child"
      ? (data.parents
          .find((p) => p.key === selection.parentKey)
          ?.children.find((c) => c.key === selection.childKey) ?? null)
      : null;

  const selectedPermission: EffectiveAccessPermission | null =
    data && selection?.kind === "permission"
      ? (data.permissions.find((p) => p.key === selection.key) ?? null)
      : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <BackLink to={`/admin/users/${userId}/workspaces`}>Back to Workspaces</BackLink>
          <h1 className="mt-1 truncate font-display text-lg font-semibold">
            {membership ? membership.workspaceName : "Workspace access"}
          </h1>
          <p className="text-xs text-muted-foreground">
            Effective access — how every module and permission was decided, layer by layer.
          </p>
        </div>
        <CopyableKey value={wsId} />
      </div>

      {accessQuery.isLoading ? (
        <AccessSkeleton />
      ) : accessQuery.isError ? (
        <AccessError
          error={accessQuery.error}
          userId={userId}
          onRetry={() => void accessQuery.refetch()}
        />
      ) : !data ? null : (
        <>
          <AccessSummary
            data={data}
            userId={userId}
            wsId={wsId}
            workspaceName={membership?.workspaceName ?? "this workspace"}
            canManagePackage={canManagePackage}
            canEditAccess={canEditAccess}
            packages={packagesQuery.data?.items ?? []}
            roles={rbacQuery.data?.roles ?? []}
            policies={rbacQuery.data?.policies ?? []}
            onMutated={() => {
              void queryClient.invalidateQueries({
                queryKey: ["admin-user", userId, "effective-access", wsId],
              });
              void queryClient.invalidateQueries({
                queryKey: ["admin-user", userId, "workspaces"],
              });
            }}
          />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
            <div className="min-w-0 space-y-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="font-display text-sm font-semibold">Modules</h2>
                  <span className="text-[11px] text-muted-foreground">
                    {data.parents.reduce((n, p) => n + p.children.length, 0)} total
                  </span>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Filter by name or key…"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                  />
                </div>
                {canEditAccess && (
                  <label className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-dashed p-2.5 text-xs">
                    <span className="min-w-0">
                      <span className="block font-medium">Show non-enforcing capabilities</span>
                      <span className="block text-muted-foreground">
                        Off by default — most modules have no live enforcement site yet (spec §3.4).
                        Turning this on lets you stage changes to them anyway; saving records intent
                        only.
                      </span>
                    </span>
                    <Switch checked={showNonEnforcing} onCheckedChange={setShowNonEnforcing} />
                  </label>
                )}
              </div>

              {filteredParents.length === 0 ? (
                <EmptyState icon={Search} title="No modules match that filter">
                  Try a different name or key.
                </EmptyState>
              ) : (
                <div className="space-y-1.5">
                  {filteredParents.map((parent) => (
                    <ParentRow
                      key={parent.key}
                      parent={parent}
                      expanded={displayExpanded.has(parent.key)}
                      toggleDisabled={filterText.trim().length > 0}
                      onToggle={() => toggleParent(parent.key)}
                      selection={selection}
                      onSelectChild={(childKey) =>
                        setSelection({ kind: "child", parentKey: parent.key, childKey })
                      }
                      canEditAccess={canEditAccess}
                      showNonEnforcing={showNonEnforcing}
                      stagedModules={stagedModules}
                      onStageChild={(child, next) =>
                        stage(setStagedModules, child.key, moduleBaseline(child), next)
                      }
                    />
                  ))}
                </div>
              )}

              <div className="border-t pt-4">
                <PermissionsSection
                  permissions={data.permissions}
                  selection={selection}
                  onSelect={(key) => setSelection({ kind: "permission", key })}
                  canEditAccess={canEditAccess}
                  stagedPermissions={stagedPermissions}
                  onStagePermission={(perm, next) =>
                    stage(setStagedPermissions, perm.key, permissionBaseline(perm), next)
                  }
                />
              </div>
            </div>

            <div className="xl:sticky xl:top-6">
              <ProvenancePanel
                resolutionOrder={data.resolutionOrder}
                selectedChild={selectedChild}
                selectedPermission={selectedPermission}
              />
            </div>
          </div>

          <WorkspaceSupportOpsSection
            wsId={wsId}
            workspaceName={membership?.workspaceName ?? "this workspace"}
          />

          {totalStaged > 0 && (
            <FormActions hint={`${totalStaged} staged change${totalStaged === 1 ? "" : "s"}`}>
              <Button type="button" variant="outline" onClick={discardStaged}>
                Discard
              </Button>
              <Button
                type="button"
                onClick={() => setCommitDialogOpen(true)}
                className="bg-brand-gradient text-primary-foreground shadow-glow hover:opacity-95"
              >
                Review & save
              </Button>
            </FormActions>
          )}

          <CommitDialog
            open={commitDialogOpen}
            onOpenChange={setCommitDialogOpen}
            data={data}
            userId={userId}
            wsId={wsId}
            stagedModules={stagedModules}
            stagedPermissions={stagedPermissions}
            stagedNonEnforcedChildren={stagedNonEnforcedChildren}
            childIdByKey={childIdByKey}
            permissionIdByKey={permissionIdByKey}
            onSettled={(committedModuleKeys, committedPermissionKeys) => {
              setStagedModules((prev) => {
                const next = new Map(prev);
                for (const k of committedModuleKeys) next.delete(k);
                return next;
              });
              setStagedPermissions((prev) => {
                const next = new Map(prev);
                for (const k of committedPermissionKeys) next.delete(k);
                return next;
              });
              void queryClient.invalidateQueries({
                queryKey: ["admin-user", userId, "effective-access", wsId],
              });
              void queryClient.invalidateQueries({
                queryKey: ["admin-user", userId, "workspaces"],
              });
            }}
          />
        </>
      )}
    </div>
  );
}

function AccessSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 rounded-2xl" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  );
}

function AccessError({
  error,
  userId,
  onRetry,
}: {
  error: unknown;
  userId: string;
  onRetry: () => void;
}) {
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  const code = error instanceof ApiError ? error.code : undefined;
  const notFound = error instanceof ApiError && error.status === 404;

  if (notFound) {
    return (
      <div className="rounded-2xl border border-dashed bg-muted/20 p-8 text-center">
        <AlertCircle className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium">This user isn't a member of that workspace.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          They may have been removed since the Workspaces tab last loaded.
        </p>
        <Link
          to="/admin/users/$userId/workspaces"
          params={{ userId }}
          className="mt-4 inline-block text-xs text-primary underline underline-offset-2"
        >
          Back to Workspaces
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-8 text-center">
      <AlertCircle className="mx-auto mb-2 h-6 w-6 text-destructive" />
      <p className="text-sm font-medium text-destructive">Couldn't load effective access.</p>
      {code && (
        <p className="mt-1 text-xs text-muted-foreground">
          Code: <span className="font-mono">{code}</span>
        </p>
      )}
      {requestId && (
        <p className="mt-2 text-xs text-muted-foreground">
          Request ID: <span className="font-mono">{requestId}</span>
        </p>
      )}
      <button
        type="button"
        className="mt-4 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
        onClick={onRetry}
      >
        Retry
      </button>
    </div>
  );
}

/** Package/unrestricted banner, role line, and limits — the "ceiling" this workspace's access is
 *  being resolved against. Package and limits become editable when `canManagePackage` is granted;
 *  role and ABAC become editable when `canEditAccess` is granted — two different permissions
 *  (requirement 9 — each gates independently, read-only otherwise, never a broken button).
 *  `abacDenies` gets its own separate, more visually prominent card below when non-empty, per the
 *  brief; the ABAC assign control sits under it. */
function AccessSummary({
  data,
  userId,
  wsId,
  workspaceName,
  canManagePackage,
  canEditAccess,
  packages,
  roles,
  policies,
  onMutated,
}: {
  data: AdminUserEffectiveAccess;
  userId: string;
  wsId: string;
  workspaceName: string;
  canManagePackage: boolean;
  canEditAccess: boolean;
  packages: PackageRow[];
  roles: RbacOverview["roles"];
  policies: RbacOverview["policies"];
  onMutated: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
        {canManagePackage ? (
          <PackageSection
            data={data}
            wsId={wsId}
            workspaceName={workspaceName}
            packages={packages}
            onMutated={onMutated}
          />
        ) : data.unrestricted ? (
          <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-sm font-medium">
              No package assigned: this workspace has unrestricted access to all modules.
            </p>
          </div>
        ) : data.package ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Package</span>
            <span className="font-medium">{data.package.name}</span>
            <CopyableKey value={data.package.key} />
            {!data.package.assigned && (
              <Badge variant="outline" className="text-[10px]">
                Not assigned
              </Badge>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No package.</p>
        )}

        <div className="mt-3 border-t pt-3">
          {canEditAccess ? (
            <RoleSection
              data={data}
              userId={userId}
              wsId={wsId}
              roles={roles}
              onMutated={onMutated}
            />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Role</span>
              {data.role ? (
                <>
                  <span className="font-medium">{data.role.name}</span>
                  <CopyableKey value={data.role.key} />
                </>
              ) : (
                <span className="text-sm text-muted-foreground">No role assigned</span>
              )}
            </div>
          )}
        </div>

        {canManagePackage ? (
          <LimitsSection data={data} wsId={wsId} onMutated={onMutated} />
        ) : (
          <LimitsList limits={data.limits} />
        )}
      </div>

      {data.abacDenies.length > 0 && <AbacDeniesCard denies={data.abacDenies} />}

      {canEditAccess && (
        <AbacAssignSection userId={userId} wsId={wsId} policies={policies} onMutated={onMutated} />
      )}
    </div>
  );
}

/** Task 9 finding (repeated in the Task 13 brief): legacy plan defaults use `999999`/`999`-class
 *  sentinels for "effectively unlimited" alongside the standardized `-1`. Both display as
 *  "Unlimited"; SAVING an unlimited intent always writes `-1` (the standardized convention),
 *  never a legacy sentinel — see `LimitsSection`'s save handler. */
function isUnlimitedValue(value: number): boolean {
  return value === -1 || value >= 999_999;
}

function formatLimitValue(value: number): string {
  return isUnlimitedValue(value) ? "Unlimited" : value.toLocaleString();
}

function humanizeKey(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function LimitsList({ limits }: { limits: AdminUserEffectiveAccess["limits"] }) {
  const entries = Object.entries(limits);
  if (entries.length === 0) return null;

  return (
    <div className="mt-3 border-t pt-3">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">Limits</span>
      <dl className="mt-2 grid gap-2 sm:grid-cols-2">
        {entries.map(([key, limit]) => (
          <div
            key={key}
            className="flex items-center justify-between gap-2 rounded-lg border bg-muted/20 px-2.5 py-1.5 text-xs"
          >
            <dt className="min-w-0 truncate text-muted-foreground">{humanizeKey(key)}</dt>
            <dd className="flex shrink-0 items-center gap-1.5 font-medium">
              {limit.overridden && limit.baseValue !== undefined && (
                <span className="text-muted-foreground line-through">
                  {formatLimitValue(limit.baseValue)}
                </span>
              )}
              <span>{formatLimitValue(limit.value)}</span>
              <Badge variant="outline" className="text-[9px] font-normal">
                {humanizeKey(limit.source)}
              </Badge>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Package Select + Assign confirm dialog + a separately danger-styled Unassign hard-confirm
 * (requirement 6). Assign/unassign go through `admin-workspaces-api.ts`'s
 * `assignWorkspacePackageAdmin`/`unassignWorkspacePackageAdmin` — the Task 11 workspace-level
 * routes, a second HTTP entry point onto the same service `packages.assign.tsx` already calls
 * through `registry-api.ts`'s older `assignWorkspacePackage`/`clearWorkspacePackage` (which stay
 * untouched; this route intentionally uses the newer pair, not a duplicate write path — see
 * `admin-workspaces-api.ts`'s file header). The package *list* for the Select, however, IS reused
 * directly from `registry-api.ts`'s `listPackages`, per the brief.
 */
function PackageSection({
  data,
  wsId,
  workspaceName,
  packages,
  onMutated,
}: {
  data: AdminUserEffectiveAccess;
  wsId: string;
  workspaceName: string;
  packages: PackageRow[];
  onMutated: () => void;
}) {
  const [selectedPackageId, setSelectedPackageId] = useState(data.package?.id ?? "");
  const [note, setNote] = useState("");
  const [assignConfirmOpen, setAssignConfirmOpen] = useState(false);
  const [unassignConfirmOpen, setUnassignConfirmOpen] = useState(false);
  const [typedName, setTypedName] = useState("");

  const nextPackage = packages.find((p) => p.id === selectedPackageId) ?? null;

  const assignMutation = useMutation({
    mutationFn: () =>
      assignWorkspacePackageAdmin(wsId, {
        packageId: selectedPackageId,
        note: note.trim() || null,
      }),
    onSuccess: () => {
      toast.success(nextPackage ? `Package assigned: ${nextPackage.name}` : "Package assigned.");
      setAssignConfirmOpen(false);
      setNote("");
      onMutated();
    },
    onError: (err) => {
      const requestId = err instanceof ApiError ? err.requestId : undefined;
      toast.error(err instanceof Error ? err.message : "Failed to assign package.", {
        description: requestId ? `Request ID: ${requestId}` : undefined,
      });
    },
  });

  const unassignMutation = useMutation({
    mutationFn: () => unassignWorkspacePackageAdmin(wsId, { note: note.trim() || null }),
    onSuccess: () => {
      toast.success(`${workspaceName} is now unrestricted.`);
      setUnassignConfirmOpen(false);
      setTypedName("");
      setNote("");
      setSelectedPackageId("");
      onMutated();
    },
    onError: (err) => {
      const requestId = err instanceof ApiError ? err.requestId : undefined;
      toast.error(err instanceof Error ? err.message : "Failed to unassign package.", {
        description: requestId ? `Request ID: ${requestId}` : undefined,
      });
    },
  });

  return (
    <div className="space-y-2.5">
      {data.unrestricted && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-warning">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-sm font-medium">
            No package assigned: this workspace has unrestricted access to all modules.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="w-16 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
          Package
        </span>
        <Select value={selectedPackageId} onValueChange={setSelectedPackageId}>
          <SelectTrigger className="h-8 max-w-xs text-xs">
            <SelectValue placeholder="Select a package" />
          </SelectTrigger>
          <SelectContent>
            {packages.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
                {p.id === data.package?.id ? " (current)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!selectedPackageId || selectedPackageId === data.package?.id}
          onClick={() => setAssignConfirmOpen(true)}
        >
          Assign
        </Button>
        {data.package && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setUnassignConfirmOpen(true)}
          >
            Unassign
          </Button>
        )}
      </div>

      <AlertDialog open={assignConfirmOpen} onOpenChange={setAssignConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Assign {nextPackage?.name} to {workspaceName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This applies immediately and every connected member's session refreshes its
              permissions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs">Note (optional, recorded in the audit log)</Label>
            <Input value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={assignMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={assignMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                assignMutation.mutate();
              }}
            >
              {assignMutation.isPending ? "Assigning…" : "Assign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={unassignConfirmOpen} onOpenChange={setUnassignConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unassign {data.package?.name}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p className="font-medium text-destructive">
                  Once unassigned, this workspace will have unrestricted access to all modules —
                  every capability its role and overrides allow, with no ceiling.
                </p>
                <p>
                  Type <code className="font-mono font-semibold">{workspaceName}</code> to confirm.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            className="font-mono"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder={workspaceName}
            aria-label="Type the workspace name to confirm"
          />
          <div className="space-y-1.5">
            <Label className="text-xs">Note (optional, recorded in the audit log)</Label>
            <Input value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unassignMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={typedName.trim() !== workspaceName || unassignMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                unassignMutation.mutate();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {unassignMutation.isPending ? "Unassigning…" : "Unassign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Role Select + confirm (requirement 8). Defaults to whatever role in the catalogue matches the
 *  currently-committed role's key — the effective-access response carries the role's key/name but
 *  not its id, so the id-bearing catalogue (`getRbacOverview().roles`, reused for the ABAC section
 *  too) is what makes the Select's initial value line up with reality instead of starting blank. */
function RoleSection({
  data,
  userId,
  wsId,
  roles,
  onMutated,
}: {
  data: AdminUserEffectiveAccess;
  userId: string;
  wsId: string;
  roles: RbacOverview["roles"];
  onMutated: () => void;
}) {
  const currentRoleId = roles.find((r) => r.key === data.role?.key)?.id ?? "";
  // `null` means "no explicit pick yet" — falls back to `currentRoleId` for display. Avoids the
  // seed-once quirk a plain `useState(currentRoleId)` would have if the role catalogue (a separate
  // query) resolves after this component's first render: a `useState` initializer only runs once,
  // so it would freeze on an empty string forever. Same pattern this file already uses for
  // `expandedParents` (`Set | null`, falls back to a computed default while unset).
  const [explicitRoleId, setExplicitRoleId] = useState<string | null>(null);
  const selectedRoleId = explicitRoleId ?? currentRoleId;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState("");

  const nextRole = roles.find((r) => r.id === selectedRoleId) ?? null;
  const reasonValid = reason.trim().length >= 1 && reason.trim().length <= 1000;

  const roleMutation = useMutation({
    mutationFn: () =>
      changeUserWorkspaceRole(userId, wsId, { roleId: selectedRoleId, reason: reason.trim() }),
    onSuccess: (res) => {
      toast.success(`Role changed to ${nextRole?.name ?? res.roleKey}.`);
      setConfirmOpen(false);
      setReason("");
      onMutated();
    },
    onError: (err) => {
      const requestId = err instanceof ApiError ? err.requestId : undefined;
      toast.error(err instanceof Error ? err.message : "Failed to change role.", {
        description: requestId ? `Request ID: ${requestId}` : undefined,
      });
    },
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-16 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
        Role
      </span>
      <Select value={selectedRoleId} onValueChange={setExplicitRoleId}>
        <SelectTrigger className="h-8 max-w-xs text-xs">
          <SelectValue placeholder="Select a role" />
        </SelectTrigger>
        <SelectContent>
          {roles.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {r.name}
              {r.id === currentRoleId ? " (current)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!selectedRoleId || selectedRoleId === currentRoleId}
        onClick={() => setConfirmOpen(true)}
      >
        Change role
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change role to {nextRole?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This changes what this user can do in this workspace immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="role-reason">
              Reason <span className="text-destructive">*</span>
            </label>
            <Textarea
              id="role-reason"
              value={reason}
              maxLength={1000}
              placeholder="Why is this role changing?"
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={roleMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!reasonValid || roleMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                roleMutation.mutate();
              }}
            >
              {roleMutation.isPending ? "Changing…" : "Change role"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Editable limits (requirement 7). Each row stages an explicit numeric override (including `-1`
 * for the "Unlimited" checkbox) into a local map; committing is its own small "Save limits"
 * action with a required reason, deliberately separate from the module/permission bulk dialog —
 * the brief explicitly allows this ("may be a separate small action... your judgment") since
 * limits go through a different endpoint with different semantics (merge-patch, not a diff-array).
 *
 * Scope cut, documented: this UI only ever stages an explicit override value, never `null`
 * (`patchWorkspaceLimits`'s "clear this key back to the package/plan default" case). Nothing in
 * the brief asks for a reset-to-default control, and adding one would double the state machine
 * below for a case the brief doesn't call out — an operator who wants that today still has the
 * package/limits endpoints available outside this page.
 */
function LimitsSection({
  data,
  wsId,
  onMutated,
}: {
  data: AdminUserEffectiveAccess;
  wsId: string;
  onMutated: () => void;
}) {
  const [staged, setStaged] = useState<Map<string, number>>(new Map());
  const [saveOpen, setSaveOpen] = useState(false);
  const [reason, setReason] = useState("");

  const entries = Object.entries(data.limits);

  const setLimit = (key: string, committedValue: number, next: number) => {
    setStaged((prev) => {
      const copy = new Map(prev);
      if (next === committedValue) copy.delete(key);
      else copy.set(key, next);
      return copy;
    });
  };

  const reasonValid = reason.trim().length >= 1 && reason.trim().length <= 1000;

  const saveMutation = useMutation({
    mutationFn: () =>
      patchWorkspaceLimits(wsId, {
        limitOverrides: Object.fromEntries(staged),
      }),
    onSuccess: () => {
      toast.success(`Saved ${staged.size} limit change${staged.size === 1 ? "" : "s"}.`);
      setStaged(new Map());
      setSaveOpen(false);
      setReason("");
      onMutated();
    },
    onError: (err) => {
      const requestId = err instanceof ApiError ? err.requestId : undefined;
      toast.error(err instanceof Error ? err.message : "Failed to save limits.", {
        description: requestId ? `Request ID: ${requestId}` : undefined,
      });
      // Staged edits stay intact so the operator doesn't have to re-enter them.
    },
  });

  if (entries.length === 0) return null;

  return (
    <div className="mt-3 border-t pt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Limits</span>
        {staged.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">{staged.size} staged</span>
            <Button type="button" size="sm" variant="ghost" onClick={() => setStaged(new Map())}>
              Discard
            </Button>
            <Button type="button" size="sm" onClick={() => setSaveOpen(true)}>
              Save limits
            </Button>
          </div>
        )}
      </div>
      <dl className="mt-2 grid gap-2 sm:grid-cols-2">
        {entries.map(([key, limit]) => {
          const stagedValue = staged.get(key);
          const displayValue = stagedValue ?? limit.value;
          const unlimited = isUnlimitedValue(displayValue);
          return (
            <div
              key={key}
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs",
                stagedValue !== undefined ? "border-primary/40 bg-primary/5" : "bg-muted/20",
              )}
            >
              <dt className="min-w-0 truncate text-muted-foreground">{humanizeKey(key)}</dt>
              <dd className="flex shrink-0 items-center gap-1.5">
                {limit.overridden && limit.baseValue !== undefined && (
                  <span className="text-muted-foreground line-through">
                    {formatLimitValue(limit.baseValue)}
                  </span>
                )}
                <Input
                  type="number"
                  min={0}
                  className="h-7 w-16 px-1.5 text-right text-xs"
                  disabled={unlimited}
                  value={unlimited ? "" : displayValue}
                  placeholder={unlimited ? "∞" : undefined}
                  onChange={(e) => {
                    const parsed = Number(e.target.value);
                    if (e.target.value.trim() !== "" && Number.isInteger(parsed) && parsed >= -1) {
                      setLimit(key, limit.value, parsed);
                    }
                  }}
                />
                <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Checkbox
                    checked={unlimited}
                    onCheckedChange={(checked) => setLimit(key, limit.value, checked ? -1 : 0)}
                  />
                  Unlimited
                </label>
              </dd>
            </div>
          );
        })}
      </dl>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Save {staged.size} limit change{staged.size === 1 ? "" : "s"}?
            </DialogTitle>
            <DialogDescription>
              Applies immediately. An operator override always wins over the package/plan default.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-1 rounded-lg border p-3 text-xs">
            {[...staged.entries()].map(([key, value]) => (
              <li key={key} className="flex items-center justify-between gap-2">
                <span>{humanizeKey(key)}</span>
                <span className="font-medium">{formatLimitValue(value)}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="limits-reason">
              Reason <span className="text-destructive">*</span>
            </label>
            <Textarea
              id="limits-reason"
              value={reason}
              maxLength={1000}
              placeholder="Why are these limits changing?"
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSaveOpen(false)}
              disabled={saveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!reasonValid || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              className="bg-brand-gradient text-primary-foreground shadow-glow hover:opacity-95"
            >
              {saveMutation.isPending ? "Saving…" : "Confirm & save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AbacDeniesCard({ denies }: { denies: AdminUserEffectiveAccess["abacDenies"] }) {
  return (
    <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 shadow-soft sm:p-5">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0 text-destructive" />
        <h2 className="font-display text-sm font-semibold text-destructive">
          Active ABAC denials ({denies.length})
        </h2>
      </div>
      <p className="mt-1 text-xs text-destructive/90">
        These policies can override an otherwise-granted ALLOW — an ABAC DENY always wins.
      </p>
      <div className="mt-3 space-y-2">
        {denies.map((deny) => (
          <div key={deny.id} className="rounded-lg border border-destructive/30 bg-card p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-medium">{deny.name}</span>
              <Badge
                variant="outline"
                className="border-destructive/40 text-[10px] text-destructive"
              >
                DENY
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                Priority {deny.priority}
              </Badge>
              {!deny.isEnabled && (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Disabled
                </Badge>
              )}
            </div>
            <pre className="mt-2 overflow-x-auto rounded bg-muted/40 p-2 font-mono text-[11px] leading-relaxed">
              {JSON.stringify(deny.conditions, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * ABAC assign + a session-scoped unassign list (requirement 8).
 *
 * Scope cut, documented (mirrors the honesty this whole task is built around, applied to a plain
 * data-availability gap rather than an enforcement one): no read endpoint in the Task 9-12
 * contract exposes a per-user list of `user_policy_assignments` ROWS — `abacDenies` above is a
 * merged, role-and-user, DENY-only view keyed by the ABAC POLICY's own id, not the assignment's
 * (confirmed against `adminEffectiveAccess.ts`'s `mergePolicies`, which folds `assignment.policy`
 * without ever surfacing `assignment.id`). `DELETE .../policy/:assignmentId` needs that id, so
 * "Unassign" can only safely target policies assigned via THIS section in the current session —
 * those ids come straight off `assignUserPolicy`'s own response. A policy assigned before this
 * page load, or by any other surface, cannot be unassigned from here; the operator would need to
 * find it another way. This is a real contract gap, not a design shortcut — see task-13-report.md.
 */
function AbacAssignSection({
  userId,
  wsId,
  policies,
  onMutated,
}: {
  userId: string;
  wsId: string;
  policies: RbacOverview["policies"];
  onMutated: () => void;
}) {
  const [selectedPolicyId, setSelectedPolicyId] = useState("");
  const [assignConfirmOpen, setAssignConfirmOpen] = useState(false);
  const [sessionAssignments, setSessionAssignments] = useState<
    { assignmentId: string; policyKey: string; policyEffect: "ALLOW" | "DENY" }[]
  >([]);
  // Which session-assigned row Unassign is being confirmed for — `null` means the dialog is
  // closed. Review round-1 finding: Unassign used to fire the DELETE directly on click with no
  // confirmation at all, the only destructive action on this page that skipped one (contrast
  // `PackageSection`'s hard confirm). Fixed by routing the click through this state instead of
  // straight into `unassignMutation.mutate`.
  const [unassignTarget, setUnassignTarget] = useState<{
    assignmentId: string;
    policyKey: string;
    policyEffect: "ALLOW" | "DENY";
  } | null>(null);

  const nextPolicy = policies.find((p) => p.id === selectedPolicyId) ?? null;
  const assignedPolicyIds = new Set(
    sessionAssignments
      .map((a) => policies.find((p) => p.key === a.policyKey)?.id)
      .filter((id): id is string => !!id),
  );
  // Already assigned this session — offering it again would let the operator create a second
  // session-tracked row for the same policy (confusing, and a plausible source of duplicate-looking
  // list entries even though `assignmentId` itself would differ).
  const assignablePolicies = policies.filter((p) => !assignedPolicyIds.has(p.id));

  const assignMutation = useMutation({
    mutationFn: () => assignUserPolicy(userId, wsId, { policyId: selectedPolicyId }),
    onSuccess: (res) => {
      // Read off `nextPolicy`/`selectedPolicyId` via closure rather than the mutation's `variables`
      // — `mutationFn` here takes no argument (the id is already in scope), so TanStack Query would
      // hand back `undefined` for `variables`, not `{ policyId }`.
      const assignedKey = nextPolicy?.key ?? selectedPolicyId;
      toast.success(`Policy assigned: ${assignedKey}.`);
      setSessionAssignments((prev) => [
        ...prev,
        {
          assignmentId: res.assignment.id,
          policyKey: assignedKey,
          policyEffect: nextPolicy?.effect ?? "ALLOW",
        },
      ]);
      setAssignConfirmOpen(false);
      setSelectedPolicyId("");
      onMutated();
    },
    onError: (err) => {
      const requestId = err instanceof ApiError ? err.requestId : undefined;
      toast.error(err instanceof Error ? err.message : "Failed to assign policy.", {
        description: requestId ? `Request ID: ${requestId}` : undefined,
      });
    },
  });

  const unassignMutation = useMutation({
    mutationFn: (assignmentId: string) => removeUserPolicy(userId, wsId, assignmentId),
    onSuccess: (_res, assignmentId) => {
      setSessionAssignments((prev) => prev.filter((a) => a.assignmentId !== assignmentId));
      toast.success("Policy unassigned.");
      setUnassignTarget(null);
      onMutated();
    },
    onError: (err) => {
      const requestId = err instanceof ApiError ? err.requestId : undefined;
      toast.error(err instanceof Error ? err.message : "Failed to unassign policy.", {
        description: requestId ? `Request ID: ${requestId}` : undefined,
      });
    },
  });

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
      <h2 className="font-display text-sm font-semibold">ABAC policies</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Assigns a policy directly to this user in this workspace. Unassign is only offered here for
        policies assigned in this session — see the code comment above this component for why.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Select value={selectedPolicyId} onValueChange={setSelectedPolicyId}>
          <SelectTrigger className="h-8 max-w-xs text-xs">
            <SelectValue placeholder="Select a policy" />
          </SelectTrigger>
          <SelectContent>
            {assignablePolicies.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.key} ({p.effect})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!selectedPolicyId}
          onClick={() => setAssignConfirmOpen(true)}
        >
          Assign
        </Button>
      </div>

      {sessionAssignments.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {sessionAssignments.map((a) => (
            <li
              key={a.assignmentId}
              className="flex items-center justify-between gap-2 rounded-lg border bg-muted/20 px-2.5 py-1.5 text-xs"
            >
              <span className="flex items-center gap-1.5">
                <code>{a.policyKey}</code>
                <Badge variant="outline" className="text-[9px]">
                  {a.policyEffect}
                </Badge>
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px] text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={unassignMutation.isPending}
                onClick={() => setUnassignTarget(a)}
              >
                Unassign
              </Button>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={assignConfirmOpen} onOpenChange={setAssignConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assign {nextPolicy?.key}?</AlertDialogTitle>
            <AlertDialogDescription>
              This policy's conditions start applying to this user in this workspace immediately.
              {nextPolicy?.effect === "DENY" &&
                " Because it's a DENY policy, it can override an otherwise-granted ALLOW."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={assignMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={assignMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                assignMutation.mutate();
              }}
            >
              {assignMutation.isPending ? "Assigning…" : "Assign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={unassignTarget !== null}
        onOpenChange={(next) => {
          if (!next) setUnassignTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unassign {unassignTarget?.policyKey}?</AlertDialogTitle>
            <AlertDialogDescription>
              This is a {unassignTarget?.policyEffect} policy. Removing it stops applying its
              conditions to this user in this workspace immediately
              {unassignTarget?.policyEffect === "DENY"
                ? " — access it was blocking may become available again."
                : " — access it was granting may go away."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unassignMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={unassignMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (unassignTarget) unassignMutation.mutate(unassignTarget.assignmentId);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {unassignMutation.isPending ? "Unassigning…" : "Unassign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** ALLOW green / DENY red / INHERITED grey — INHERITED overrides the label whenever `decidedBy`
 *  is `DEFAULT`, regardless of the underlying `effective` verdict, per the brief. */
function EffectivePill({
  effective,
  decidedBy,
}: {
  effective: "ALLOW" | "DENY";
  decidedBy: EffectiveAccessDecidedBy;
}) {
  if (decidedBy === "DEFAULT") {
    return (
      <Badge
        variant="outline"
        className="border-muted-foreground/30 text-[10px] text-muted-foreground"
      >
        INHERITED
      </Badge>
    );
  }
  if (effective === "ALLOW") {
    return (
      <Badge variant="outline" className="border-success/30 bg-success/10 text-[10px] text-success">
        ALLOW
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-destructive/30 bg-destructive/10 text-[10px] text-destructive"
    >
      DENY
    </Badge>
  );
}

/** The Inherit/Allow/Deny segmented control (requirement 2). Deliberately NOT a two-state toggle:
 *  Radix's `ToggleGroup type="single"` normally lets clicking the active item deselect it (empty
 *  string) — guarded out below so this always reads as a 3-way radio, never a clearable toggle.
 *  Changing it only ever updates local staging state; it never issues a network call itself. */
function ThreeStateControl({
  value,
  disabled,
  onChange,
}: {
  value: ControlState;
  disabled: boolean;
  onChange: (next: ControlState) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      size="sm"
      value={value}
      disabled={disabled}
      onValueChange={(v) => {
        if (v) onChange(v as ControlState);
      }}
      className="shrink-0 justify-start gap-0.5"
    >
      <ToggleGroupItem value="INHERIT" className="h-6 px-2 text-[10px]">
        Inherit
      </ToggleGroupItem>
      <ToggleGroupItem
        value="ALLOW"
        className="h-6 px-2 text-[10px] data-[state=on]:bg-success/20 data-[state=on]:text-success"
      >
        Allow
      </ToggleGroupItem>
      <ToggleGroupItem
        value="DENY"
        className="h-6 px-2 text-[10px] data-[state=on]:bg-destructive/20 data-[state=on]:text-destructive"
      >
        Deny
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

function ParentRow({
  parent,
  expanded,
  toggleDisabled,
  onToggle,
  selection,
  onSelectChild,
  canEditAccess,
  showNonEnforcing,
  stagedModules,
  onStageChild,
}: {
  parent: AdminUserEffectiveAccess["parents"][number];
  expanded: boolean;
  /** True while a filter is active — filtered-in parents are force-expanded (see
   *  `displayExpanded`) and must not be collapsible, or a click would silently write a manual
   *  expand-state entry with zero visible effect (the exact bug fix round 1 introduced). Passed
   *  to `Collapsible`'s own `disabled` prop, which is the primary guard: Radix skips
   *  `onOpenChange` entirely while disabled, and marks the trigger `data-disabled`/`disabled` so
   *  the chevron visibly stops looking clickable instead of pretending to work. */
  toggleDisabled: boolean;
  onToggle: () => void;
  selection: Selection;
  onSelectChild: (childKey: string) => void;
  canEditAccess: boolean;
  showNonEnforcing: boolean;
  stagedModules: StageMap;
  onStageChild: (child: EffectiveAccessChild, next: ControlState) => void;
}) {
  const allowedCount = parent.children.filter((c) => c.effective === "ALLOW").length;
  return (
    <Collapsible open={expanded} onOpenChange={onToggle} disabled={toggleDisabled}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-left hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-60"
        >
          <ChevronRight
            className={cn("h-3.5 w-3.5 shrink-0 transition-transform", expanded && "rotate-90")}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{parent.name}</span>
            <code className="text-[10px] text-muted-foreground">{parent.key}</code>
          </span>
          {!parent.enabled && (
            <Badge variant="outline" className="shrink-0 text-[10px]">
              Disabled
            </Badge>
          )}
          <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
            {allowedCount}/{parent.children.length}
          </Badge>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="ml-4 mt-0.5 space-y-0.5 border-l pl-3">
        {parent.children.map((child) => (
          <ChildRow
            key={child.key}
            child={child}
            selected={
              selection?.kind === "child" &&
              selection.parentKey === parent.key &&
              selection.childKey === child.key
            }
            onSelect={() => onSelectChild(child.key)}
            canEditAccess={canEditAccess}
            showNonEnforcing={showNonEnforcing}
            staged={stagedModules.get(child.key)}
            onStage={(next) => onStageChild(child, next)}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Staged rows get a ring plus a small "→ target" badge — the visual mark requirement 4 asks for.
 *  Shared between module and permission rows since both stage the same three values. */
function StagedMark({ staged }: { staged: BulkModuleOverrideEffect | undefined }) {
  if (!staged) return null;
  const label = staged === "CLEAR" ? "Inherit" : staged === "ALLOW" ? "Allow" : "Deny";
  return (
    <Badge
      variant="outline"
      className="shrink-0 border-primary/40 bg-primary/10 text-[9px] text-primary"
    >
      → {label}
    </Badge>
  );
}

function ChildRow({
  child,
  selected,
  onSelect,
  canEditAccess,
  showNonEnforcing,
  staged,
  onStage,
}: {
  child: EffectiveAccessChild;
  selected: boolean;
  onSelect: () => void;
  canEditAccess: boolean;
  showNonEnforcing: boolean;
  staged: BulkModuleOverrideEffect | undefined;
  onStage: (next: ControlState) => void;
}) {
  const baseline: ControlState = child.decidedBy === "USER_OVERRIDE" ? child.effective : "INHERIT";
  const display: ControlState =
    staged === undefined ? baseline : staged === "CLEAR" ? "INHERIT" : staged;
  // A plugin-owned module: the resolver marks these by key prefix, not a dedicated field
  // (`EffectiveAccessChild` has none — confirmed against `adminEffectiveAccess.ts`; the server's
  // own `assertNotPluginManaged` guard, added in task-11-report.md's I1 fix, recognizes the same
  // `plugin_` prefix and would 400 `PLUGIN_MANAGED_MODULE` if this were staged and committed
  // anyway). Disabled proactively here so that 400 is the rare fallback (e.g. a plugin installed
  // mid-session), not the normal path — the commit dialog's error toast still surfaces it cleanly
  // if it happens.
  const isPluginManaged = child.key.startsWith("plugin_");
  // §3.4: a capability with no enforcement site is disabled by default; the page-level switch
  // opts back in. Requirement 9: the control never even renders without USER_MANAGE.
  const controlDisabled =
    !canEditAccess ||
    isPluginManaged ||
    (child.enforcementState !== "ENFORCED" && !showNonEnforcing);

  return (
    <div
      className={cn(
        "flex w-full flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
        selected
          ? "bg-primary/10 ring-1 ring-primary/30"
          : staged
            ? "bg-muted/40"
            : "hover:bg-muted/50",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate">{child.name}</span>
          <code className="text-[10px] text-muted-foreground">{child.key}</code>
        </span>
        <EnforcementBadge state={child.enforcementState} />
        <EffectivePill effective={child.effective} decidedBy={child.decidedBy} />
      </button>
      <StagedMark staged={staged} />
      {isPluginManaged && canEditAccess && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="shrink-0 text-[9px] text-muted-foreground">
              Plugin-managed
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            Owned by a plugin — change it from that plugin's grants screen instead (PUT
            /admin/plugins/:key/grants/workspace), not from here.
          </TooltipContent>
        </Tooltip>
      )}
      {canEditAccess && (
        <ThreeStateControl value={display} disabled={controlDisabled} onChange={onStage} />
      )}
    </div>
  );
}

function PermissionsSection({
  permissions,
  selection,
  onSelect,
  canEditAccess,
  stagedPermissions,
  onStagePermission,
}: {
  permissions: EffectiveAccessPermission[];
  selection: Selection;
  onSelect: (key: string) => void;
  canEditAccess: boolean;
  stagedPermissions: StageMap;
  onStagePermission: (perm: EffectiveAccessPermission, next: ControlState) => void;
}) {
  const groups = useMemo(() => {
    const byModule = new Map<string, EffectiveAccessPermission[]>();
    for (const perm of permissions) {
      const list = byModule.get(perm.moduleKey);
      if (list) list.push(perm);
      else byModule.set(perm.moduleKey, [perm]);
    }
    return Array.from(byModule.entries());
  }, [permissions]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold">Permissions</h2>
        <span className="text-[11px] text-muted-foreground">{permissions.length} total</span>
      </div>

      {groups.length === 0 ? (
        <p className="text-xs text-muted-foreground">No permissions to show.</p>
      ) : (
        <div className="space-y-3">
          {groups.map(([moduleKey, perms]) => (
            <div key={moduleKey}>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {humanizeKey(moduleKey)}
              </p>
              <div className="space-y-0.5">
                {perms.map((perm) => {
                  const rowSelected =
                    selection?.kind === "permission" && selection.key === perm.key;
                  const staged = stagedPermissions.get(perm.key);
                  const baseline: ControlState =
                    perm.decidedBy === "USER_OVERRIDE" ? perm.effective : "INHERIT";
                  const display: ControlState =
                    staged === undefined ? baseline : staged === "CLEAR" ? "INHERIT" : staged;
                  return (
                    <div
                      key={perm.key}
                      className={cn(
                        "flex w-full flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
                        rowSelected
                          ? "bg-primary/10 ring-1 ring-primary/30"
                          : staged
                            ? "bg-muted/40"
                            : "hover:bg-muted/50",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(perm.key)}
                        aria-pressed={rowSelected}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <KeyRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <code className="text-xs">{perm.key}</code>
                        </span>
                        <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                          {perm.action}
                        </Badge>
                        <EffectivePill effective={perm.effective} decidedBy={perm.decidedBy} />
                      </button>
                      <StagedMark staged={staged} />
                      {canEditAccess && (
                        <ThreeStateControl
                          value={display}
                          disabled={!canEditAccess}
                          onChange={(next) => onStagePermission(perm, next)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const LAYER_LABEL: Record<EffectiveAccessLayer, string> = {
  PACKAGE: "Package",
  WORKSPACE_OVERRIDE: "Workspace override",
  ROLE: "Role",
  USER_OVERRIDE: "User override",
  ABAC: "ABAC",
};

function ProvenancePanel({
  resolutionOrder,
  selectedChild,
  selectedPermission,
}: {
  resolutionOrder: EffectiveAccessLayer[];
  selectedChild: EffectiveAccessChild | null;
  selectedPermission: EffectiveAccessPermission | null;
}) {
  const selected = selectedChild ?? selectedPermission;

  if (!selected) {
    return (
      <div className="rounded-2xl border border-dashed bg-muted/10 p-6 text-center">
        <ShieldQuestion className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium">No selection</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Select a module or permission on the left to see how its access was decided.
        </p>
      </div>
    );
  }

  const name = selectedChild ? selectedChild.name : selectedPermission!.key;
  const key = selectedChild ? selectedChild.key : selectedPermission!.key;

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{name}</p>
        <code className="text-[11px] text-muted-foreground">{key}</code>
      </div>

      <p className="mt-3 rounded-lg bg-muted/30 px-3 py-2 text-sm font-medium">
        {selected.effective} — decided by {selected.decidedBy}
      </p>

      <div className="mt-4 space-y-2">
        {resolutionOrder.map((layer) => {
          const trace = selected.trace.find((t) => t.layer === layer);
          const isDeciding = selected.decidedBy === layer;
          return <TraceLayerRow key={layer} layer={layer} trace={trace} deciding={isDeciding} />;
        })}
      </div>

      {selected.decidedBy === "DEFAULT" && (
        <p className="mt-3 text-xs text-muted-foreground">
          No layer explicitly granted or denied this — it fell through to the default (deny).
        </p>
      )}
    </div>
  );
}

function TraceLayerRow({
  layer,
  trace,
  deciding,
}: {
  layer: EffectiveAccessLayer;
  trace: EffectiveAccessTraceEntry | undefined;
  deciding: boolean;
}) {
  const result = trace?.result ?? "NONE";
  const resultClass =
    result === "ALLOW"
      ? "text-success"
      : result === "DENY"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <div
      className={cn(
        "rounded-lg border p-2.5 text-xs",
        deciding ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20" : "border-border",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("font-medium", deciding && "text-primary")}>
          {LAYER_LABEL[layer]}
          {deciding && (
            <Badge variant="outline" className="ml-1.5 border-primary/40 text-[9px] text-primary">
              Deciding
            </Badge>
          )}
        </span>
        <span className={cn("font-semibold", resultClass)}>{result}</span>
      </div>
      {trace && (trace.sourceId || trace.grantedBy || trace.expiresAt || trace.reason) && (
        <dl className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
          {trace.sourceId && (
            <div className="flex items-center gap-1.5">
              <dt className="shrink-0">Source</dt>
              <dd className="min-w-0">
                <CopyableKey value={trace.sourceId} />
              </dd>
            </div>
          )}
          {trace.grantedBy && (
            <div className="flex items-center gap-1.5">
              <dt className="shrink-0">Granted by</dt>
              <dd className="truncate">{trace.grantedBy}</dd>
            </div>
          )}
          {trace.expiresAt && (
            <div className="flex items-center gap-1.5">
              <dt className="shrink-0">Expires</dt>
              <dd className="truncate">{formatDateTime(trace.expiresAt)}</dd>
            </div>
          )}
          {trace.reason && (
            <div className="flex items-center gap-1.5">
              <dt className="shrink-0">Reason</dt>
              <dd className="truncate">{trace.reason}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}

type DiffRow = { key: string; label: string; baseline: ControlState; next: ControlState };

function diffRows(
  map: StageMap,
  lookup: (key: string) => { name: string; baseline: ControlState } | undefined,
): DiffRow[] {
  return [...map.entries()].map(([key, effect]) => {
    const found = lookup(key);
    return {
      key,
      label: found?.name ?? key,
      baseline: found?.baseline ?? "INHERIT",
      next: effect === "CLEAR" ? "INHERIT" : effect,
    };
  });
}

const CONTROL_LABEL: Record<ControlState, string> = {
  INHERIT: "Inherit",
  ALLOW: "Allow",
  DENY: "Deny",
};

/**
 * The bulk commit flow (requirement 5) — ONE dialog covering both staging maps, even though only
 * modules have a real bulk endpoint. Modules commit via one `bulkSetUserModuleOverrides` call
 * (one server transaction, one audit row — task-12-report.md §3); permissions have no bulk
 * endpoint (confirmed in that same report's Step-0 audit), so they commit as sequential individual
 * POST/DELETE calls, batched here with per-item success/failure tracked so a partial failure is
 * reported precisely rather than papered over (requirement 8's explicit fallback).
 *
 * Never auto-saves — this is the only place in the whole page that issues a write.
 */
function CommitDialog({
  open,
  onOpenChange,
  data,
  userId,
  wsId,
  stagedModules,
  stagedPermissions,
  stagedNonEnforcedChildren,
  childIdByKey,
  permissionIdByKey,
  onSettled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: AdminUserEffectiveAccess;
  userId: string;
  wsId: string;
  stagedModules: StageMap;
  stagedPermissions: StageMap;
  stagedNonEnforcedChildren: EffectiveAccessChild[];
  childIdByKey: Map<string, string>;
  permissionIdByKey: Map<string, string>;
  onSettled: (committedModuleKeys: string[], committedPermissionKeys: string[]) => void;
}) {
  const [reason, setReason] = useState("");

  const moduleRows = useMemo(() => {
    const byKey = new Map(
      data.parents
        .flatMap((p) => p.children)
        .map((c) => [
          c.key,
          {
            name: c.name,
            baseline: (c.decidedBy === "USER_OVERRIDE" ? c.effective : "INHERIT") as ControlState,
          },
        ]),
    );
    return diffRows(stagedModules, (key) => byKey.get(key));
  }, [data, stagedModules]);

  const permissionRows = useMemo(() => {
    const byKey = new Map(
      data.permissions.map((p) => [
        p.key,
        {
          name: p.key,
          baseline: (p.decidedBy === "USER_OVERRIDE" ? p.effective : "INHERIT") as ControlState,
        },
      ]),
    );
    return diffRows(stagedPermissions, (key) => byKey.get(key));
  }, [data, stagedPermissions]);

  const allRows = [...moduleRows, ...permissionRows];
  const allowedCount = allRows.filter((r) => r.next === "ALLOW").length;
  const deniedCount = allRows.filter((r) => r.next === "DENY").length;
  const clearedCount = allRows.filter(
    (r) => r.next === "INHERIT" && r.baseline !== "INHERIT",
  ).length;

  const reasonValid = reason.trim().length >= 1 && reason.trim().length <= 1000;

  const commitMutation = useMutation({
    mutationFn: async () => {
      const trimmedReason = reason.trim();

      const moduleChanges: BulkModuleOverrideChangeInput[] = [];
      const moduleKeysInBatch: string[] = [];
      const skippedModuleKeys: string[] = [];
      for (const [key, effect] of stagedModules) {
        const childModuleId = childIdByKey.get(key);
        // Missing id means the registry catalogue hasn't resolved this key (stale cache / race) —
        // skip it rather than send an invalid request; it stays staged for the next attempt.
        // Not silent: collected below so the operator is told which rows were skipped, rather than
        // wondering why a staged change didn't land.
        if (!childModuleId) {
          skippedModuleKeys.push(key);
          continue;
        }
        moduleChanges.push({ childModuleId, effect });
        moduleKeysInBatch.push(key);
      }

      let committedModuleKeys: string[] = [];
      if (moduleChanges.length > 0) {
        // One transaction, one audit row (task-12-report.md §3) — if this resolves, every item in
        // the batch landed; if it throws, none did, and nothing here is marked committed.
        await bulkSetUserModuleOverrides(userId, wsId, {
          changes: moduleChanges,
          reason: trimmedReason,
        });
        committedModuleKeys = moduleKeysInBatch;
      }

      const committedPermissionKeys: string[] = [];
      const permissionFailures: { key: string; message: string; requestId?: string }[] = [];
      for (const [key, effect] of stagedPermissions) {
        try {
          if (effect === "CLEAR") {
            const perm = data.permissions.find((p) => p.key === key);
            const overrideId = perm?.trace.find(
              (t) => t.layer === "USER_OVERRIDE" && t.sourceId,
            )?.sourceId;
            if (!overrideId) throw new Error("No existing override found to clear.");
            await deleteUserPermissionOverride(userId, wsId, overrideId);
          } else {
            const permissionId = permissionIdByKey.get(key);
            if (!permissionId) throw new Error("Unknown permission — try refreshing the page.");
            await createUserPermissionOverride(userId, wsId, {
              permissionId,
              effect,
              reason: trimmedReason,
            });
          }
          committedPermissionKeys.push(key);
        } catch (err) {
          permissionFailures.push({
            key,
            message:
              err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Failed",
            requestId: err instanceof ApiError ? err.requestId : undefined,
          });
        }
      }

      return {
        committedModuleKeys,
        committedPermissionKeys,
        permissionFailures,
        skippedModuleKeys,
      };
    },
    onSuccess: ({
      committedModuleKeys,
      committedPermissionKeys,
      permissionFailures,
      skippedModuleKeys,
    }) => {
      onSettled(committedModuleKeys, committedPermissionKeys);

      if (skippedModuleKeys.length > 0) {
        toast.warning(
          `${skippedModuleKeys.length} module change${skippedModuleKeys.length === 1 ? "" : "s"} couldn't be resolved and stayed staged — try again after the page finishes loading.`,
          { description: skippedModuleKeys.join(", ") },
        );
      }

      // §3.4: never claim enforcement for a capability with no enforcement site. This caveat must
      // appear whenever the COMMITTED portion of this save included one of those changes, on
      // EVERY success path — clean save and partial-failure save alike, not just the clean-save
      // branch (task-13 review round 1 finding: the partial-failure toast used to skip this check
      // entirely, so a batch that saved a non-enforced module change while a permission call
      // failed used to read as a plain, unqualified save).
      const intentOnlyCaveat =
        committedModuleKeys.length > 0 && stagedNonEnforcedChildren.length > 0
          ? " Some of these capabilities have no enforcement site — access is not actually restricted until enforcement is wired."
          : "";

      if (permissionFailures.length > 0) {
        const savedParts: string[] = [];
        if (committedModuleKeys.length > 0) {
          savedParts.push(
            `${committedModuleKeys.length} module change${committedModuleKeys.length === 1 ? "" : "s"}`,
          );
        }
        if (committedPermissionKeys.length > 0) {
          savedParts.push(
            `${committedPermissionKeys.length} permission change${committedPermissionKeys.length === 1 ? "" : "s"}`,
          );
        }
        toast.warning(
          `Saved ${savedParts.length > 0 ? savedParts.join(" and ") : "nothing"}; ${permissionFailures.length} permission change${permissionFailures.length === 1 ? "" : "s"} failed and stayed staged.${intentOnlyCaveat}`,
          {
            description: permissionFailures
              .map(
                (f) =>
                  `${f.key}: ${f.message}${f.requestId ? ` (Request ID: ${f.requestId})` : ""}`,
              )
              .join("; "),
          },
        );
        // Left open — some changes are still staged and need the operator's attention.
        return;
      }

      if (intentOnlyCaveat) {
        toast.success(`Intent recorded.${intentOnlyCaveat}`);
      } else {
        toast.success("Access changes saved.");
      }
      setReason("");
      onOpenChange(false);
    },
    onError: (err) => {
      const requestId = err instanceof ApiError ? err.requestId : undefined;
      toast.error(err instanceof Error ? err.message : "Failed to save access changes.", {
        description: requestId ? `Request ID: ${requestId}` : undefined,
      });
      // Staging stays intact — nothing here was cleared, and the dialog stays open so the operator
      // can retry without re-doing the diff.
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setReason("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Review {allRows.length} staged change{allRows.length === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription>
            {deniedCount} capabilit{deniedCount === 1 ? "y" : "ies"} will be denied, {allowedCount}{" "}
            allowed, {clearedCount} override{clearedCount === 1 ? "" : "s"} cleared.
          </DialogDescription>
        </DialogHeader>

        {stagedNonEnforcedChildren.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">
                This capability has no enforcement site. Saving records your intent but will not
                restrict the user until enforcement is wired.
              </p>
              <p className="mt-1 text-warning/90">
                Applies to: {stagedNonEnforcedChildren.map((c) => c.name).join(", ")}
              </p>
            </div>
          </div>
        )}

        <div className="max-h-56 space-y-3 overflow-y-auto rounded-lg border p-3">
          {moduleRows.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Modules
              </p>
              <ul className="space-y-1 text-xs">
                {moduleRows.map((row) => (
                  <li key={row.key} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">{row.label}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {CONTROL_LABEL[row.baseline]} →{" "}
                      <span className="font-medium text-foreground">{CONTROL_LABEL[row.next]}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {permissionRows.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Permissions
              </p>
              <ul className="space-y-1 text-xs">
                {permissionRows.map((row) => (
                  <li key={row.key} className="flex items-center justify-between gap-2">
                    <code className="min-w-0 truncate">{row.label}</code>
                    <span className="shrink-0 text-muted-foreground">
                      {CONTROL_LABEL[row.baseline]} →{" "}
                      <span className="font-medium text-foreground">{CONTROL_LABEL[row.next]}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="commit-reason">
            Reason <span className="text-destructive">*</span>
          </label>
          <Textarea
            id="commit-reason"
            value={reason}
            maxLength={1000}
            placeholder="Why is this change being made? Recorded in the audit log."
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={commitMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!reasonValid || commitMutation.isPending}
            onClick={() => commitMutation.mutate()}
            className="bg-brand-gradient text-primary-foreground shadow-glow hover:opacity-95"
          >
            {commitMutation.isPending ? "Saving…" : "Confirm & save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------
 * Support ops (Task 22 spec §6.9, Task 23 item 5) — Instagram account health, DM job failures,
 * and pending invites for this one workspace. Kept LIGHT per the brief: read-only tables plus
 * two small confirmed actions (force-refresh a token, resend/revoke an invite) — no new page.
 * Collapsed by default (`open` starts false): this page is already dense, and support ops is a
 * secondary, occasional-use surface. Gated `WORKSPACE_MANAGE`, independently of every other
 * section on this page (requirement 9's established precedent — see `PackageSection`/
 * `RoleSection`'s own independent gates above).
 * ---------------------------------------------------------------------- */

function supportOpsErrorToast(err: unknown, fallback: string) {
  const requestId = err instanceof ApiError ? err.requestId : undefined;
  toast.error(err instanceof Error ? err.message : fallback, {
    description: requestId ? `Request ID: ${requestId}` : undefined,
  });
}

function SupportOpsErrorNote({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs">
      <p className="font-medium text-destructive">{message}</p>
      {requestId && (
        <p className="mt-1 text-muted-foreground">
          Request ID: <span className="font-mono">{requestId}</span>
        </p>
      )}
      <button
        type="button"
        className="mt-2 rounded border px-2 py-1 text-[11px] hover:bg-muted"
        onClick={onRetry}
      >
        Retry
      </button>
    </div>
  );
}

function SupportOpsTableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

/**
 * Replaces the old TrustBadge, which bucketed `trustLevel` at 70 and 40 while the backend only
 * ever sent 1, 2 or 3 — so every account on the platform rendered as the worst tier. The trust
 * ladder is gone in DM engine v2 (spec §12); what an operator gets instead is the account's
 * actual state with Instagram, in escalation order.
 */
function AccountRiskBadge({ health }: { health: AdminIgAccountHealth }) {
  const restricted =
    health.restrictedUntil !== null && new Date(health.restrictedUntil).getTime() > Date.now();
  const reduced =
    health.safetyCapPerHour !== null &&
    health.safetyCapExpiresAt !== null &&
    new Date(health.safetyCapExpiresAt).getTime() > Date.now();

  if (restricted) {
    return (
      <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-[10px] text-destructive">
        Restricted
      </Badge>
    );
  }
  if (health.abuseWarnings > 0) {
    return (
      <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-[10px] text-destructive">
        {health.abuseWarnings} abuse warning{health.abuseWarnings === 1 ? "" : "s"}
      </Badge>
    );
  }
  if (reduced) {
    return (
      <Badge variant="outline" className="border-warning/30 bg-warning/10 text-[10px] tabular-nums text-warning">
        Reduced to {health.safetyCapPerHour}/hr
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-success/30 bg-success/10 text-[10px] tabular-nums text-success">
      Normal · {health.globalCapPerHour}/hr cap
    </Badge>
  );
}

function InstagramAccountsCard({ wsId }: { wsId: string }) {
  const queryClient = useQueryClient();
  const accountsQuery = useQuery({
    queryKey: ["admin-workspace", wsId, "instagram"],
    queryFn: () => listWorkspaceInstagramAccounts(wsId),
  });
  const accounts = accountsQuery.data?.accounts ?? [];
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const refreshMutation = useMutation({
    mutationFn: (accountId: string) => refreshWorkspaceInstagramToken(wsId, accountId),
    onSuccess: (res) => {
      toast.success(
        res.tokenExpiresAt
          ? `Token refreshed — expires ${formatDateTime(res.tokenExpiresAt)}.`
          : "Token refreshed.",
      );
      setRefreshingId(null);
      void queryClient.invalidateQueries({ queryKey: ["admin-workspace", wsId, "instagram"] });
    },
    onError: (err) => {
      setRefreshingId(null);
      supportOpsErrorToast(err, "Failed to refresh this account's token.");
    },
  });

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Instagram accounts
      </h3>
      {accountsQuery.isLoading ? (
        <SupportOpsTableSkeleton />
      ) : accountsQuery.isError ? (
        <SupportOpsErrorNote
          error={accountsQuery.error}
          onRetry={() => void accountsQuery.refetch()}
        />
      ) : accounts.length === 0 ? (
        <p className="text-xs text-muted-foreground">No Instagram accounts connected.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Trust</TableHead>
                <TableHead className="text-right">Failures</TableHead>
                <TableHead>Token expires</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((acct) => {
                const isRefreshing = refreshMutation.isPending && refreshingId === acct.id;
                return (
                  <TableRow key={acct.id}>
                    <TableCell>
                      <p className="text-sm font-medium">{formatHandle(acct.platformUsername)}</p>
                      <p className="text-xs text-muted-foreground">
                        {acct.isActive ? "Active" : "Inactive"}
                        {acct.followerCount != null
                          ? ` · ${acct.followerCount.toLocaleString()} followers`
                          : ""}
                      </p>
                    </TableCell>
                    <TableCell>
                      {acct.health ? (
                        <AccountRiskBadge health={acct.health} />
                      ) : (
                        <span className="text-xs text-muted-foreground">No health data</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {acct.health ? (
                        <span
                          className={cn(
                            acct.health.consecutiveFailures > 0 && "font-medium text-destructive",
                          )}
                        >
                          {acct.health.consecutiveFailures}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {acct.tokenExpiresAt ? formatDateTime(acct.tokenExpiresAt) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        disabled={refreshMutation.isPending}
                        onClick={() => {
                          setRefreshingId(acct.id);
                          refreshMutation.mutate(acct.id);
                        }}
                      >
                        <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
                        Refresh
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

const DM_JOB_STATUS_VALUES: readonly AdminDmJobStatus[] = [
  "QUEUED",
  "SENT",
  "FAILED",
  "RETRYING",
  "SKIPPED_PRIVATE_REPLY_USED",
];

const DM_JOB_STATUS_CLASS: Record<AdminDmJobStatus, string> = {
  QUEUED: "border-muted-foreground/30 text-muted-foreground",
  SENT: "border-success/30 bg-success/10 text-success",
  FAILED: "border-destructive/30 bg-destructive/10 text-destructive",
  RETRYING: "border-warning/30 bg-warning/10 text-warning",
  // Muted, not destructive: this is a clean stand-down, not a failure, and colouring it red
  // would send operators chasing an account problem that does not exist.
  SKIPPED_PRIVATE_REPLY_USED: "border-muted-foreground/30 text-muted-foreground",
};

/** The raw enum value is unreadable in a 32-char badge. */
const DM_JOB_STATUS_LABEL: Record<AdminDmJobStatus, string> = {
  QUEUED: "Queued",
  SENT: "Sent",
  FAILED: "Failed",
  RETRYING: "Retrying",
  SKIPPED_PRIVATE_REPLY_USED: "Skipped · reply used",
};

/** Defaults to `FAILED` — the brief's own framing for this surface ("failed DM jobs"); the status
 *  Select lets an operator widen it without leaving the card. */
function DmJobsCard({ wsId }: { wsId: string }) {
  const [status, setStatus] = useState<AdminDmJobStatus | "ALL">("FAILED");
  const jobsQuery = useQuery({
    queryKey: ["admin-workspace", wsId, "dm-jobs", status],
    queryFn: () =>
      listWorkspaceDmJobs(wsId, { status: status === "ALL" ? undefined : status, limit: 25 }),
  });
  const jobs = jobsQuery.data?.items ?? [];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          DM jobs
        </h3>
        <Select value={status} onValueChange={(v) => setStatus(v as AdminDmJobStatus | "ALL")}>
          <SelectTrigger className="h-7 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {DM_JOB_STATUS_VALUES.map((s) => (
              <SelectItem key={s} value={s}>
                {DM_JOB_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {jobsQuery.isLoading ? (
        <SupportOpsTableSkeleton />
      ) : jobsQuery.isError ? (
        <SupportOpsErrorNote error={jobsQuery.error} onRetry={() => void jobsQuery.refetch()} />
      ) : jobs.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No {status === "ALL" ? "" : `${status.toLowerCase()} `}DM jobs.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Error</TableHead>
                <TableHead className="text-right">Retries</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("text-[10px]", DM_JOB_STATUS_CLASS[job.status])}
                    >
                      {DM_JOB_STATUS_LABEL[job.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{job.recipientIgId}</TableCell>
                  <TableCell
                    className={cn(
                      "max-w-[220px] truncate text-xs",
                      // A skip carries an explanatory note, not an error. Rendering it red sends
                      // operators chasing a problem that is not there.
                      job.status === "SKIPPED_PRIVATE_REPLY_USED"
                        ? "text-muted-foreground"
                        : "text-destructive",
                    )}
                    title={job.error ?? undefined}
                  >
                    {job.error ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {job.retryCount}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDateTime(job.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/** Resend is rate-limited server-side (`inviteResendLimiter`, shared with `team.ts`'s
 *  tenant-facing resend — task-22-report.md §7); a 429 surfaces through the generic
 *  `supportOpsErrorToast` like any other typed error, nothing special-cased here. Revoke is
 *  confirm-gated (AlertDialog) — the one destructive action on this card. */
function WorkspaceInvitesCard({ wsId }: { wsId: string }) {
  const queryClient = useQueryClient();
  const invitesQuery = useQuery({
    queryKey: ["admin-workspace", wsId, "invites"],
    queryFn: () => listWorkspaceInvitesAdmin(wsId),
  });
  const invites = invitesQuery.data?.invites ?? [];
  const [revokeTarget, setRevokeTarget] = useState<AdminWorkspaceInvite | null>(null);

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["admin-workspace", wsId, "invites"] });

  const resendMutation = useMutation({
    mutationFn: (inviteId: string) => resendWorkspaceInviteAdmin(wsId, inviteId),
    onSuccess: (res) => {
      toast.success(
        res.emailSent ? "Invite resent." : "Invite refreshed, but the email failed to send.",
      );
      invalidate();
    },
    onError: (err) => supportOpsErrorToast(err, "Failed to resend this invite."),
  });

  const revokeMutation = useMutation({
    mutationFn: (inviteId: string) => revokeWorkspaceInviteAdmin(wsId, inviteId),
    onSuccess: () => {
      toast.success("Invite revoked.");
      setRevokeTarget(null);
      invalidate();
    },
    onError: (err) => supportOpsErrorToast(err, "Failed to revoke this invite."),
  });

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Pending invites
      </h3>
      {invitesQuery.isLoading ? (
        <SupportOpsTableSkeleton />
      ) : invitesQuery.isError ? (
        <SupportOpsErrorNote
          error={invitesQuery.error}
          onRetry={() => void invitesQuery.refetch()}
        />
      ) : invites.length === 0 ? (
        <p className="text-xs text-muted-foreground">No pending or recently expired invites.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Resent</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((invite) => (
                <TableRow key={invite.id}>
                  <TableCell className="text-sm">{invite.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        invite.status === "PENDING"
                          ? "border-success/30 bg-success/10 text-success"
                          : "border-muted-foreground/30 text-muted-foreground",
                      )}
                    >
                      {humanizeKey(invite.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDateTime(invite.expiresAt)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {invite.resendCount}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        disabled={resendMutation.isPending}
                        onClick={() => resendMutation.mutate(invite.id)}
                      >
                        <Send className="h-3.5 w-3.5" /> Resend
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                        onClick={() => setRevokeTarget(invite)}
                      >
                        <Ban className="h-3.5 w-3.5" /> Revoke
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog
        open={!!revokeTarget}
        onOpenChange={(next) => !revokeMutation.isPending && !next && setRevokeTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this invite?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget?.email} will no longer be able to accept it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={revokeMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (revokeTarget) revokeMutation.mutate(revokeTarget.id);
              }}
            >
              {revokeMutation.isPending ? "Revoking…" : "Revoke invite"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function WorkspaceSupportOpsSection({
  wsId,
  workspaceName,
}: {
  wsId: string;
  workspaceName: string;
}) {
  const canManage = usePlatformCan(WORKSPACE_MANAGE);
  const [open, setOpen] = useState(false);
  if (!canManage) return null;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-2xl border bg-card shadow-soft"
    >
      <CollapsibleTrigger asChild>
        <button type="button" className="flex w-full items-center gap-2 p-4 text-left sm:p-5">
          <ChevronRight
            className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-90")}
          />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-sm font-semibold">Support ops</h2>
            <p className="text-xs text-muted-foreground">
              Instagram health, DM job failures, and pending invites for {workspaceName}.
            </p>
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-5 border-t p-4 sm:p-5">
        <InstagramAccountsCard wsId={wsId} />
        <DmJobsCard wsId={wsId} />
        <WorkspaceInvitesCard wsId={wsId} />
      </CollapsibleContent>
    </Collapsible>
  );
}
