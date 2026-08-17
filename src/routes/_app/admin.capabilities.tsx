import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Boxes, Search } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformPermissionRoute } from "@/components/auth/guards";
import { PageErrorBoundary } from "@/components/error-boundary";
import { EmptyState } from "@/components/admin/form-page";
import { EnforcementBadge } from "@/components/admin/enforcement-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/http";
import {
  getCapabilityCoverage,
  type CapabilityChildModule,
  type CapabilityParentModule,
  type ModuleEnforcementState,
} from "@/lib/api/admin-capabilities-api";

/**
 * Capability coverage report (Task 23, spec §3, §7.5) — read-only. Reuses `getRegistryTree()`'s
 * shape additively extended with `enforcementState` per child. Gated `platform:metrics_read`
 * (task-22-report.md §3), a distinct, narrower read than `/module-registry`'s
 * `platform:module_manage`-gated CRUD console — this page never mutates the registry.
 */
const METRICS_READ = "platform:metrics_read";

export const Route = createFileRoute("/_app/admin/capabilities")({
  head: () => ({ meta: [{ title: "Capability Coverage — Admin" }] }),
  component: AdminCapabilitiesRoute,
});

function AdminCapabilitiesRoute() {
  return (
    <PlatformPermissionRoute permission={METRICS_READ}>
      <PageErrorBoundary label="admin-capabilities">
        <AdminCapabilitiesPage />
      </PageErrorBoundary>
    </PlatformPermissionRoute>
  );
}

function AdminCapabilitiesPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Platform admin"
        title="Capability coverage"
        description="Every module/action the registry declares, and whether a real permission check in the backend actually enforces it."
      />
      <div className="space-y-4 p-4 sm:p-6 md:p-10">
        <CapabilityCoveragePanel />
      </div>
    </div>
  );
}

type StateFilter = "ALL" | ModuleEnforcementState;

const STATE_FILTERS: Array<{ value: StateFilter; label: string }> = [
  { value: "ALL", label: "All states" },
  { value: "ENFORCED", label: "Enforced" },
  { value: "DECLARED", label: "Declared, not enforced" },
  { value: "UNMAPPED", label: "Unmapped" },
];

function ErrorPanel({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  const message = error instanceof Error ? error.message : "Couldn't load capability coverage.";
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-8 text-center">
      <AlertCircle className="mx-auto mb-2 h-6 w-6 text-destructive" />
      <p className="text-sm font-medium text-destructive">{message}</p>
      {requestId && (
        <p className="mt-2 text-xs text-muted-foreground">
          Request ID: <span className="font-mono">{requestId}</span> — quote this when reporting.
        </p>
      )}
      <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  active,
  onClick,
  toneClassName,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
  toneClassName: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border bg-card p-4 text-left shadow-soft transition-colors hover:bg-muted/40",
        active && "ring-2 ring-primary/50",
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-display text-2xl font-semibold tracking-tight", toneClassName)}>
        {value.toLocaleString()}
      </p>
    </button>
  );
}

function ChildStateExplainer() {
  return (
    <div className="grid gap-3 rounded-2xl border bg-card p-4 shadow-soft sm:grid-cols-3 sm:p-5">
      <div className="flex items-start gap-2">
        <EnforcementBadge state="ENFORCED" />
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Enforced</span> — a real permission check in
          the backend gates this module/action. Toggling it changes what a user can actually do.
        </p>
      </div>
      <div className="flex items-start gap-2">
        <EnforcementBadge state="DECLARED" />
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Declared</span> — the registry knows about
          this capability, but nothing in the backend checks it yet. Toggling it records intent
          only.
        </p>
      </div>
      <div className="flex items-start gap-2">
        <EnforcementBadge state="UNMAPPED" />
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Unmapped</span> — no permission backs this
          module/action at all. There's no enforcement point to toggle.
        </p>
      </div>
    </div>
  );
}

function ChildModuleRow({ child }: { child: CapabilityChildModule }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/10 px-3 py-2 text-sm">
      <EnforcementBadge state={child.enforcementState} />
      <span className="min-w-0 flex-1 truncate font-medium">{child.name}</span>
      <span className="truncate font-mono text-[11px] text-muted-foreground">{child.key}</span>
      {!child.isEnabled && (
        <Badge variant="outline" className="text-[10px] text-muted-foreground">
          Disabled
        </Badge>
      )}
    </div>
  );
}

function ParentModuleCard({ parent }: { parent: CapabilityParentModule }) {
  const enforcedCount = parent.children.filter((c) => c.enforcementState === "ENFORCED").length;
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-display text-sm font-semibold">{parent.name}</h3>
          <p className="truncate font-mono text-[11px] text-muted-foreground">{parent.key}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {!parent.isEnabled && (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              Disabled
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px] tabular-nums">
            {enforcedCount}/{parent.children.length} enforced
          </Badge>
        </div>
      </div>
      <div className="space-y-1.5">
        {parent.children.map((child) => (
          <ChildModuleRow key={child.id} child={child} />
        ))}
      </div>
    </div>
  );
}

function CapabilityCoveragePanel() {
  const [filterText, setFilterText] = useState("");
  const [stateFilter, setStateFilter] = useState<StateFilter>("ALL");

  const coverageQuery = useQuery({
    queryKey: ["admin-capabilities"],
    queryFn: () => getCapabilityCoverage(),
    staleTime: 30_000,
  });

  const modules = useMemo(() => coverageQuery.data?.modules ?? [], [coverageQuery.data]);

  const totals = useMemo(() => {
    let enforced = 0;
    let declared = 0;
    let unmapped = 0;
    for (const parent of modules) {
      for (const child of parent.children) {
        if (child.enforcementState === "ENFORCED") enforced++;
        else if (child.enforcementState === "DECLARED") declared++;
        else unmapped++;
      }
    }
    return { enforced, declared, unmapped, total: enforced + declared + unmapped };
  }, [modules]);

  const filteredModules = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return modules
      .map((parent) => {
        const children = parent.children.filter((child) => {
          if (stateFilter !== "ALL" && child.enforcementState !== stateFilter) return false;
          if (!q) return true;
          return (
            child.name.toLowerCase().includes(q) ||
            child.key.toLowerCase().includes(q) ||
            parent.name.toLowerCase().includes(q) ||
            parent.key.toLowerCase().includes(q)
          );
        });
        return { ...parent, children };
      })
      .filter((parent) => parent.children.length > 0);
  }, [modules, filterText, stateFilter]);

  if (coverageQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (coverageQuery.isError) {
    return <ErrorPanel error={coverageQuery.error} onRetry={() => void coverageQuery.refetch()} />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <SummaryCard
          label={`${totals.enforced}/${totals.total} enforced`}
          value={totals.enforced}
          active={stateFilter === "ENFORCED"}
          onClick={() => setStateFilter(stateFilter === "ENFORCED" ? "ALL" : "ENFORCED")}
          toneClassName="text-success"
        />
        <SummaryCard
          label="Declared, not enforced"
          value={totals.declared}
          active={stateFilter === "DECLARED"}
          onClick={() => setStateFilter(stateFilter === "DECLARED" ? "ALL" : "DECLARED")}
          toneClassName="text-warning"
        />
        <SummaryCard
          label="Unmapped"
          value={totals.unmapped}
          active={stateFilter === "UNMAPPED"}
          onClick={() => setStateFilter(stateFilter === "UNMAPPED" ? "ALL" : "UNMAPPED")}
          toneClassName="text-warning"
        />
        <SummaryCard
          label="Total capabilities"
          value={totals.total}
          active={stateFilter === "ALL"}
          onClick={() => setStateFilter("ALL")}
          toneClassName="text-foreground"
        />
      </div>

      <ChildStateExplainer />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter by module or key…"
            className="h-9 pl-9"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>
        <Select value={stateFilter} onValueChange={(v) => setStateFilter(v as StateFilter)}>
          <SelectTrigger className="h-9 w-[220px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATE_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="gap-1.5" asChild>
          <Link to="/module-registry">
            <Boxes className="h-3.5 w-3.5" /> Manage registry
          </Link>
        </Button>
      </div>

      {filteredModules.length === 0 ? (
        <EmptyState icon={Search} title="No capabilities match that filter">
          Try a different name, key, or state.
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredModules.map((parent) => (
            <ParentModuleCard key={parent.id} parent={parent} />
          ))}
        </div>
      )}
    </div>
  );
}
