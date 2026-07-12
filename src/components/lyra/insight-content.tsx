import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Lightbulb, Sparkles, Target, TrendingUp, type LucideIcon } from "lucide-react";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** The hero "highlighted" summary blob every AI Insights card leads with. */
export function InsightSummary({ text }: { text: string }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-accent/10 to-transparent p-4 shadow-glow"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-brand-gradient opacity-20 blur-2xl"
      />
      <div className="relative flex items-start gap-3">
        <motion.span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-gradient shadow-glow"
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <Sparkles className="h-4 w-4 text-white" />
        </motion.span>
        <p className="pt-1 text-sm font-medium leading-relaxed text-foreground">{text}</p>
      </div>
    </motion.div>
  );
}

const SEVERITY_BADGE_CLASS: Record<string, string> = {
  high: "bg-destructive/15 text-destructive",
  critical: "bg-destructive/15 text-destructive",
  medium: "bg-chart-4/15 text-chart-4",
  warning: "bg-chart-4/15 text-chart-4",
  low: "bg-chart-2/15 text-chart-2",
  info: "bg-chart-2/15 text-chart-2",
};

/** A finding/metric/severity highlight, e.g. from the analytics insights task. */
export function AnalyticsHighlight({
  finding,
  metric,
  severity,
}: {
  finding: string;
  metric?: string | null;
  severity?: string | null;
}) {
  const badgeClass =
    SEVERITY_BADGE_CLASS[severity?.toLowerCase() ?? ""] ?? "bg-muted text-muted-foreground";
  return (
    <span className="flex flex-1 flex-wrap items-center justify-between gap-2">
      <span>{finding}</span>
      <span className="flex shrink-0 items-center gap-1.5">
        {metric && <span className="text-xs font-medium text-muted-foreground">{metric}</span>}
        {severity && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              badgeClass,
            )}
          >
            {severity}
          </span>
        )}
      </span>
    </span>
  );
}

export type InsightTone = "insight" | "recommendation" | "highlight";

const TONE_CONFIG: Record<
  InsightTone,
  { icon: LucideIcon; badgeClass: string; defaultLabel: string }
> = {
  insight: {
    icon: Lightbulb,
    badgeClass: "bg-chart-2/15 text-chart-2",
    defaultLabel: "Key insights",
  },
  recommendation: {
    icon: Target,
    badgeClass: "bg-chart-4/15 text-chart-4",
    defaultLabel: "Recommendations",
  },
  highlight: {
    icon: TrendingUp,
    badgeClass: "bg-chart-1/15 text-chart-1",
    defaultLabel: "Highlights",
  },
};

/** An animated, staggered list of insight/recommendation/highlight cards — never a plain bullet list. */
export function InsightPointList<T = string>({
  tone,
  title,
  items,
  renderItem = (item) => item as ReactNode,
}: {
  tone: InsightTone;
  title?: string;
  items: T[];
  renderItem?: (item: T) => ReactNode;
}) {
  if (items.length === 0) return null;
  const { icon: Icon, badgeClass, defaultLabel } = TONE_CONFIG[tone];

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title ?? defaultLabel}
      </p>
      <motion.ul
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="space-y-1.5"
      >
        {items.map((item, i) => (
          <motion.li
            key={i}
            variants={staggerItem}
            className={cn(
              "flex items-start gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-sm leading-relaxed shadow-soft transition-transform hover:-translate-y-0.5 hover:shadow-card",
            )}
          >
            <span
              className={cn(
                "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full",
                badgeClass,
              )}
            >
              <Icon className="h-3 w-3" />
            </span>
            <span>{renderItem(item)}</span>
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
}
