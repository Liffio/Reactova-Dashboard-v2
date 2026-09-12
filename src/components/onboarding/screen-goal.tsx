import { useEffect, useMemo, useRef, useState } from "react";
import { CircleHelp, Coins, Gift, Link2, Tag } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  goalOptionsForRole,
  type OnboardingGoal,
  type OnboardingRole,
} from "@/lib/onboarding/templates";

const ICONS: Record<OnboardingGoal, typeof Link2> = {
  link: Link2,
  resource: Gift,
  code: Tag,
  prices: Coins,
  unsure: CircleHelp,
};

const ADVANCE_DELAY_MS = 250;

/**
 * Screen 2 — What do you want to DM people when they comment?
 *
 * The order comes from screen 1's answer (`goalOptionsForRole`) and nothing is ever hidden: a
 * creator can still pick "a link to buy", it is just not the first thing they read. Reordering
 * rather than filtering is what makes screen 1 safe to skip.
 *
 * "Not sure yet" is an answer, not a skip — it stores `goal: "unsure"` and resolves to the free
 * resource template. A real skip stores `goal: null` and lands on the same template. The two are
 * kept distinct in storage because "I don't know" and "don't ask me" are different things to know
 * about a user, even though today they produce the same screen 3.
 */
export function ScreenGoal({
  role,
  onPick,
}: {
  role: OnboardingRole | null;
  onPick: (goal: OnboardingGoal) => void;
}) {
  const options = useMemo(() => goalOptionsForRole(role), [role]);
  const [selected, setSelected] = useState<OnboardingGoal | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const pick = (goal: OnboardingGoal) => {
    if (selected) return;
    setSelected(goal);
    timer.current = setTimeout(() => onPick(goal), ADVANCE_DELAY_MS);
  };

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-1 flex-col justify-center py-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        What do you want to DM people when they comment?
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Pick one to start. You can set up others later.
      </p>

      <div className="mt-6 space-y-2.5">
        {options.map(({ goal, title, subtitle }) => {
          const Icon = ICONS[goal];
          return (
            <button
              key={goal}
              type="button"
              onClick={() => pick(goal)}
              aria-pressed={selected === goal}
              className={cn(
                "flex w-full items-center gap-3.5 rounded-xl border p-4 text-left transition-colors",
                selected === goal
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
          );
        })}
      </div>
    </div>
  );
}
