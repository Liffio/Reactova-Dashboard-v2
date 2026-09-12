import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

export const ONBOARDING_STEPS = 4;

/**
 * The frame every onboarding screen sits in: progress, back, skip.
 *
 * Four segments, one per screen. **The dashboard has no progress bar** — reaching it is the end of
 * onboarding, not a fifth step, and a bar that still showed would tell the user they had more to
 * do at the exact moment we want them to start using the app.
 *
 * `onBack` is absent on screen 1 (there is nowhere to go back to) and `onSkip` is absent on
 * screens 3 and 4, which have their own skip affordances in the content ("Skip demo",
 * "Do this later") because they sit in different places in the layout.
 */
export function OnboardingShell({
  step,
  onBack,
  onSkip,
  skipLabel = "Skip",
  children,
}: {
  /** 1-based. */
  step: number;
  onBack?: () => void;
  onSkip?: () => void;
  skipLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="mx-auto w-full max-w-2xl px-4 pt-4 sm:px-6">
        <div
          className="flex gap-1.5"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={ONBOARDING_STEPS}
          aria-valuenow={step}
          aria-label={`Step ${step} of ${ONBOARDING_STEPS}`}
        >
          {Array.from({ length: ONBOARDING_STEPS }).map((_, index) => (
            <span
              key={index}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                index < step ? "bg-primary" : "bg-border",
              )}
            />
          ))}
        </div>

        <div className="flex h-10 items-center justify-between">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="-ml-2 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <span />
          )}
          {onSkip ? (
            <button
              type="button"
              onClick={onSkip}
              className="rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {skipLabel}
            </button>
          ) : (
            <span />
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
        {children}
      </div>
    </div>
  );
}
