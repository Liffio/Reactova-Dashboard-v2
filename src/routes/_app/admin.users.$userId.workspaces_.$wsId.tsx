import { useMemo, useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronRight,
  KeyRound,
  Search,
  ShieldAlert,
  ShieldQuestion,
} from "lucide-react";

import { PlatformPermissionRoute } from "@/components/auth/guards";
import { PageErrorBoundary } from "@/components/error-boundary";
import { BackLink, CopyableKey, EmptyState } from "@/components/admin/form-page";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { ApiError } from "@/lib/api/http";
import {
  getAdminUserWorkspaces,
  getEffectiveAccess,
  type AdminUserEffectiveAccess,
  type EffectiveAccessChild,
  type EffectiveAccessDecidedBy,
  type EffectiveAccessLayer,
  type EffectiveAccessPermission,
  type EffectiveAccessTraceEntry,
  type ModuleEnforcementState,
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

function EffectiveAccessPage() {
  const { userId, wsId } = useParams({
    from: "/_app/admin/users/$userId/workspaces_/$wsId",
  });

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

  const [filterText, setFilterText] = useState("");
  const [selection, setSelection] = useState<Selection>(null);
  const [expandedParents, setExpandedParents] = useState<Set<string> | null>(null);

  const data = accessQuery.data;

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
          <AccessSummary data={data} />

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
                    />
                  ))}
                </div>
              )}

              <div className="border-t pt-4">
                <PermissionsSection
                  permissions={data.permissions}
                  selection={selection}
                  onSelect={(key) => setSelection({ kind: "permission", key })}
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

/** Package/unrestricted banner, role line, and read-only limits list — the "ceiling" this
 *  workspace's access is being resolved against. `abacDenies` gets its own separate, more
 *  visually prominent card below when non-empty, per the brief. */
function AccessSummary({ data }: { data: AdminUserEffectiveAccess }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
        {data.unrestricted ? (
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

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
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

        <LimitsList limits={data.limits} />
      </div>

      {data.abacDenies.length > 0 && <AbacDeniesCard denies={data.abacDenies} />}
    </div>
  );
}

/** `-1` means unlimited, matching `PackageLimit`'s convention elsewhere in this codebase
 *  (`registry-api.ts`). */
function formatLimitValue(value: number): string {
  return value === -1 ? "Unlimited" : value.toLocaleString();
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

/** ENFORCED (green check) vs NOT ENFORCED (amber triangle, covering both DECLARED and UNMAPPED —
 *  the tooltip is what tells those two apart). */
function EnforcementBadge({ state }: { state: ModuleEnforcementState }) {
  if (state === "ENFORCED") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center text-success">
            <Check className="h-3.5 w-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent>A real permission check in the backend enforces this.</TooltipContent>
      </Tooltip>
    );
  }
  const detail =
    state === "DECLARED"
      ? "Declared in the registry, but nothing in the backend checks it yet — toggling this module changes nothing today."
      : "Unmapped — no permission backs this module/action at all. There's no enforcement point to toggle.";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center text-warning">
          <AlertTriangle className="h-3.5 w-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        Not enforced ({state === "DECLARED" ? "declared" : "unmapped"}) — {detail}
      </TooltipContent>
    </Tooltip>
  );
}

function ParentRow({
  parent,
  expanded,
  toggleDisabled,
  onToggle,
  selection,
  onSelectChild,
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
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ChildRow({
  child,
  selected,
  onSelect,
}: {
  child: EffectiveAccessChild;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
        selected ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/50",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate">{child.name}</span>
        <code className="text-[10px] text-muted-foreground">{child.key}</code>
      </span>
      <EnforcementBadge state={child.enforcementState} />
      <EffectivePill effective={child.effective} decidedBy={child.decidedBy} />
    </button>
  );
}

function PermissionsSection({
  permissions,
  selection,
  onSelect,
}: {
  permissions: EffectiveAccessPermission[];
  selection: Selection;
  onSelect: (key: string) => void;
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
                {perms.map((perm) => (
                  <button
                    key={perm.key}
                    type="button"
                    onClick={() => onSelect(perm.key)}
                    aria-pressed={selection?.kind === "permission" && selection.key === perm.key}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                      selection?.kind === "permission" && selection.key === perm.key
                        ? "bg-primary/10 ring-1 ring-primary/30"
                        : "hover:bg-muted/50",
                    )}
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
                ))}
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
