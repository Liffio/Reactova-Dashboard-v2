import { forwardRef } from "react";
import { AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

/**
 * The workspace name input, shared by the Add-workspace and Add-inside-group sheets.
 *
 * ## 🔴 Why this is not `components/ui/input` (FX3)
 *
 * The shared input is `border border-input`: a 1px hairline in a token tuned for dense forms. On
 * an iPhone 12 in Safari it was reported as having *no visible border at all*, which is what a
 * low-contrast hairline looks like on a white sheet in daylight. The reference HTML uses
 * `1.5px solid color-mix(in oklab, var(--fg) 20%, var(--border))` for exactly this reason, and
 * that is what is matched here.
 *
 * Widening the shared `ui/input` instead would have changed every form in the product from one
 * bug report about one sheet, so the heavier treatment lives with the field that needs it.
 *
 * The error state (FX5) is part of this component rather than the caller's, so the border, the
 * ring, the icon and the message cannot drift out of step with each other.
 */
export const NameField = forwardRef<
  HTMLInputElement,
  {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    /** Set when the field was submitted empty. Shows the red border and the message. */
    error?: string | null;
    /** Applied for the length of the shake, then removed by the caller. */
    shaking?: boolean;
    onEnter?: () => void;
    autoFocus?: boolean;
  }
>(function NameField(
  { id, label, value, onChange, placeholder, error, shaking, onEnter, autoFocus },
  ref,
) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 block text-[13px] font-medium">
        {label}
      </Label>

      <input
        ref={ref}
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && onEnter) onEnter();
        }}
        placeholder={placeholder}
        maxLength={40}
        autoFocus={autoFocus}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          // 1.5px, and a border colour mixed toward the foreground so it stays visible on a
          // white sheet. `text-base` on mobile keeps iOS from zooming the viewport on focus,
          // which would undo FX1's careful height work the moment the field is tapped.
          "w-full rounded-[10px] border-[1.5px] bg-card px-3 py-2.5 text-base outline-none transition-[border-color,box-shadow] md:text-sm",
          "placeholder:text-muted-foreground",
          error
            ? "border-destructive ring-[3px] ring-destructive/20"
            : "border-[color-mix(in_oklab,hsl(var(--foreground))_20%,hsl(var(--border)))] focus:border-primary focus:ring-[3px] focus:ring-primary/20",
          shaking && "motion-safe:animate-[ws-name-shake_0.4s_ease]",
        )}
      />

      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-destructive"
        >
          <AlertCircle aria-hidden className="size-[13px] shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
});
