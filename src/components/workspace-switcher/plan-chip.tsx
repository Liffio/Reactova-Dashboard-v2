import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import type { WorkspacePlanKey } from "@/lib/api/workspace-switcher-api";

/**
 * Plan colours, mapped onto existing theme tokens rather than new ones.
 *
 * The switcher reference HTML invents six chip pairs; every one of them already has a home in
 * `styles.css`. Using the tokens means these follow a brand change and work in both themes without
 * a second palette to keep in sync — and nothing here needs a new CSS custom property.
 *
 * Keyed on the plan enum, not on the label: the label can be an admin-renamed package name, and a
 * chip whose colour depended on a string someone can edit in a console would change colour when
 * they did.
 */
const PLAN_STYLES: Record<WorkspacePlanKey, string> = {
  FREE: "border-transparent bg-muted text-muted-foreground",
  STARTER: "border-transparent bg-accent text-accent-foreground",
  GROWTH: "border-transparent bg-chart-5/15 text-chart-5",
  PRO: "border-transparent bg-chart-3/15 text-chart-3",
  BUSINESS: "border-transparent bg-chart-3/15 text-chart-3",
  AGENCY: "border-transparent bg-warning/15 text-warning",
};

export function PlanChip({
  plan,
  label,
  className,
}: {
  plan: WorkspacePlanKey;
  /** Server-resolved. Rendered as given — never derived from `plan` here. */
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none",
        PLAN_STYLES[plan] ?? PLAN_STYLES.FREE,
        className,
      )}
    >
      {label}
    </span>
  );
}

/**
 * Replaces the plan chip on an expired row.
 *
 * Shown instead of, not alongside — two chips on one row makes the reader work out which one
 * governs. What matters when a plan has expired is that it expired.
 */
export function ExpiredChip({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-transparent bg-destructive/10 px-2 py-0.5 text-[11px] font-medium leading-none text-destructive",
        className,
      )}
    >
      <Clock aria-hidden className="size-3" />
      Expired
    </span>
  );
}
