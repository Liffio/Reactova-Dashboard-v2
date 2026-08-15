import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * One range model for every dashboard: a rolling preset or an inclusive custom day range.
 * Serialized to the API as `range=30d` or `start=YYYY-MM-DD&end=YYYY-MM-DD`.
 */
export type DashboardDateRange = { preset: "7d" | "30d" | "90d" } | { start: string; end: string };

const PRESETS: Array<{ preset: "7d" | "30d" | "90d"; label: string }> = [
  { preset: "7d", label: "Last 7 days" },
  { preset: "30d", label: "Last 30 days" },
  { preset: "90d", label: "Last 90 days" },
];

const toDay = (d: Date): string => format(d, "yyyy-MM-dd");

export const rangeQueryParams = (
  value: DashboardDateRange | null,
): { range?: string; start?: string; end?: string } => {
  if (!value) return {};
  return "preset" in value ? { range: value.preset } : { start: value.start, end: value.end };
};

/** Stable string for query keys. */
export const rangeKey = (value: DashboardDateRange | null): string => {
  if (!value) return "default";
  return "preset" in value ? value.preset : `${value.start}_${value.end}`;
};

export const rangeLabel = (
  value: DashboardDateRange | null,
  placeholder = "Last 30 days",
): string => {
  if (!value) return placeholder;
  if ("preset" in value)
    return PRESETS.find((p) => p.preset === value.preset)?.label ?? value.preset;
  const from = new Date(`${value.start}T00:00:00`);
  const to = new Date(`${value.end}T00:00:00`);
  return `${format(from, "MMM d, yyyy")} – ${format(to, "MMM d, yyyy")}`;
};

export function DateRangePicker({
  value,
  onChange,
  placeholderLabel,
  clearLabel,
  align = "end",
}: {
  value: DashboardDateRange | null;
  onChange: (value: DashboardDateRange | null) => void;
  /** Label shown when value is null (e.g. "This month" on the workspace dashboard). */
  placeholderLabel?: string;
  /** When set, renders a reset choice returning value to null. */
  clearLabel?: string;
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(undefined);

  const activePreset = value && "preset" in value ? value.preset : null;

  const commit = (next: DashboardDateRange | null) => {
    onChange(next);
    setDraft(undefined);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 font-normal">
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          {rangeLabel(value, placeholderLabel)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto p-0">
        <div className="flex">
          <div className="flex flex-col gap-1 border-r p-3">
            {clearLabel && (
              <Button
                variant={value === null ? "default" : "ghost"}
                size="sm"
                className="justify-start"
                onClick={() => commit(null)}
              >
                {clearLabel}
              </Button>
            )}
            {PRESETS.map((p) => (
              <Button
                key={p.preset}
                variant={activePreset === p.preset ? "default" : "ghost"}
                size="sm"
                className="justify-start"
                onClick={() => commit({ preset: p.preset })}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="p-1">
            <Calendar
              mode="range"
              numberOfMonths={1}
              defaultMonth={draft?.from ?? new Date()}
              selected={draft}
              disabled={{ after: new Date() }}
              onSelect={(next) => {
                setDraft(next);
                if (next?.from && next?.to && next.from.getTime() !== next.to.getTime()) {
                  commit({ start: toDay(next.from), end: toDay(next.to) });
                }
              }}
            />
            <p
              className={cn(
                "px-3 pb-2 text-xs text-muted-foreground",
                draft?.from && !draft?.to ? "text-primary" : undefined,
              )}
            >
              {draft?.from && !draft?.to
                ? "Pick the end day to apply"
                : "Pick a start and end day for a custom range"}
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
