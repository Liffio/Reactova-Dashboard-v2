import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  GitBranch,
  Layers,
  Lock,
  RefreshCw,
  Route as RouteIcon,
  Shield,
} from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { CapabilityTree } from "@/components/admin/capability-tree";
import { PlatformPermissionRoute } from "@/components/auth/guards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getGatingMap,
  type GatingCapability,
  type GatingMap,
  type GatingModule,
} from "@/lib/api/registry-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/admin/gating-map")({
  component: GatingMapPage,
});

/**
 * The gating map — what is actually gated behind what, read from the database.
 *
 * ## Why this page is not the pricing page
 *
 * The marketing site and `config/tierDefinitions.ts` both describe what the product is *meant* to
 * sell. This describes what the running system will let a tenant do tonight, and those have
 * repeatedly been different things: production has held capabilities filed under the wrong parent,
 * a Free tier missing the keyword triggers its own tier matrix documents, and route gates for
 * capabilities no package sells. Every number here comes from a table, so where the two disagree,
 * this is the side customers experience.
 *
 * ## Read-only, and live
 *
 * Nothing here writes. It re-reads on window focus and every 30s, so editing a package in another
 * tab is reflected here without a reload — which is the point of rendering it from the tables
 * rather than from a constant.
 *
 * ## Diagrams are SVG, not <canvas>
 *
 * Deliberate: SVG text stays selectable and searchable, scales without blurring on a high-DPI
 * screen, inherits the theme tokens so it is correct in dark mode for free, and is reachable by a
 * screen reader. A `<canvas>` would be a bitmap that gets none of that and would need re-drawing on
 * every resize and theme change.
 */

const REFETCH_MS = 30_000;

function GatingMapPage() {
  return (
    // Read-only diagnostics: no notification bar, because nothing on this page changes access.
    <PlatformPermissionRoute permission="platform:module_manage" notifyDelivery={false}>
      <GatingMapInner />
    </PlatformPermissionRoute>
  );
}

function GatingMapInner() {
  const query = useQuery({
    queryKey: ["gating-map"],
    queryFn: getGatingMap,
    refetchInterval: REFETCH_MS,
    refetchOnWindowFocus: true,
  });

  return (
    <div>
      <PageHeader
        eyebrow="Platform"
        title="Gating map"
        description="What is actually gated behind what — read from the database, not from the tier matrix. Read-only, and refreshes itself."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw className={cn("h-4 w-4", query.isFetching && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      <div className="space-y-8 p-4 sm:p-6 md:p-10">
        {query.isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-2xl" />
            ))}
          </div>
        ) : query.isError ? (
          <p className="text-sm text-destructive">
            Could not load the gating map. {(query.error as Error).message}
          </p>
        ) : query.data ? (
          <>
            <Totals map={query.data} />
            <ResolutionFlow map={query.data} />
            <LadderDiagram map={query.data} />
            <CapabilityTreeSection map={query.data} />
            <ModuleGateMatrix map={query.data} />
            <DeadEnds map={query.data} />
            <p className="text-center text-[11px] text-muted-foreground">
              Read at {new Date(query.data.generatedAt).toLocaleTimeString()} · refreshes every{" "}
              {REFETCH_MS / 1000}s and on focus
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}

/* ── Shared shells ───────────────────────────────────────────────────────────────────────────── */

function Section({
  icon: Icon,
  title,
  summary,
  children,
}: {
  icon: typeof Shield;
  title: string;
  /** Prose explaining what the diagram shows and why it matters. Written to be read first. */
  summary: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <div className="max-w-3xl space-y-2 text-sm text-muted-foreground">{summary}</div>
      {/* Wide diagrams scroll inside their own box — the page body must never scroll sideways. */}
      <div className="overflow-x-auto rounded-2xl border bg-card p-4">{children}</div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" | "bad" }) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        tone === "bad" && value > 0 && "border-destructive/40 bg-destructive/5",
        tone === "warn" && value > 0 && "border-warning/40 bg-warning/5",
      )}
    >
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function Totals({ map }: { map: GatingMap }) {
  const t = map.totals;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      <Stat label="Packages" value={t.packages} />
      <Stat label="Modules" value={t.modules} />
      <Stat label="Capabilities" value={t.capabilities} />
      <Stat label="Gateable modules" value={t.gateableModules} />
      <Stat label="Route gates" value={t.routeGates} />
      <Stat label="Sold by no package" value={t.unsoldCapabilities} tone="warn" />
      <Stat label="Mapped nowhere" value={t.unmappedCapabilities} tone="bad" />
    </div>
  );
}

/* ── 1. Resolution flow ──────────────────────────────────────────────────────────────────────── */

/**
 * The order the code actually resolves access in. Structure is fixed (it mirrors the request
 * pipeline); the counts on each stage come from the live map, so it stays honest as data changes.
 */
function ResolutionFlow({ map }: { map: GatingMap }) {
  const stages = [
    {
      label: "Registered",
      detail: `${map.totals.capabilities} capabilities`,
      note: "child_modules",
    },
    { label: "Mapped", detail: `${map.totals.modules} modules`, note: "module_mappings" },
    {
      label: "Module enabled",
      detail: `${map.modules.filter((m) => m.isEnabled).length} enabled`,
      note: "parent_modules.is_enabled",
    },
    {
      label: "Role grants it",
      detail: `${map.roles.length} roles`,
      note: "role_child_modules",
    },
    {
      label: "Package entitles it",
      detail: `${map.totals.gateableModules} gateable`,
      note: "package_features",
    },
  ];

  return (
    <Section
      icon={Shield}
      title="1 · How a capability becomes usable"
      summary={
        <>
          <p>
            Five conditions, joined by AND. This is the rule{" "}
            <code className="rounded bg-muted px-1">services/entitlement.ts</code> enforces, not a
            description of it — a capability failing <em>any</em> one of these is inert, and the
            failure looks different each time: a page that 403s, a sidebar link that never appears,
            or access that silently vanishes when a package is applied.
          </p>
          <p>
            The last stage is the one that surprises people. A role can grant a capability and the
            package ceiling will still strip it, because <code>applyEntitlement</code> filters role
            grants down to what the workspace&rsquo;s package includes — but{" "}
            <strong>only for gateable modules</strong> ({map.totals.gateableModules} of{" "}
            {map.totals.modules}), and only when the workspace has a package at all. A workspace
            with no package is unrestricted.
          </p>
        </>
      }
    >
      <svg viewBox="0 0 980 130" className="w-full min-w-[720px]" role="img">
        <title>Capability resolution pipeline</title>
        {stages.map((s, i) => {
          const x = i * 196;
          return (
            <g key={s.label}>
              <rect
                x={x + 8}
                y={26}
                width={172}
                height={66}
                rx={10}
                className="fill-muted/40 stroke-border"
                strokeWidth={1}
              />
              <text
                x={x + 94}
                y={50}
                textAnchor="middle"
                className="fill-foreground text-[13px] font-medium"
              >
                {s.label}
              </text>
              <text
                x={x + 94}
                y={68}
                textAnchor="middle"
                className="fill-muted-foreground text-[11px]"
              >
                {s.detail}
              </text>
              <text
                x={x + 94}
                y={84}
                textAnchor="middle"
                className="fill-muted-foreground/70 text-[9px]"
              >
                {s.note}
              </text>
              {i < stages.length - 1 && (
                <g>
                  <line
                    x1={x + 180}
                    y1={59}
                    x2={x + 204}
                    y2={59}
                    className="stroke-muted-foreground/50"
                    strokeWidth={1.5}
                  />
                  <text
                    x={x + 192}
                    y={50}
                    textAnchor="middle"
                    className="fill-muted-foreground/70 text-[11px]"
                  >
                    ∧
                  </text>
                </g>
              )}
            </g>
          );
        })}
        <text x={490} y={118} textAnchor="middle" className="fill-muted-foreground text-[11px]">
          all five true → the capability is usable · any one false → inert
        </text>
      </svg>
    </Section>
  );
}

/* ── 2. Ladder ───────────────────────────────────────────────────────────────────────────────── */

/** The sellable ladder as bars, sized by capability count, with what each tier adds over the last. */
function LadderDiagram({ map }: { map: GatingMap }) {
  const sellable = map.packages.filter((p) => p.isActive && p.isPublic);
  const max = Math.max(...sellable.map((p) => p.capabilityCount), 1);

  return (
    <Section
      icon={Layers}
      title="2 · The package ladder, as sold"
      summary={
        <>
          <p>
            Active and public packages in <code>sort_order</code> — the ladder the write-path
            validator holds every package edit to. Each tier is meant to include everything the tier
            below it sells, so the bars should only ever grow left to right.
          </p>
          <p>
            A bar that is <strong>shorter than the one before it</strong> means a customer upgrading
            into it loses capabilities they were paying for. Non-public and archived packages are
            excluded because they are off the ladder by construction and are never checked against
            it.
          </p>
        </>
      }
    >
      <svg
        viewBox={`0 0 ${Math.max(sellable.length * 150, 300)} 210`}
        className="w-full min-w-[560px]"
        role="img"
      >
        <title>Package ladder by capability count</title>
        {sellable.map((p, i) => {
          const h = Math.round((p.capabilityCount / max) * 120);
          const x = i * 150 + 20;
          const prev = sellable[i - 1];
          const shrinks = prev ? p.capabilityCount < prev.capabilityCount : false;
          return (
            <g key={p.id}>
              <rect
                x={x}
                y={150 - h}
                width={104}
                height={h}
                rx={8}
                className={cn(
                  shrinks
                    ? "fill-destructive/30 stroke-destructive"
                    : "fill-primary/25 stroke-primary/50",
                )}
                strokeWidth={1}
              />
              <text
                x={x + 52}
                y={145 - h}
                textAnchor="middle"
                className="fill-foreground text-[13px] font-semibold"
              >
                {p.capabilityCount}
              </text>
              <text
                x={x + 52}
                y={170}
                textAnchor="middle"
                className="fill-foreground text-[12px] font-medium"
              >
                {p.name}
              </text>
              <text
                x={x + 52}
                y={186}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {p.workspaceCount} workspace{p.workspaceCount === 1 ? "" : "s"}
              </text>
              {shrinks && (
                <text
                  x={x + 52}
                  y={202}
                  textAnchor="middle"
                  className="fill-destructive text-[10px] font-medium"
                >
                  ↓ loses on upgrade
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </Section>
  );
}

/* ── 3. Module × gate matrix ─────────────────────────────────────────────────────────────────── */

/** Every capability, and the four planes that decide whether anyone can reach it. */
function ModuleGateMatrix({ map }: { map: GatingMap }) {
  const [filter, setFilter] = useState("");
  const sellable = useMemo(
    () => map.packages.filter((p) => p.isActive && p.isPublic),
    [map.packages],
  );

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return map.modules;
    return map.modules
      .map((m) => {
        if (m.key.includes(q) || m.name.toLowerCase().includes(q)) return m;
        const caps = m.capabilities.filter(
          (c) => c.key.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
        );
        return caps.length ? { ...m, capabilities: caps } : null;
      })
      .filter((m): m is GatingModule => m !== null);
  }, [map.modules, filter]);

  return (
    <Section
      icon={Lock}
      title="4 · Every capability, and what gates it"
      summary={
        <>
          <p>
            One row per capability. <strong>Tiers</strong> is which packages sell it,{" "}
            <strong>Roles</strong> is how many roles may grant it, and <strong>Routes</strong> is
            how many HTTP endpoints it actually guards, from <code>capability_routes</code> — the
            only plane here that reflects a gate in the source rather than a commercial decision.
          </p>
          <p>
            The interesting rows are the mismatches. A capability with{" "}
            <strong>routes but no tier</strong> guards live endpoints nobody can buy. One with{" "}
            <strong>tiers but no routes</strong> is sold but gates nothing — it may be enforced in
            the UI only, or not at all. Neither shows up on any other screen.
          </p>
        </>
      }
    >
      <div className="space-y-3">
        <Input
          className="max-w-sm"
          placeholder="Filter modules and capabilities…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="min-w-[720px] space-y-4">
          {visible.map((m) => (
            <div key={m.key} className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{m.name}</span>
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                  {m.key}
                </code>
                <Badge variant="outline" className="font-normal">
                  {m.surface}
                </Badge>
                {m.gateable ? (
                  <Badge variant="outline" className="border-primary/40 font-normal text-primary">
                    gateable
                  </Badge>
                ) : (
                  <Badge variant="outline" className="font-normal text-muted-foreground">
                    never gated by package
                  </Badge>
                )}
                {!m.isEnabled && (
                  <Badge variant="outline" className="border-destructive/40 text-destructive">
                    disabled — API masked to 404
                  </Badge>
                )}
              </div>
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Capability</th>
                    <th className="py-1 pr-3 font-medium">Tiers</th>
                    <th className="py-1 pr-3 font-medium">Roles</th>
                    <th className="py-1 font-medium">Routes</th>
                  </tr>
                </thead>
                <tbody>
                  {m.capabilities.map((c) => (
                    <CapabilityRow
                      key={`${m.key}:${c.key}`}
                      cap={c}
                      tiers={sellable.map((p) => p.key)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function CapabilityRow({ cap, tiers }: { cap: GatingCapability; tiers: string[] }) {
  const sold = tiers.filter((t) => cap.packages.includes(t));
  const orphanRoutes = sold.length === 0 && cap.routes.length > 0;

  return (
    <tr className={cn("border-t", orphanRoutes && "bg-warning/5")}>
      <td className="py-1.5 pr-3">
        <code className="font-mono text-[11px]">{cap.key}</code>
        {!cap.isEnabled && <span className="ml-2 text-[10px] text-destructive">disabled</span>}
      </td>
      <td className="py-1.5 pr-3">
        {sold.length === 0 ? (
          <span className="text-muted-foreground">— none</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {sold.map((t) => (
              <code key={t} className="rounded bg-primary/10 px-1 py-0.5 text-[10px] text-primary">
                {t}
              </code>
            ))}
          </span>
        )}
      </td>
      <td className="py-1.5 pr-3 tabular-nums text-muted-foreground">{cap.roles.length}</td>
      <td className="py-1.5">
        {cap.routes.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span
            className={cn(
              "tabular-nums",
              orphanRoutes ? "font-medium text-warning" : "text-foreground",
            )}
            title={cap.routes.map((r) => `${r.method} ${r.path}`).join("\n")}
          >
            {cap.routes.length}
          </span>
        )}
      </td>
    </tr>
  );
}

/* ── 4. Dead ends ────────────────────────────────────────────────────────────────────────────── */

/** The three ways a capability can exist and still be unreachable. */
function DeadEnds({ map }: { map: GatingMap }) {
  const all = map.modules.flatMap((m) => m.capabilities);
  const seen = new Set<string>();
  const unique = all.filter((c) => (seen.has(c.key) ? false : (seen.add(c.key), true)));

  const unsold = unique.filter((c) => c.packages.length === 0);
  const ungranted = unique.filter((c) => c.roles.length === 0);
  const routesButUnsold = unsold.filter((c) => c.routes.length > 0);

  const groups = [
    {
      title: "Sold by no package",
      caps: unsold,
      why: "No tier includes it, so on any workspace that has a package, nobody can hold it. Harmless if deliberate (an unfinished feature); a bug if the tier matrix says otherwise.",
    },
    {
      title: "Granted by no role",
      caps: ungranted,
      why: "Even on a package that sells it, no role can hold it — so it is unreachable inside every tenant regardless of what was bought.",
    },
    {
      title: "Guards live routes but no tier sells it",
      caps: routesButUnsold,
      why: "The sharpest one. These capabilities gate real endpoints, and no package grants them — so those endpoints are closed to every packaged workspace.",
    },
  ];

  return (
    <Section
      icon={AlertTriangle}
      title="5 · Dead ends"
      summary={
        <p>
          Capabilities that exist but cannot be reached, grouped by which plane breaks the chain.
          None of these are errors on their own — an unfinished feature legitimately sits here — but
          each is a place where the registry and the tier matrix have drifted apart, and this is the
          only view that shows them together.
        </p>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        {groups.map((g) => (
          <div key={g.title} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{g.title}</span>
              <Badge
                variant="outline"
                className={cn(g.caps.length > 0 && "border-warning/40 text-warning")}
              >
                {g.caps.length}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{g.why}</p>
            <div className="flex flex-wrap gap-1">
              {g.caps.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  Nothing — this plane is clean.
                </span>
              ) : (
                g.caps.map((c) => (
                  <code
                    key={c.key}
                    className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                  >
                    {c.key}
                  </code>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
        <RouteIcon className="h-3.5 w-3.5" />
        {map.totals.unmappedCapabilities > 0 ? (
          <span className="text-destructive">
            {map.totals.unmappedCapabilities} capabilit
            {map.totals.unmappedCapabilities === 1 ? "y has" : "ies have"} no{" "}
            <code>module_mappings</code> row at all — dead three ways over: no package can include
            them, and role grants and user overrides are both dropped by an INNER JOIN.
          </span>
        ) : (
          <span>Every capability is mapped to a parent module.</span>
        )}
      </div>
    </Section>
  );
}

/* -- 3. Capability tree ---------------------------------------------------------------------- */

/**
 * Wraps the tree in this page's Section shell so it carries a summary like every other diagram.
 * The tree itself lives in its own component because it owns interaction state, and mixing that
 * into a file of otherwise-static diagrams makes both harder to follow.
 */
function CapabilityTreeSection({ map }: { map: GatingMap }) {
  return (
    <Section
      icon={GitBranch}
      title="3 &middot; The registry as a tree"
      summary={
        <>
          <p>
            Workspace &rarr; module &rarr; capability, as the registry actually stores it. Click a
            module to draw its capabilities; click a capability to open every plane that decides
            whether anyone can reach it, including the exact routes it guards.
          </p>
          <p>
            A module drawn <span className="text-muted-foreground">faded</span> is not gateable by a
            package &mdash; its CRUD survives any ceiling, so putting it in a tier changes nothing.
            That is a property of the registry (its surface, plus whether anything is mapped under
            it), not a pricing decision, and it is invisible on every other screen.
          </p>
        </>
      }
    >
      <CapabilityTree map={map} />
    </Section>
  );
}
