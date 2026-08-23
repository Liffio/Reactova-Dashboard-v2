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
        // Mobile, per `plan/DASHBOARD/liffio-dashboard-redesign.html`: a 32px connector between
        // two stacked stages, with the rule running *vertically* at 26px so it points along the
        // flow. The previous attempt drew it as a horizontal divider, which reads as a separator
        // between unrelated rows rather than a funnel step.
        "relative flex h-8 items-center justify-start gap-2 pl-[26px]",
        "before:absolute before:bottom-0 before:left-[26px] before:top-0 before:w-[1.5px] before:bg-border before:content-['']",
        // Desktop: unchanged — a horizontal rule across the gap with the pill centred on it.
        "md:h-auto md:justify-center md:gap-0 md:pl-0",
        "md:before:bottom-auto md:before:left-0 md:before:top-1/2 md:before:h-px md:before:w-full",
      )}
    >
      <span
        className={cn(
          // `-ml-1.5` pulls the value onto the rule and `bg-card` masks it, so the line reads as
          // passing behind the number rather than stopping dead at it.
          "relative z-[1] -ml-1.5 flex items-center gap-1.5 bg-card px-1 leading-none",
          // Capsule chrome is desktop-only: on a vertical rail a bordered pill reads as a control.
          "md:ml-0 md:flex-col md:gap-0 md:rounded-full md:border md:px-2 md:py-1",
          weak ? "md:border-warning-edge md:bg-warning-wash" : "md:border-border md:bg-card",
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
        "rounded-2xl border bg-card p-1.5 shadow-soft sm:p-5",
        // Below md the seven cells read as a list: four compact rows divided by the three
        // gates, which carry their own hairline — hence no row gap. Above md the same cells
        // lay out as the horizontal strip, untouched.
        "grid grid-cols-1 gap-y-0",
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
              className={cn(
                // Mobile, per the redesign's "FUNNEL rotates to vertical": a two-row cell — label
                // and icon across the top, value bottom-left, delta bottom-right. Two rows rather
                // than one line because the value is the point of the stage and 27px of it does
                // not fit beside a label.
                "grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-xl p-3 transition-colors hover:bg-accent/60",
                "md:flex md:h-full md:flex-col md:items-stretch md:gap-2",
              )}
            >
              <div className="col-span-2 row-start-1 flex min-w-0 items-start justify-between gap-2 md:col-auto md:row-auto">
                <span className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {stage.label}
                </span>
                <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground md:h-7 md:w-7">
                  <stage.icon className="h-3.5 w-3.5" />
                </span>
              </div>

              <span className="col-start-1 row-start-2 min-w-0 truncate font-display text-[27px] font-semibold leading-none tracking-tight tabular-nums md:col-auto md:row-auto md:text-2xl md:leading-normal">
                {formatNum(stage.value)}
              </span>

              {/* Illegible under ~340px, and the value beside it already carries the level. */}
              <div className="hidden md:block">
                <Sparkline series={stage.series} colorVar={stage.colorVar} />
              </div>

              <div className="col-start-2 row-start-2 flex items-center justify-end gap-2 md:col-auto md:row-auto md:mt-auto md:justify-start">
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
