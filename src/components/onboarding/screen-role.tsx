import { useEffect, useRef, useState } from "react";
import { Briefcase, Users, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";
import type { OnboardingRole } from "@/lib/onboarding/templates";

const OPTIONS: Array<{
  role: OnboardingRole;
  title: string;
  subtitle: string;
  Icon: typeof UserRound;
}> = [
  {
    role: "creator",
    title: "My own account",
    subtitle: "I'm a creator or I run my own page",
    Icon: UserRound,
  },
  {
    role: "business",
    title: "My business",
    subtitle: "A brand, shop, or service",
    Icon: Briefcase,
  },
  {
    role: "agency",
    title: "My clients",
    subtitle: "I manage Instagram for other people",
    Icon: Users,
  },
];

/** How long the selected state is visible before the screen advances. */
const ADVANCE_DELAY_MS = 250;

/**
 * Screen 1 — Who are you setting Liffio up for?
 *
 * **No Continue button.** A tap selects, holds the selected state for a beat so the choice
 * registers visually, then advances. The beat is the point: an instant jump reads as a mis-tap and
 * people hit back to check what they picked.
 *
 * The answer is a *hint*, never a gate — it reorders screen 2's options and changes two strings
 * later. Skipping stores `role: null` and everything downstream falls back to the business
 * ordering, so nothing here can put someone in a worse place than not answering.
 */
export function ScreenRole({ onPick }: { onPick: (role: OnboardingRole) => void }) {
  const [selected, setSelected] = useState<OnboardingRole | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The timeout outlives the component if the user navigates back during the beat; without this
  // it fires onPick on an unmounted screen and pushes them forward from a screen they left.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const pick = (role: OnboardingRole) => {
    if (selected) return;
    setSelected(role);
    timer.current = setTimeout(() => onPick(role), ADVANCE_DELAY_MS);
  };

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-1 flex-col justify-center py-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Who are you setting Liffio up for?
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We&apos;ll use this to show you the right examples.
      </p>

      <div className="mt-6 space-y-2.5">
        {OPTIONS.map(({ role, title, subtitle, Icon }) => (
          <button
            key={role}
            type="button"
            onClick={() => pick(role)}
            aria-pressed={selected === role}
            className={cn(
              "flex w-full items-center gap-3.5 rounded-xl border p-4 text-left transition-colors",
              selected === role
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "hover:border-foreground/20 hover:bg-accent/50",
            )}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted">
              <Icon className="h-4.5 w-4.5 text-foreground" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{title}</span>
              <span className="block text-sm text-muted-foreground">{subtitle}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
