import type { LucideIcon } from "lucide-react";
import {
  ArrowDownRight,
  ArrowUpRight,
  MessageCircle,
  MousePointerClick,
  Send,
  UserPlus,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";

import { formatNum } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * A step-to-step rate below this turns the gate amber.
 *
 * One threshold for all three gates on purpose: they are not comparable to each other (a delivery
 * rate and a lead rate live on different scales), so a per-gate number would be four arbitrary
 * constants instead of one. This marks "worth a look", not "broken".
 */
const WEAK_GATE_THRESHOLD = 0.3;

export type FunnelStageData = {
  key: string;
  label: string;
  value: number;
  icon: LucideIcon;
  /** Fraction, not percent — matches `StatCard`'s existing contract. */
  delta?: number | null;
  /** Daily values for the sparkline. Empty renders a flat rule rather than nothing. */
  series: number[];
  colorVar: string;
  to: string;
};

/** Caption for the gate that follows the stage at this index. */
const GATE_CAPTIONS = ["delivered", "converted", "clicked"];

function Sparkline({ series, colorVar }: { series: number[]; colorVar: string }) {
  if (series.length < 2) {
    return (
      <svg viewBox="0 0 120 26" preserveAspectRatio="none" className="h-6 w-full" aria-hidden>
        <line
          x1="0"
          y1="21"
          x2="120"
          y2="21"
          stroke="var(--border)"
          strokeWidth="1.6"
          strokeDasharray="3 4"
        />
      </svg>
    );
  }
  const max = Math.max(...series);
  const min = Math.min(...series);
  // A flat series has zero span; dividing by it would put every point at NaN and erase the line.
  const span = max - min || 1;
  const step = 120 / (series.length - 1);
  const d = series
    .map(
      (v, i) =>
        `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)} ${(24 - ((v - min) / span) * 22).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg viewBox="0 0 120 26" preserveAspectRatio="none" className="h-6 w-full" aria-hidden>
      <path
        d={d}
        fill="none"
        stroke={colorVar}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Delta({ delta }: { delta: number }) {
  const positive = delta >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium",
        positive ? "bg-success-wash text-success" : "bg-destructive-wash text-destructive",
      )}
    >
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {(positive ? "+" : "") + (delta * 100).toFixed(1)}%
    </span>
  );
}

function Gate({ rate, caption }: { rate: number | null; caption: string }) {
  const weak = rate != null && rate < WEAK_GATE_THRESHOLD;
  return (
    <div
      className={cn(
        // Horizontal on the desktop strip, vertical between stacked stages on mobile — the rule
        // and the pill swap axis together, so the connector always points along the flow.
        "relative flex items-center justify-center",
        "before:absolute before:bg-border before:content-['']",
        "before:left-1/2 before:h-full before:w-px md:before:left-0 md:before:h-px md:before:w-full md:before:top-1/2",
      )}
    >
      <span
        className={cn(
          "relative z-[1] flex flex-col items-center rounded-full border px-2 py-1 leading-none",
          weak ? "border-warning-edge bg-warning-wash" : "border-border bg-card",
        )}
      >
        <span
          className={cn(
            "text-[11px] font-semibold tabular-nums",
            weak ? "text-warning" : "text-foreground",
          )}
        >
          {rate == null ? "—" : `${(rate * 100).toFixed(1)}%`}
        </span>
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{caption}</span>
      </span>
    </div>
  );
}

/**
 * The four dashboard KPIs drawn as what they actually are: one funnel.
 *
 * They used to be four unrelated tiles in an `xl:grid-cols-5` grid, so learning anything from them
 * — "how many of the people we reached replied?" — meant dividing two numbers in your head. The
 * gates do that division and put the answer on the connector between the stages it relates.
 *
 * Built here rather than by extending `StatCard`, which has no `className` and no `onClick` by
 * design and ten call sites that depend on that.
 */
export function FunnelStrip({ stages }: { stages: FunnelStageData[] }) {
  const gate = (i: number): number | null => {
    const from = stages[i]?.value ?? 0;
    const to = stages[i + 1]?.value ?? 0;
    return from > 0 ? to / from : null;
  };

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-4 shadow-soft sm:p-5",
        // Stages stack vertically below md with the gates as the connectors between them; above
        // md the same seven cells lay out as the horizontal strip.
        "grid grid-cols-1 gap-y-1",
        "md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:items-stretch md:gap-x-2 md:gap-y-0",
      )}
    >
      {stages.map((stage, i) => (
        <div key={stage.key} className="contents">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: i * 0.06 }}
          >
            <Link
              to={stage.to}
              className="flex h-full flex-col gap-2 rounded-xl p-3 transition-colors hover:bg-accent/60"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {stage.label}
                </span>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <stage.icon className="h-3.5 w-3.5" />
                </span>
              </div>
              <span className="font-display text-2xl font-semibold tracking-tight tabular-nums">
                {formatNum(stage.value)}
              </span>
              {/* Illegible under ~340px, and the number above already carries the level. */}
              <div className="hidden sm:block">
                <Sparkline series={stage.series} colorVar={stage.colorVar} />
              </div>
              <div className="mt-auto flex items-center gap-2">
                {typeof stage.delta === "number" && <Delta delta={stage.delta} />}
              </div>
            </Link>
          </motion.div>
          {i < stages.length - 1 && (
            <Gate rate={gate(i)} caption={GATE_CAPTIONS[i] ?? "converted"} />
          )}
        </div>
      ))}
    </div>
  );
}

/** Icons and colours for the four stages, in flow order. */
export const FUNNEL_STAGE_META = [
  {
    key: "commentsMatched",
    label: "Comments matched",
    icon: MessageCircle,
    colorVar: "var(--chart-1)",
    to: "/analytics",
  },
  { key: "dmsSent", label: "DMs sent", icon: Send, colorVar: "var(--chart-1)", to: "/analytics" },
  {
    key: "leadsCaptured",
    label: "Leads captured",
    icon: UserPlus,
    colorVar: "var(--chart-2)",
    to: "/leads-captured",
  },
  {
    key: "linkClicks",
    label: "Link clicks",
    icon: MousePointerClick,
    colorVar: "var(--chart-4)",
    to: "/short-links",
  },
] as const;
