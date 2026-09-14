import { cn } from "@/lib/utils";

/**
 * The one place the Lyra beta caveat is worded.
 *
 * Shown wherever a user is about to rely on an AI answer — the automation copilot and the
 * assistant. Kept as a single component rather than a copied string so the wording cannot drift
 * between surfaces, and so dropping the notice when Lyra leaves beta is one deletion, not a hunt.
 */
export function LyraBetaNotice({ className }: { className?: string }) {
  return (
    <p className={cn("text-[11px] leading-relaxed text-muted-foreground", className)}>
      <span className="font-semibold text-foreground">Lyra is in BETA</span> — answers may not be
      accurate or up to date, and can take a moment to arrive.
    </p>
  );
}
