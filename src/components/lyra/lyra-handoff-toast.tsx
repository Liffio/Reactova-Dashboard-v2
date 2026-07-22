/**
 * The animated top-right card shown while the Lyra handoff theater fills a
 * form after a redirect from the Ask AI drawer. Renders the step checklist in
 * sync with `useLyraHandoffTheater`, then morphs into a "review & confirm"
 * nudge once every field has landed.
 */
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TheaterPhase, TheaterStep } from "@/hooks/use-lyra-handoff-theater";

export function LyraHandoffToast({
  visible,
  phase,
  steps,
  currentIndex,
  title,
  doneTitle,
  doneMessage,
  onDismiss,
}: {
  visible: boolean;
  phase: TheaterPhase;
  steps: TheaterStep[];
  currentIndex: number;
  /** Header while running, e.g. "Lyra is setting up your post". */
  title: string;
  /** Header once done, e.g. "All set — over to you". */
  doneTitle: string;
  /** Body once done, e.g. "Review everything, then hit Schedule." */
  doneMessage: string;
  onDismiss: () => void;
}) {
  if (!visible || phase === "idle") return null;
  const done = phase === "done";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-4 top-16 z-[100] w-80 max-w-[calc(100vw-2rem)] animate-in fade-in-0 slide-in-from-right-4 duration-300"
    >
      <div className="rounded-2xl bg-brand-gradient p-px shadow-glow">
        <div className="rounded-2xl bg-card p-3.5">
          <div className="flex items-start gap-2.5">
            <span
              className={cn(
                "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10",
                !done && "animate-pulse",
              )}
            >
              <Sparkles className="h-4 w-4 text-primary" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">{done ? doneTitle : title}</p>
              {done ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{doneMessage}</p>
              ) : (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Click anywhere to skip the magic ✨
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss"
              className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <ul className="mt-3 space-y-1.5">
            {steps.map((step, i) => {
              const stepDone = done || i < currentIndex;
              const active = !done && i === currentIndex;
              return (
                <li
                  key={`${i}-${step.label}`}
                  className={cn(
                    "flex items-center gap-2 text-xs transition-all duration-300",
                    stepDone
                      ? "text-foreground"
                      : active
                        ? "text-foreground"
                        : "text-muted-foreground/60",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-4 w-4 shrink-0 place-items-center rounded-full transition-colors duration-300",
                      stepDone
                        ? "bg-success/15 text-success"
                        : active
                          ? "text-primary"
                          : "bg-muted",
                    )}
                  >
                    {stepDone ? (
                      <Check className="h-2.5 w-2.5 animate-in zoom-in-50 duration-200" />
                    ) : active ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                    )}
                  </span>
                  <span className={cn(active && "animate-pulse")}>{step.label}</span>
                </li>
              );
            })}
          </ul>

          {/* Progress shimmer while running; solid success bar when done. */}
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                done ? "bg-success" : "bg-brand-gradient",
              )}
              style={{
                width: `${steps.length === 0 ? 100 : Math.round(((done ? steps.length : currentIndex) / steps.length) * 100)}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
