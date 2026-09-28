import { cn } from "@/lib/utils";

/**
 * Usage meters (liffio-chatbot-gating-ui.html §5): what a plan allows, visible before it is hit.
 * Every number is the server's resolved limit (`package_limits` via the workspace-limit resolver);
 * nothing here knows a plan. `null` (or the server's "unlimited" sentinel) reads as unlimited.
 */

/** The server sends unlimited as `null` (builder limits) or a huge number / -1 (live chatbots). */
export const capOf = (limit: number | null | undefined): number | null =>
  limit === null || limit === undefined || limit < 0 || limit >= 999_999 ? null : limit;

export const atCap = (used: number, limit: number | null | undefined): boolean => {
  const cap = capOf(limit);
  return cap !== null && used >= cap;
};

export function UsageMeter({
  label,
  used,
  limit,
  note,
  compact = false,
  className,
}: {
  label: string;
  used: number;
  limit: number | null | undefined;
  /** Shown under the bar, e.g. "Drafts don't count, only live chatbots." */
  note?: string;
  /** One line with no bar, for a header or a card. */
  compact?: boolean;
  className?: string;
}) {
  const cap = capOf(limit);
  const full = cap !== null && used >= cap;
  const pct = cap ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const text =
    cap === null
      ? `${used.toLocaleString()} · unlimited`
      : `${used.toLocaleString()} of ${cap.toLocaleString()}`;

  if (compact) {
    return (
      <span
        className={cn(
          "text-xs whitespace-nowrap tabular-nums",
          full ? "font-semibold text-warning" : "text-muted-foreground",
          className,
        )}
        title={full ? "At your plan's limit" : undefined}
      >
        {label} {text}
      </span>
    );
  }

  return (
    <div className={cn("flex min-w-[160px] flex-col gap-1", className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium">{label}</span>
        <span
          className={cn(
            "tabular-nums",
            full ? "font-semibold text-warning" : "text-muted-foreground",
          )}
        >
          {text}
        </span>
      </div>
      {cap !== null && (
        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={cap}
          aria-valuenow={used}
          aria-label={label}
        >
          <div
            className={cn("h-full rounded-full", full ? "bg-warning" : "bg-primary")}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {(note || full) && (
        <span className={cn("text-[11px]", full ? "text-warning" : "text-muted-foreground")}>
          {full ? "You're at the limit on your plan." : note}
        </span>
      )}
    </div>
  );
}
