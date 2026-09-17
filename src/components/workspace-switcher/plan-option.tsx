import { Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * One selectable plan in the Add-workspace picker.
 *
 * Reuses the option-row pattern already shipped in `components/onboarding/screen-goal.tsx` — a
 * full-width row that selects with a primary border and a primary tint — rather than introducing a
 * second idea of what "selected" looks like.
 *
 * An unavailable option keeps its reason in the description rather than only in a `title`: "Free"
 * going grey with no explanation reads as a bug, and a tooltip is invisible on touch. It is marked
 * `aria-disabled` rather than `disabled` so it stays focusable and tappable and can explain itself
 * when pressed (FX6).
 */
export function PlanOption({
  name,
  description,
  price,
  priceNote,
  selected,
  unavailable,
  disabledChipLabel,
  priceLoading,
  onSelect,
}: {
  name: string;
  description: string;
  /** Already formatted in the customer's currency. Never computed in this component. */
  price: string;
  priceNote: string;
  selected: boolean;
  /**
   * Shown as unavailable but still focusable and tappable (FX6). `aria-disabled`, never the
   * `disabled` attribute: a `disabled` button cannot be focused or tapped, so the row goes dead
   * and the user gets no explanation of why they cannot pick it.
   */
  unavailable?: boolean;
  disabledChipLabel?: string;
  /** While the price is still being fetched, the amount is a skeleton (FX2), never text. */
  priceLoading?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={unavailable || undefined}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors",
        unavailable
          ? "bg-muted text-muted-foreground"
          : selected
            ? "border-primary bg-primary/5 ring-1 ring-primary"
            : "hover:border-foreground/20 hover:bg-accent/50",
      )}
    >
      <span
        className={cn(
          "grid size-[18px] shrink-0 place-items-center rounded-full border",
          selected ? "border-primary" : "border-border",
          unavailable && "bg-border",
        )}
      >
        {selected ? <span className="size-2 rounded-full bg-primary" /> : null}
      </span>

      <span className="grid min-w-0 flex-1 leading-tight">
        <span className="flex items-center gap-2 font-semibold">
          {name}
          {unavailable && disabledChipLabel ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              <Lock aria-hidden className="size-3" />
              {disabledChipLabel}
            </span>
          ) : null}
        </span>
        <span className="text-[12.5px] text-muted-foreground">{description}</span>
      </span>

      <span className="shrink-0 text-right">
        {priceLoading ? (
          <>
            <Skeleton className="ml-auto block h-[17px] w-14" />
            <Skeleton className="ml-auto mt-1 block h-[11px] w-12" />
          </>
        ) : (
          <>
            <span className="block font-display text-[17px] font-semibold">{price}</span>
            <span className="block text-[11.5px] font-normal text-muted-foreground">
              {priceNote}
            </span>
          </>
        )}
      </span>
    </button>
  );
}
