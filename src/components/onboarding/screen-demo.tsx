import { useCallback, useEffect, useRef, useState } from "react";
import { Check, MessageCircle, RotateCcw, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { commentMatchesKeywords } from "@/lib/onboarding/keyword-match";
import type { OnboardingTemplate } from "@/lib/onboarding/templates";
import { DmPreview } from "./dm-preview";

/**
 * Screen 3 — the demo.
 *
 * ## What it is
 *
 * The whole product, working, before we ask for a single permission. The user types a comment on a
 * fake post; the public reply appears under it; the DM lands. It is the only screen in the flow
 * that shows rather than tells, and it is the reason screen 4's ask is an easy yes.
 *
 * ## Three rules it has to keep
 *
 * 1. **It matches like production.** `commentMatchesKeywords` is a port of the server's matcher —
 *    lower-case, punctuation stripped, whole words. A demo that fires on "guidebook" when
 *    production would not is a lie told at the moment we are asking to be trusted.
 * 2. **It shows the Free branding.** `DmPreview` renders the appended line and the follow-up DM,
 *    from the server's config. See that component for why this is non-negotiable.
 * 3. **It creates nothing.** No automation, no draft, no request. Everything below is local state.
 *
 * ## Timing
 *
 * 0.8s to the public reply, then 1.2s to the DM. Slow enough to read as a sequence of events
 * rather than a single render, fast enough not to feel like waiting. Both are skipped entirely
 * under `prefers-reduced-motion`, where the same information arrives at once.
 */
type Phase = "idle" | "commented" | "replied" | "dm";

const REPLY_DELAY_MS = 800;
const DM_DELAY_MS = 1200;

const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function ScreenDemo({
  template,
  onContinue,
}: {
  template: OnboardingTemplate;
  onContinue: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [comment, setComment] = useState("");
  const [postedComment, setPostedComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const dmRef = useRef<HTMLDivElement | null>(null);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const replay = () => {
    clearTimers();
    setPhase("idle");
    setPostedComment("");
    setComment("");
    setError(null);
  };

  const post = () => {
    const trimmed = comment.trim();
    if (!trimmed) {
      setError("Type a comment first");
      return;
    }
    if (!commentMatchesKeywords(trimmed, template.demoKeywords)) {
      setError(template.demoMissHint);
      setComment("");
      return;
    }

    setError(null);
    setPostedComment(trimmed);
    setComment("");
    setPhase("commented");

    if (prefersReducedMotion()) {
      setPhase("dm");
      return;
    }
    timers.current.push(setTimeout(() => setPhase("replied"), REPLY_DELAY_MS));
    timers.current.push(setTimeout(() => setPhase("dm"), REPLY_DELAY_MS + DM_DELAY_MS));
  };

  // Mobile: the DM lands below the fold, so bring it into view once it exists. Desktop keeps both
  // columns on screen and does not need it, but scrollIntoView on an already-visible element is a
  // no-op, so there is no branch.
  useEffect(() => {
    if (phase === "dm") {
      dmRef.current?.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "nearest",
      });
    }
  }, [phase]);

  const railSteps = [
    { label: `Someone comments ${template.displayKeyword}`, done: phase !== "idle" },
    { label: "Liffio replies to their comment", done: phase === "replied" || phase === "dm" },
    { label: "They get your DM in seconds", done: phase === "dm" },
  ];

  return (
    <div className="mx-auto grid w-full max-w-4xl flex-1 gap-8 py-6 lg:grid-cols-[360px_1fr] lg:items-start lg:gap-12 lg:py-10">
      {/* ── Left: the post, comments and DMs ───────────────────────────── */}
      <div className="order-2 lg:order-1">
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex items-center gap-2.5 border-b px-3.5 py-3">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-muted text-xs font-medium">
              Y
            </span>
            <span className="text-sm font-medium">yourpage</span>
          </div>

          <div className="aspect-[4/3] bg-gradient-to-br from-muted to-muted/40" aria-hidden />

          <div className="space-y-3 p-3.5">
            <p className="text-sm">{template.demoCaption}</p>

            {postedComment ? (
              <div className="space-y-2 border-t pt-3">
                <div className="flex gap-2.5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-medium">
                    Y
                  </span>
                  <p className="min-w-0 break-words text-sm">
                    <span className="font-medium">you</span>{" "}
                    <span className="text-muted-foreground">{postedComment}</span>
                  </p>
                </div>

                {(phase === "replied" || phase === "dm") && (
                  <div className="ml-9 flex gap-2.5">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-medium text-primary">
                      Y
                    </span>
                    <p className="min-w-0 break-words text-sm">
                      <span className="font-medium">yourpage</span>{" "}
                      <span className="text-muted-foreground">{template.publicReply}</span>
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            {phase === "dm" ? (
              <div ref={dmRef} className="space-y-2 border-t pt-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <MessageCircle className="h-3.5 w-3.5" />
                  Direct messages
                </p>
                <DmPreview message={template.dmMessage} buttonLabel={template.dmButtonLabel} />
              </div>
            ) : null}
          </div>

          {phase === "idle" ? (
            <div className="border-t p-3.5">
              <div className="flex gap-2">
                <input
                  value={comment}
                  onChange={(event) => {
                    setComment(event.target.value);
                    if (error) setError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      post();
                    }
                  }}
                  placeholder={template.demoInputPlaceholder}
                  aria-label="Write a comment"
                  aria-invalid={Boolean(error)}
                  className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <Button type="button" size="sm" className="h-9 shrink-0" onClick={post}>
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Post
                </Button>
              </div>
              {error ? (
                <p className="mt-2 text-xs text-destructive" role="status">
                  {error}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <p className="mt-2 text-center text-xs text-muted-foreground">
          Sample post. Nothing gets posted to Instagram.
        </p>
      </div>

      {/* ── Right: headline, rail and CTA ──────────────────────────────── */}
      <div className="order-1 lg:order-2 lg:pt-4">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Here&apos;s how it works
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Comment on this post like one of your followers would.
        </p>

        <ol className="mt-6 space-y-3">
          {railSteps.map((step, index) => (
            <li
              key={step.label}
              className={cn(
                "flex items-center gap-3 text-sm transition-colors",
                step.done ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-medium transition-colors",
                  step.done ? "border-primary bg-primary text-primary-foreground" : "border-border",
                )}
              >
                {step.done ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              {step.label}
            </li>
          ))}
        </ol>

        {phase === "dm" ? (
          <div className="mt-8 space-y-2">
            <Button type="button" className="w-full" onClick={onContinue}>
              Set this up on my Instagram
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={replay}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Replay
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
