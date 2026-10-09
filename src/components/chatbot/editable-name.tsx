import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A name that reads as a plain heading at rest but is editable in place — the chatbot title and
 * every step name (spec: chatbot-ui-fixes item 1). Before this, both were real `<input>`s with no
 * border and a transparent background, so nothing said they could be renamed; this adds the hover
 * and focus affordance, a pencil, and `cursor-text`, and changes the commit model from "every
 * keystroke" to "Enter or blur commits, Escape reverts" — so a rename is a deliberate act, not a
 * side effect of the debounced autosave firing mid-sentence.
 *
 * Still a native `<input>` throughout, never a span that swaps for one on click: it is reachable
 * by Tab and typeable the moment it has focus, with no extra step to "enter edit mode".
 */
export function EditableName({
  value,
  onCommit,
  isDefault,
  ariaLabel,
  className,
  inputClassName,
  disabled,
}: {
  value: string;
  onCommit: (next: string) => void;
  /** Still the type's default ("Untitled chatbot", "New step", …) — rendered muted, like a placeholder. */
  isDefault: boolean;
  ariaLabel: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  // The external value can change under us (another save round-trip, a tab elsewhere syncing) —
  // follow it, but never while the person is mid-edit, or their keystrokes would be overwritten.
  useEffect(() => {
    if (!focused) setDraft(value);
  }, [value, focused]);

  const commit = () => {
    const next = draft;
    if (next !== value) onCommit(next);
  };

  return (
    <span className={cn("group relative inline-flex min-w-0 items-center", className)}>
      <input
        ref={ref}
        className={cn(
          "min-w-0 flex-1 cursor-text rounded-md border border-transparent bg-transparent px-1.5 py-0.5 pr-5 outline-none",
          "hover:border-border hover:bg-muted focus:border-primary focus:bg-background",
          "disabled:cursor-default disabled:hover:border-transparent disabled:hover:bg-transparent",
          isDefault && !focused && "text-muted-foreground",
          inputClassName,
        )}
        value={draft}
        aria-label={ariaLabel}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            ref.current?.blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setDraft(value);
            ref.current?.blur();
          }
        }}
      />
      {!disabled && (
        <Pencil
          aria-hidden
          className="pointer-events-none absolute right-1.5 h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-60 group-focus-within:opacity-0"
        />
      )}
    </span>
  );
}
