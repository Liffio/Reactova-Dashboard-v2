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
  /**
   * Shown in place of the sparkline when the stage is at zero. A flat line across an empty
   * stage says "nothing happened" twice; the space is better spent saying what would make
   * something happen.
   */
  emptyHint?: string;
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

/**
 * The step-to-step rate as a pill.
 *
 * On mobile the gate moves *into* the header of the stage it feeds — "DMs sent · 100% delivered"
 * reads as a property of that stage, and a free-floating connector between separate cards has
 * nothing to connect. The desktop strip keeps the connector, which is why this is a component
 * rather than markup inside `Gate`.
 */
function GateReadout({
  rate,
  caption,
  className,
}: {
  rate: number | null;
  caption: string;
  className?: string;
}) {
  const weak = rate != null && rate < WEAK_GATE_THRESHOLD;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 leading-none",
        weak ? "border-warning-edge bg-warning-wash" : "border-border bg-card",
        className,
      )}
    >
      <span
        className={cn(
          "text-[11px] font-semibold tabular-nums",
          weak ? "text-warning" : "text-foreground",
        )}
      >
        {rate == null ? "—" : `${(rate * 100).toFixed(rate >= 1 ? 0 : 1)}%`}
      </span>
      <span className="text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">
        {caption}
      </span>
    </span>
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
  return (
    <div
      className={cn(
        // Desktop only. Below md the stages are separate cards and the rate lives in the header of
        // the stage it feeds, so there is no gap left to bridge.
        "relative hidden items-center justify-center md:flex",
        "before:absolute before:left-0 before:top-1/2 before:h-px before:w-full before:bg-border before:content-['']",
      )}
    >
      <GateReadout rate={rate} caption={caption} className="relative z-[1] flex-col gap-0 px-2" />
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
        // Mobile: four separate cards. The single bordered panel was one tall column of hairlines
        // that read as a table; as cards each stage is a thing you can look at on its own, which
        // is how the funnel is actually read on a phone.
        "grid grid-cols-1 gap-3",
        // Desktop: one card holding the seven-cell strip, unchanged.
        "md:gap-x-2 md:gap-y-0 md:rounded-2xl md:border md:bg-card md:p-3 md:shadow-soft",
        "md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:items-stretch lg:md:p-5",
      )}
    >
      {stages.map((stage, i) => {
        // The rate *into* this stage — stage 0 has none, nothing precedes it.
        const incoming = i > 0 ? { rate: gate(i - 1), caption: GATE_CAPTIONS[i - 1] ?? "" } : null;
        return (
          <div key={stage.key} className="contents">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: i * 0.06 }}
              className="min-w-0"
            >
              <Link
                to={stage.to}
                className={cn(
                  "flex h-full flex-col gap-3 rounded-xl border bg-card p-4 shadow-soft transition-colors hover:bg-accent/40",
                  // Inside the desktop card the per-stage chrome would be a border on a border.
                  "md:gap-2 md:border-0 md:bg-transparent md:p-3 md:shadow-none md:hover:bg-accent/60",
                )}
              >
                <div className="flex min-w-0 items-center gap-2.5 md:items-start md:justify-between md:gap-2">
                  {/* Tinted from the stage's own chart colour, so the chip and its sparkline
                      identify the same stage instead of every chip being the same grey. */}
                  <span
                    aria-hidden
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg md:order-2"
                    style={{
                      backgroundColor: `color-mix(in oklch, ${stage.colorVar} 15%, transparent)`,
                      color: stage.colorVar,
                    }}
                  >
                    <stage.icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground md:order-1">
                    {stage.label}
                  </span>
                  {incoming && (
                    <GateReadout
                      rate={incoming.rate}
                      caption={incoming.caption}
                      className="md:hidden"
                    />
                  )}
                </div>

                {/* Mobile lays value and trace side by side and drops the comparison beneath the
                    value; desktop stacks all three and pins the comparison to the bottom so the
                    four tiles align across the strip. `flex-1` is what keeps them aligned when one
                    stage has an empty-state hint and its neighbour has a sparkline. */}
                <div className="grid flex-1 grid-cols-[auto_minmax(0,1fr)] items-end gap-x-4 gap-y-1.5 md:flex md:flex-col md:items-stretch md:gap-2">
                  <span className="col-start-1 row-start-1 font-display text-[30px] font-semibold leading-none tracking-tight tabular-nums md:order-1 md:text-2xl">
                    {formatNum(stage.value)}
                  </span>

                  <div className="col-start-2 row-start-1 min-w-0 md:order-2">
                    {stage.value === 0 && stage.emptyHint ? (
                      <p className="text-right text-[11.5px] leading-snug text-muted-foreground md:text-left">
                        {stage.emptyHint}
                      </p>
                    ) : (
                      <Sparkline series={stage.series} colorVar={stage.colorVar} />
                    )}
                  </div>

                  <div className="col-start-1 row-start-2 flex items-center md:order-3 md:mt-auto md:pt-1">
                    {typeof stage.delta === "number" ? (
                      <Delta delta={stage.delta} />
                    ) : (
                      // No prior-period figure reaches this component — only a trend percent that
                      // may be absent. Saying which is missing beats an empty slot that reads as
                      // a number that failed to load.
                      <span className="text-[11px] text-muted-foreground">
                        {stage.value > 0 ? "No comparison yet" : "No activity in this range"}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </motion.div>
            {i < stages.length - 1 && (
              <Gate rate={gate(i)} caption={GATE_CAPTIONS[i] ?? "converted"} />
            )}
          </div>
        );
      })}
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
    emptyHint: "No comments matched yet — check your automation's keyword.",
  },
  {
    key: "dmsSent",
    label: "DMs sent",
    icon: Send,
    colorVar: "var(--chart-1)",
    to: "/analytics",
    emptyHint: "No DMs sent yet — matched comments trigger these.",
  },
  {
    key: "leadsCaptured",
    label: "Leads captured",
    icon: UserPlus,
    colorVar: "var(--chart-2)",
    to: "/leads-captured",
    emptyHint: "No leads yet — ask for an email in your DM.",
  },
  {
    key: "linkClicks",
    label: "Link clicks",
    icon: MousePointerClick,
    colorVar: "var(--chart-4)",
    to: "/short-links",
    emptyHint: "No clicks yet — add a link to your DM to start tracking.",
  },
] as const;
