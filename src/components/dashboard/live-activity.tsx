import { useMemo, useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Check, MousePointerClick, Send } from "lucide-react";

import {
  getLiveActivitySnapshot,
  subscribeLiveActivity,
  type LiveActivityEntry,
  type LiveActivityKind,
} from "@/lib/live-activity-log";
import { cn } from "@/lib/utils";

const VISIBLE = 8;

/** Stable identity — a fresh `[]` from the server snapshot would re-render forever. */
const EMPTY: LiveActivityEntry[] = [];

const ICON: Record<LiveActivityKind, typeof Send> = {
  dm: Send,
  lead: Check,
  click: MousePointerClick,
  failure: AlertCircle,
};

const TONE: Record<LiveActivityKind, string> = {
  dm: "border-primary-edge bg-primary-wash text-primary",
  lead: "border-success-edge bg-success-wash text-success",
  click: "border-border bg-muted text-muted-foreground",
  failure: "border-destructive/40 bg-destructive-wash text-destructive",
};

/** Relative time, coarse on purpose — this list is about ordering, not precision. */
function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 10) return "now";
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export type SeedActivity = {
  id: string;
  type: "dm" | "lead" | "click";
  title: string;
  subtitle: string | null;
  at: string;
};

/**
 * What is happening in the workspace right now.
 *
 * The plumbing for this already existed and was doing nothing: `realtimePublisher`, the socket
 * rooms, the per-access-level projection registry and the Redis fan-out all shipped, and
 * `useWorkspaceEvents` had zero call sites — events were arriving at the shared socket and being
 * discarded. The hook is now mounted once in `AppLayout`; this reads what it records.
 *
 * Seeded from the server's `activityFeed` so the panel is populated on first paint rather than
 * empty until something happens, and so a reload does not look like the feature broke. Live rows
 * displace seeded ones by id.
 *
 * Delivery failures are the reason this panel earns its place. An expired 24-hour reply window
 * has no surface anywhere else in the product, and it is the single thing a user most needs to
 * see happen.
 */
export function LiveActivity({ seed = [] }: { seed?: SeedActivity[] }) {
  const live = useSyncExternalStore(
    subscribeLiveActivity,
    getLiveActivitySnapshot,
    // The server render has no socket and therefore no events; the seed carries the panel there.
    () => EMPTY,
  );

  const rows = useMemo(() => {
    const seeded: LiveActivityEntry[] = seed.map((s) => ({
      id: s.id,
      kind: s.type,
      title: s.title,
      subtitle: s.subtitle,
      at: s.at,
      live: false,
    }));
    const seen = new Set(live.map((e) => e.id));
    return [...live, ...seeded.filter((e) => !seen.has(e.id))]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, VISIBLE);
  }, [live, seed]);

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-soft sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold">
          <span className="relative flex h-2 w-2">
            {/* `motion-safe` only: a ring pulsing forever is exactly what a reduced-motion
                preference is asking not to see. */}
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          Live activity
        </h2>
        <Link to="/leads-captured" className="text-xs font-medium text-primary hover:underline">
          Leads inbox
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nothing yet — DMs and leads appear here the moment they happen.
        </p>
      ) : (
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {rows.map((row) => {
              const Icon = ICON[row.kind];
              return (
                <motion.li
                  key={row.id}
                  layout
                  initial={row.live ? { opacity: 0, y: -10 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-start gap-3"
                >
                  <span
                    className={cn(
                      "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border",
                      TONE[row.kind],
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-sm">{row.title}</span>
                    {row.subtitle && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {row.subtitle}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {ago(row.at)}
                  </span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
