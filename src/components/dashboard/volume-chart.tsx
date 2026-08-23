import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/utils";
import { formatNum } from "@/lib/format";

type Point = { day: string; value: number };

export type VolumeSeries = {
  dms: Point[];
  leads: Point[];
  clicks: Point[];
};

const SERIES = [
  { key: "dms", label: "DMs sent", color: "var(--chart-1)" },
  { key: "leads", label: "Leads", color: "var(--chart-2)" },
  { key: "clicks", label: "Clicks", color: "var(--chart-4)" },
] as const;

type SeriesKey = (typeof SERIES)[number]["key"];

const shortDay = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
};

/**
 * Daily volume for the three flow stages that have a shape worth looking at.
 *
 * The date picker used to change four numbers and draw nothing, so choosing 90d re-rendered the
 * same four figures with no curve anywhere — the window was a filter with no visible consequence.
 *
 * The series arrive gap-filled from the server, so a quiet day is a zero rather than a point the
 * line interpolates straight through. Toggling a series off keeps its axis space, so the other
 * two do not jump when you compare them.
 */
export function VolumeChart({ series }: { series: VolumeSeries }) {
  const [hidden, setHidden] = useState<Set<SeriesKey>>(new Set());

  const data = useMemo(() => {
    // The three arrays share the server's bucket list, so `dms` can drive the row order without
    // zipping by date — but read the others by index defensively rather than assuming length.
    return series.dms.map((point, i) => ({
      day: point.day,
      dms: point.value,
      leads: series.leads[i]?.value ?? 0,
      clicks: series.clicks[i]?.value ?? 0,
    }));
  }, [series]);

  const toggle = (key: SeriesKey) =>
    setHidden((prev) => {
      const next = new Set(prev);
      // Refuse to hide the last visible series: an empty chart reads as a loading failure.
      if (next.has(key)) next.delete(key);
      else if (next.size < SERIES.length - 1) next.add(key);
      return next;
    });

  // Every ~6th label on a 30-day window, every other on a short one — enough to orient without
  // overlapping at 360px.
  const tickInterval = Math.max(0, Math.ceil(data.length / 5) - 1);

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-soft sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-semibold">Volume over time</h2>
          <p className="text-sm text-muted-foreground">
            {data.length > 0
              ? `Daily · ${shortDay(data[0]!.day)} – ${shortDay(data[data.length - 1]!.day)}`
              : "Daily"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {SERIES.map((s) => {
            const off = hidden.has(s.key);
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => toggle(s.key)}
                aria-pressed={!off}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                  off
                    ? "border-border bg-transparent text-muted-foreground"
                    : "border-border bg-muted text-foreground",
                )}
              >
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full"
                  style={{ background: off ? "var(--muted-foreground)" : s.color }}
                />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-[150px] sm:h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
            <defs>
              {SERIES.map((s) => (
                <linearGradient key={s.key} id={`vol-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.26} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="var(--grid-line)" strokeDasharray="3 4" vertical={false} />
            <XAxis
              dataKey="day"
              tickFormatter={shortDay}
              interval={tickInterval}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />
            <YAxis
              width={44}
              tickFormatter={(v: number) => formatNum(v)}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />
            <Tooltip
              cursor={{ stroke: "var(--border)" }}
              labelFormatter={shortDay}
              formatter={(value: number, name: string) => [formatNum(value), name]}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                color: "var(--popover-foreground)",
                fontSize: 12,
              }}
            />
            {SERIES.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                hide={hidden.has(s.key)}
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#vol-${s.key})`}
                dot={false}
                activeDot={{ r: 3.5, strokeWidth: 2, stroke: "var(--card)" }}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
