import { useState } from "react";
import { Check, Instagram, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { formatHandle } from "@/lib/format";
import type { OnboardingRole } from "@/lib/onboarding/templates";

const STEPS = [
  "Instagram asks you to log in",
  "You approve access for Liffio",
  "You come back here",
];

/**
 * Screen 4 — Connect Instagram.
 *
 * ## Why the access line is spelled out
 *
 * Instagram's own consent dialog lists scopes in its language, not ours, and "publish posts" on a
 * screen the user reached to automate comments reads as overreach if it arrives unannounced. So
 * every permission we are about to ask for is named here first, in plain words, with the one that
 * looks alarming explained ("only when you schedule one"). The cost of saying it is a longer
 * screen; the cost of not saying it is the user cancelling inside Meta's dialog, where we cannot
 * explain anything.
 *
 * ## "Do this later" is real
 *
 * It goes to the dashboard, and the dashboard works. What it does *not* do is disappear: nothing
 * in the product functions without a connected account, so "Connect Instagram" stays on the
 * checklist permanently — unlike the first-automation step, which a skip removes for good.
 */
export function ScreenConnect({
  role,
  connecting,
  connectedHandle,
  onConnect,
  onSkip,
}: {
  role: OnboardingRole | null;
  connecting: boolean;
  /** Set for the brief confirmation beat between a successful connect and the dashboard. */
  connectedHandle: string | null;
  onConnect: () => void;
  onSkip: () => void;
}) {
  const [howToOpen, setHowToOpen] = useState(false);

  if (connectedHandle) {
    return (
      <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col items-center justify-center gap-3 py-8">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-success/10 text-success">
          <Check className="h-6 w-6" />
        </span>
        <p className="text-sm font-medium">{formatHandle(connectedHandle)} connected</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col py-8">
      <div className="flex flex-1 flex-col justify-center">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid h-11 w-11 place-items-center rounded-xl border bg-card">
            <Logo className="h-5 w-5" />
          </span>
          <span className="text-muted-foreground" aria-hidden>
            +
          </span>
          <span className="grid h-11 w-11 place-items-center rounded-xl border bg-card">
            <Instagram className="h-5 w-5" />
          </span>
        </div>

        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Now connect your Instagram
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {role === "agency"
            ? "Connect a client's professional account, or your own to try it out."
            : "Connect a professional account so you can start sending DMs like the one you just saw."}
        </p>

        <div className="mt-6 rounded-xl border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            What happens next
          </p>
          <ol className="mt-3 space-y-2.5">
            {STEPS.map((step, index) => (
              <li key={step} className="flex items-center gap-3 text-sm">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-medium">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          Instagram will ask to let Liffio see your profile and posts, read and reply to comments,
          send messages, see insights, and publish posts (only when you schedule one).
        </p>

        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Needs a Business or Creator account. On a personal account? Switching is free and takes a
          minute.{" "}
          <button
            type="button"
            onClick={() => setHowToOpen((open) => !open)}
            className="font-medium text-foreground underline underline-offset-2"
            aria-expanded={howToOpen}
          >
            How to switch
          </button>
        </p>

        {howToOpen ? (
          <ol className="mt-2 list-decimal space-y-1 rounded-lg border bg-muted/40 p-3 pl-7 text-xs text-muted-foreground">
            <li>Open Instagram and go to your profile</li>
            <li>Tap the menu, then Settings and privacy</li>
            <li>Tap Account type and tools, then Switch to professional account</li>
            <li>Pick Creator or Business and finish the steps</li>
          </ol>
        ) : null}
      </div>

      <div className="sticky bottom-0 space-y-2 bg-background pb-2 pt-4">
        <Button type="button" className="w-full" onClick={onConnect} disabled={connecting}>
          {connecting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting…
            </>
          ) : (
            <>
              <Instagram className="mr-2 h-4 w-4" />
              Connect Instagram
            </>
          )}
        </Button>

        <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Official Instagram API · Verified Meta Tech Provider
        </p>

        <p className="text-center text-xs text-muted-foreground">
          Liffio never sees your password. You can disconnect any time in Settings.
        </p>

        <button
          type="button"
          onClick={onSkip}
          className="mx-auto block rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Do this later
        </button>
      </div>
    </div>
  );
}
