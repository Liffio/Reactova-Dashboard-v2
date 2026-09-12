import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import type { OnboardingRole } from "@/lib/onboarding/templates";

export type ChecklistItem = {
  key: string;
  label: string;
  done: boolean;
  to?: string;
  search?: Record<string, unknown>;
};

/**
 * Build the checklist for a workspace's actual state.
 *
 * ## Every item works on Free
 *
 * Deliberate. A setup checklist that lists something the user cannot do without paying is not a
 * checklist, it is an upsell wearing one, and it can never reach "all done". Team invites are on
 * it because Free genuinely includes two seats.
 *
 * ## Skipping the first automation removes two items permanently
 *
 * "Go live with your first automation" and "Get your first DM sent" both disappear once
 * `skippedAt` is set. The user said no; continuing to show them a list with their refusal
 * un-ticked on it is the product arguing with them. **"Connect Instagram" never disappears** —
 * nothing in the app works without it, so it is the one thing we keep asking for.
 *
 * ## "Get your first DM sent" is the activation event
 *
 * It ticks off `firstDmSentAt` from the usage endpoint — the earliest DM this workspace actually
 * delivered — not off "an automation exists". A live automation that has never fired has not
 * proven anything to the user yet.
 */
export function buildChecklist(input: {
  role: OnboardingRole | null;
  instagramConnected: boolean;
  hasLiveAutomation: boolean;
  firstDmSentAt: string | null;
  teamMembersUsed: number;
  skippedFirstAutomation: boolean;
}): ChecklistItem[] {
  const items: ChecklistItem[] = [
    {
      key: "connect",
      label: "Connect Instagram",
      done: input.instagramConnected,
      to: "/onboarding",
    },
  ];

  if (!input.skippedFirstAutomation) {
    items.push(
      {
        key: "automation",
        label: "Go live with your first automation",
        done: input.hasLiveAutomation,
        to: "/automations/new",
      },
      {
        key: "first-dm",
        label: "Get your first DM sent",
        done: Boolean(input.firstDmSentAt),
      },
    );
  }

  // Free includes two seats — the owner plus one — so this is actionable for everyone it is shown
  // to. Creators running their own page are not invited to invite themselves.
  if (input.role === "business" || input.role === "agency") {
    items.push({
      key: "team",
      label: "Invite a teammate",
      done: input.teamMembersUsed > 1,
      to: "/team/invite",
    });
  }

  return items;
}

export function SetupChecklist({
  items,
  onHide,
  onDismissComplete,
}: {
  items: ChecklistItem[];
  onHide: () => void;
  /** Only offered once every item is done. */
  onDismissComplete?: () => void;
}) {
  const [open, setOpen] = useState(true);

  if (items.length === 0) {
    return null;
  }

  const doneCount = items.filter((item) => item.done).length;
  const allDone = doneCount === items.length;

  return (
    <section className="rounded-2xl border bg-card shadow-soft">
      <div className="flex items-center gap-2 p-4">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open ? "" : "-rotate-90",
            )}
          />
          <span className="font-display text-sm font-semibold">Get set up</span>
          <span className="text-xs text-muted-foreground">
            {doneCount} of {items.length}
          </span>
        </button>
        {/* Available at any time, not only when finished — a checklist you cannot close is a
            banner. Reopened from the "Setup guide" button in the top bar. */}
        <button
          type="button"
          onClick={onHide}
          className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Hide
        </button>
      </div>

      {open ? (
        <div className="space-y-1 px-4 pb-4">
          {items.map((item) => {
            const content = (
              <>
                <span
                  className={cn(
                    "grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors",
                    item.done ? "border-success bg-success text-white" : "border-border",
                  )}
                >
                  {item.done ? <Check className="h-3 w-3" /> : null}
                </span>
                <span className={cn("text-sm", item.done && "text-muted-foreground line-through")}>
                  {item.label}
                </span>
              </>
            );

            if (item.done || !item.to) {
              return (
                <div key={item.key} className="flex items-center gap-2.5 py-1.5">
                  {content}
                </div>
              );
            }

            return (
              <Link
                key={item.key}
                to={item.to}
                className="-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/60"
              >
                {content}
              </Link>
            );
          })}

          {allDone ? (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-success/10 p-3">
              <p className="text-sm text-success">
                <span className="font-medium">You&apos;re all set 🎉</span> Your first DM went out.
              </p>
              {onDismissComplete ? (
                <button
                  type="button"
                  onClick={onDismissComplete}
                  className="shrink-0 text-xs font-medium text-success underline underline-offset-2"
                >
                  Dismiss
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
