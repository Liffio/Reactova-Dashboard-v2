import { Lock } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * One selectable plan in the Add-workspace picker.
 *
 * Reuses the option-row pattern already shipped in `components/onboarding/screen-goal.tsx` — a
 * full-width row that selects with a primary border and a primary tint — rather than introducing a
 * second idea of what "selected" looks like.
 *
 * A disabled option keeps its reason in the description rather than only in a `title`: "Free" going
 * grey with no explanation reads as a bug, and a tooltip is invisible on touch.
 */
export function PlanOption({
  name,
  description,
  price,
  priceNote,
  selected,
  disabled,
  disabledChipLabel,
  onSelect,
}: {
  name: string;
  description: string;
  /** Already formatted in the customer's currency. Never computed in this component. */
  price: string;
  priceNote: string;
  selected: boolean;
  disabled?: boolean;
  disabledChipLabel?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors",
        disabled
          ? "cursor-not-allowed bg-muted text-muted-foreground"
          : selected
            ? "border-primary bg-primary/5 ring-1 ring-primary"
            : "hover:border-foreground/20 hover:bg-accent/50",
      )}
    >
      <span
        className={cn(
          "grid size-[18px] shrink-0 place-items-center rounded-full border",
          selected ? "border-primary" : "border-border",
          disabled && "bg-border",
        )}
      >
        {selected ? <span className="size-2 rounded-full bg-primary" /> : null}
      </span>

      <span className="grid min-w-0 flex-1 leading-tight">
        <span className="flex items-center gap-2 font-semibold">
          {name}
          {disabled && disabledChipLabel ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              <Lock aria-hidden className="size-3" />
              {disabledChipLabel}
            </span>
          ) : null}
        </span>
        <span className="text-[12.5px] text-muted-foreground">{description}</span>
      </span>

      <span className="shrink-0 text-right">
        <span className="block font-display text-[17px] font-semibold">{price}</span>
        <span className="block text-[11.5px] font-normal text-muted-foreground">{priceNote}</span>
      </span>
    </button>
  );
}
