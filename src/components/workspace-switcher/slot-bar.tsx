import { cn } from "@/lib/utils";

/**
 * The segmented slot meter under an agency row.
 *
 * `aria-hidden`, deliberately. It is a second rendering of a number that is already on screen as
 * text ("2 of 20 workspaces used"), and a screen reader counting out twenty `<i>` elements would be
 * worse than useless. The count is the accessible answer; this is the glanceable one.
 *
 * Segment count comes from `limit`, never a hardcoded 20 — the slot limit is a property of the
 * group the customer bought, and a future package could sell a different number.
 */
export function SlotBar({
  used,
  limit,
  size = "sm",
  className,
}: {
  used: number;
  limit: number;
  /** `sm` sits under a row in the list; `lg` spans the group header. */
  size?: "sm" | "lg";
  className?: string;
}) {
  const segments = Math.max(limit, 1);

  return (
    <span
      aria-hidden
      className={cn(
        "grid w-full gap-[2px]",
        size === "sm" ? "max-w-[124px]" : "gap-[3px]",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${segments}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: segments }, (_, index) => (
        <i
          key={index}
          className={cn(
            "block rounded-sm",
            size === "sm" ? "h-1" : "h-2",
            index < used ? "bg-warning" : "bg-border",
          )}
        />
      ))}
    </span>
  );
}
