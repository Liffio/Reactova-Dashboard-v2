import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GatingCapability, GatingMap, GatingModule } from "@/lib/api/registry-api";
import { cn } from "@/lib/utils";

/**
 * The registry as a tree: workspace → module → capability.
 *
 * ## Why only one module expands at a time
 *
 * Drawn in full this is 17 modules and ~130 capabilities on one row — several thousand pixels wide
 * and unreadable at any zoom. Selecting a module and drawing only *its* children bounds the widest
 * row by the largest single module (scheduler, 21) rather than by the whole registry, which is the
 * difference between a diagram and a wall.
 *
 * ## What the numbers mean
 *
 * Inside a module node: how many capabilities it holds. Inside a capability node: how many HTTP
 * routes it guards, from `capability_routes` — the only plane that reflects a gate in the source
 * rather than a commercial decision. A `·` means it guards none.
 *
 * Clicking a leaf opens the full depth beneath the tree: every plane that decides whether that
 * capability is reachable, including each route.
 */

const MOD_GAP = 148;
const CAP_GAP = 168;
const ROOT_Y = 46;
const MOD_Y = 168;
const CAP_Y = 322;

/** Rows are centred rather than left-packed, so the trunk stays under the root at any count. */
const rowX = (i: number, count: number, gap: number, width: number) =>
  (width - count * gap) / 2 + i * gap + gap / 2;

const truncate = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

export function CapabilityTree({ map }: { map: GatingMap }) {
  const [openModule, setOpenModule] = useState<string | null>(null);
  const [detail, setDetail] = useState<GatingCapability | null>(null);

  const modules = map.modules;
  const selected = modules.find((m) => m.key === openModule) ?? null;
  const caps = selected?.capabilities ?? [];

  const width = Math.max(modules.length * MOD_GAP, caps.length * CAP_GAP, 640) + 60;
  const height = selected ? 430 : 250;
  const rootX = width / 2;
  const selectedIndex = selected ? modules.indexOf(selected) : -1;

  return (
    <div className="space-y-3">
      {/* Natural size rather than scaled to fit: a tree squeezed into the viewport stops being
          readable long before it stops fitting. The parent Section scrolls it horizontally. */}
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img">
        <title>Module and capability tree</title>

        {modules.map((m, i) => (
          <line
            key={`edge-${m.key}`}
            x1={rootX}
            y1={ROOT_Y + 26}
            x2={rowX(i, modules.length, MOD_GAP, width)}
            y2={MOD_Y - 22}
            className={cn(
              "stroke-muted-foreground/35",
              selected?.key === m.key && "stroke-primary",
            )}
            strokeWidth={selected?.key === m.key ? 2 : 1}
          />
        ))}

        {selected &&
          caps.map((c, i) => (
            <line
              key={`capedge-${c.key}`}
              x1={rowX(selectedIndex, modules.length, MOD_GAP, width)}
              y1={MOD_Y + 22}
              x2={rowX(i, caps.length, CAP_GAP, width)}
              y2={CAP_Y - 18}
              className="stroke-muted-foreground/35"
              strokeWidth={1}
            />
          ))}

        <circle
          cx={rootX}
          cy={ROOT_Y}
          r={26}
          className="fill-primary/25 stroke-primary"
          strokeWidth={1.5}
        />
        <text
          x={rootX}
          y={ROOT_Y + 4}
          textAnchor="middle"
          className="fill-foreground text-[11px] font-semibold"
        >
          WS
        </text>
        <text
          x={rootX}
          y={ROOT_Y + 46}
          textAnchor="middle"
          className="fill-muted-foreground text-[10px]"
        >
          {map.totals.capabilities} capabilities across {map.totals.modules} modules
        </text>

        {modules.map((m, i) => {
          const x = rowX(i, modules.length, MOD_GAP, width);
          const isOpen = selected?.key === m.key;
          return (
            <g
              key={m.key}
              className="cursor-pointer"
              onClick={() => {
                setOpenModule(isOpen ? null : m.key);
                setDetail(null);
              }}
            >
              <title>{`${m.key} — ${m.capabilities.length} capabilities`}</title>
              <circle
                cx={x}
                cy={MOD_Y}
                r={22}
                strokeWidth={1}
                className={cn(
                  isOpen ? "fill-primary/35 stroke-primary" : "fill-muted stroke-border",
                  // Faded = a package ceiling can never strip this module's CRUD, so putting it in
                  // a tier changes nothing. A property of the registry, not of pricing.
                  !m.gateable && !isOpen && "opacity-50",
                )}
              />
              <text
                x={x}
                y={MOD_Y + 4}
                textAnchor="middle"
                className="fill-foreground text-[11px] font-semibold"
              >
                {m.capabilities.length}
              </text>
              <text
                x={x}
                y={MOD_Y + 38}
                textAnchor="middle"
                className={cn(
                  "text-[10px]",
                  isOpen ? "fill-foreground font-medium" : "fill-muted-foreground",
                )}
              >
                {truncate(m.key, 16)}
              </text>
            </g>
          );
        })}

        {selected &&
          caps.map((c, i) => {
            const x = rowX(i, caps.length, CAP_GAP, width);
            const action = c.key.includes(":") ? c.key.slice(c.key.indexOf(":") + 1) : c.key;
            const unsold = c.packages.length === 0;
            return (
              <g key={c.key} className="cursor-pointer" onClick={() => setDetail(c)}>
                <title>
                  {`${c.key} — ${c.packages.length} tiers, ${c.roles.length} roles, ${c.routes.length} routes`}
                </title>
                <circle
                  cx={x}
                  cy={CAP_Y}
                  r={18}
                  strokeWidth={1}
                  className={cn(
                    detail?.key === c.key
                      ? "fill-primary/40 stroke-primary"
                      : unsold
                        ? "fill-warning/20 stroke-warning/60"
                        : "fill-success/20 stroke-success/60",
                  )}
                />
                <text
                  x={x}
                  y={CAP_Y + 4}
                  textAnchor="middle"
                  className="fill-foreground text-[10px]"
                >
                  {c.routes.length || "·"}
                </text>
                <text
                  x={x}
                  y={CAP_Y + 34}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px]"
                >
                  {truncate(action, 17)}
                </text>
              </g>
            );
          })}
      </svg>

      {!selected && (
        <p className="text-xs text-muted-foreground">
          Pick a module to draw its capabilities. The number inside a module is how many
          capabilities it holds; inside a capability, how many routes it guards.
        </p>
      )}
      {selected && !detail && <ModuleDetail module={selected} />}
      {detail && <CapabilityDetail cap={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

/** What the registry knows about a module, shown while one is expanded. */
function ModuleDetail({ module: m }: { module: GatingModule }) {
  const rows: Array<[string, React.ReactNode]> = [
    ["Key", <code key="k">{m.key}</code>],
    ["Surface", m.surface],
    ["Route", m.route || <span className="text-muted-foreground">— none</span>],
    ["API prefix", m.apiPrefix || <span className="text-muted-foreground">— none</span>],
    [
      "Sidebar needs",
      m.requiredPermission ? <code key="p">{m.requiredPermission}</code> : "— nothing",
    ],
    ["Package can gate it", m.gateable ? "yes" : "no — CRUD survives every ceiling"],
    ["Module enabled", m.isEnabled ? "yes" : "no — its API is masked to 404"],
  ];

  return (
    <div className="space-y-2 border-t pt-3">
      <p className="text-sm font-medium">{m.name}</p>
      <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-2">
            <dt className="min-w-[130px] shrink-0 text-muted-foreground">{label}</dt>
            <dd className="min-w-0 break-words">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        Click any capability above for its tiers, roles and route gates.
      </p>
    </div>
  );
}

/** Full depth for one capability — every plane that decides whether it is reachable. */
function CapabilityDetail({ cap, onClose }: { cap: GatingCapability; onClose: () => void }) {
  return (
    <div className="space-y-3 border-t pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{cap.key}</code>
        <span className="text-sm font-medium">{cap.name}</span>
        {!cap.isEnabled && (
          <Badge variant="outline" className="border-destructive/40 text-destructive">
            disabled
          </Badge>
        )}
        <Button variant="ghost" size="sm" className="ml-auto" onClick={onClose}>
          Close
        </Button>
      </div>

      {cap.description && <p className="text-xs text-muted-foreground">{cap.description}</p>}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <p className="text-xs font-medium">Sold by</p>
          {cap.packages.length === 0 ? (
            <p className="text-xs text-warning">
              No package sells this. On any workspace that has a package, nobody can hold it.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {cap.packages.map((p) => (
                <code
                  key={p}
                  className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary"
                >
                  {p}
                </code>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium">Grantable by</p>
          {cap.roles.length === 0 ? (
            <p className="text-xs text-warning">
              No role grants this, so it is unreachable inside every tenant whatever was bought.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {cap.roles.map((r) => (
                <code
                  key={r}
                  className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  {r}
                </code>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium">Routes it guards</p>
          {cap.routes.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              None. Sold, but gating nothing at the API — enforced in the UI only, or not at all.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {cap.routes.map((r) => (
                <li key={`${r.method}${r.path}`} className="font-mono text-[10px]">
                  <span className="font-semibold">{r.method}</span> {r.path}
                  {!r.isEnabled && <span className="ml-1 text-muted-foreground">(disabled)</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
