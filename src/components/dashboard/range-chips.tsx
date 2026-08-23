import type { ReactNode } from "react";

import { rangeKey, type DashboardDateRange } from "@/components/dashboard/date-range-picker";
import { cn } from "@/lib/utils";

const CHIPS: Array<{ value: DashboardDateRange | null; label: string }> = [
  { value: null, label: "This month" },
  { value: { preset: "7d" }, label: "7 days" },
  { value: { preset: "30d" }, label: "30 days" },
  { value: { preset: "90d" }, label: "90 days" },
];

/**
 * The date range as a scrolling row, for phones.
 *
 * A popover on a 360px screen costs two taps and covers the numbers it is about to change, and
 * the presets are the answer almost every time. Custom still opens the calendar — the chip simply
 * forwards to the picker rather than reimplementing a second range model, so the two can never
 * disagree about what "30 days" means.
 */
export function RangeChips({
  value,
  onChange,
  className,
  children,
}: {
  value: DashboardDateRange | null;
  onChange: (value: DashboardDateRange | null) => void;
  className?: string;
  /** The custom-range control. Rendered last in the row. */
  children?: ReactNode;
}) {
  const activeKey = rangeKey(value);
  const custom = value != null && !("preset" in value);

  return (
    <div
      className={cn(
        // `-mx-4 px-4` lets the row bleed to the screen edges so the last chip does not look
        // clipped by the page gutter when it scrolls.
        "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {CHIPS.map((chip) => {
        const active = !custom && rangeKey(chip.value) === activeKey;
        return (
          <button
            key={chip.label}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(chip.value)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "border-primary-edge bg-primary-wash text-primary"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            {chip.label}
          </button>
        );
      })}
      {children && (
        <div className="shrink-0" data-custom-active={custom || undefined}>
          {children}
        </div>
      )}
    </div>
  );
}
