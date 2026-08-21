/**
 * Filter controls and list states shared by the panel and the page
 * (plan/NOTIFICATIONS §6.2, §6.4, §7.1).
 *
 * Category options are whatever `/notifications/facets` returned — never a
 * hardcoded list — so a category added server-side appears here with no client
 * change, and one that has no rows under the current filter does not.
 */
import { BellOff, Check, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { NotificationFacets } from "@/lib/api/notifications-api";
import { TIME_RANGES, type TimeRangeId } from "./notification-registry";

export function CategoryOptions({
  facets,
  selected,
  onToggle,
  isLoading,
}: {
  facets: NotificationFacets | undefined;
  selected: string[];
  onToggle: (key: string) => void;
  isLoading: boolean;
}) {
  if (isLoading && !facets) {
    return (
      <div className="grid grid-cols-2 gap-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-full" />
        ))}
      </div>
    );
  }

  const options = facets?.categories ?? [];
  if (options.length === 0) {
    return <p className="text-xs text-muted-foreground">No categories to filter yet.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {options.map((option) => {
        const on = selected.includes(option.key);
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(option.key)}
            className={[
              "flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors",
              on
                ? "border-border bg-card font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
            ].join(" ")}
          >
            <span
              className={[
                "grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[4px] border",
                on
                  ? "border-foreground bg-foreground text-background"
                  : "border-muted-foreground/60",
              ].join(" ")}
            >
              {on && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
            </span>
            <span className="truncate">{option.label}</span>
            {/* The count is the server's, for the whole result set — not the
                length of anything loaded on this client. */}
            <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
              {option.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function TimeRangeOptions({
  value,
  onChange,
}: {
  value: TimeRangeId;
  onChange: (id: TimeRangeId) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TIME_RANGES.map((range) => (
        <FilterChip key={range.id} active={value === range.id} onClick={() => onChange(range.id)}>
          {range.label}
        </FilterChip>
      ))}
    </div>
  );
}

export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active}
      className={[
        "rounded-full border px-2.5 py-1 text-xs transition-colors",
        active
          ? "border-foreground bg-foreground font-medium text-background"
          : "text-muted-foreground hover:border-muted-foreground hover:text-foreground",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function NotificationSkeletons({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border/50" aria-busy="true" aria-label="Loading notifications">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3 px-4 py-3">
          <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Empty states are deliberately NOT shared copy (§0.2, §6.4): "nothing here"
 * and "nothing matches what you asked for" are different facts, and conflating
 * them makes a filter look like an empty account.
 */
export function NotificationEmpty({
  filtered,
  onReset,
}: {
  filtered: boolean;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-6 py-12 text-center">
      <BellOff className="h-5 w-5 text-muted-foreground" />
      <p className="text-[13px] font-medium">{filtered ? "No matches" : "You're all caught up"}</p>
      <p className="max-w-[26ch] text-xs leading-relaxed text-muted-foreground">
        {filtered
          ? "Nothing here fits the current filters."
          : "New leads and automation activity will land here."}
      </p>
      {filtered && (
        <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={onReset}>
          Reset filters
        </Button>
      )}
    </div>
  );
}

/** A failed load names its reason and offers a retry — never a blank list (§6.4). */
export function NotificationError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-6 py-12 text-center">
      <TriangleAlert className="h-5 w-5 text-destructive" />
      <p className="text-[13px] font-medium">Couldn't load notifications</p>
      <p className="max-w-[30ch] text-xs leading-relaxed text-muted-foreground">
        {(error as Error)?.message ?? "Something went wrong."}
      </p>
      <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
