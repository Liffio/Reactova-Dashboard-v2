import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowUpCircle, Check, RotateCcw, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fadeIn, scaleIn } from "@/lib/motion";
import type { LyraStatus } from "@/hooks/use-lyra";
import type { LyraError } from "@/lib/api/lyra-api";

const DEFAULT_STATUS_LINES = [
  "Lyra is thinking…",
  "Reading the details…",
  "Shaping a first draft…",
  "Almost there…",
];

const ROTATE_MS = 9000;
const CANCEL_AFTER_MS = 5000;

function useCountdown(seconds: number | undefined) {
  const [remaining, setRemaining] = useState(seconds ?? 0);
  useEffect(() => {
    setRemaining(seconds ?? 0);
    if (!seconds) return;
    const id = window.setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [seconds]);
  return remaining;
}

function useElapsed(active: boolean, startedAt: number | null) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active || !startedAt) {
      setElapsed(0);
      return;
    }
    setElapsed(Date.now() - startedAt);
    const id = window.setInterval(() => setElapsed(Date.now() - startedAt), 500);
    return () => window.clearInterval(id);
  }, [active, startedAt]);
  return elapsed;
}

function useRotatingLine(active: boolean, lines: string[]) {
  const [index, setIndex] = useState(0);
  const linesRef = useRef(lines);
  linesRef.current = lines;
  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % linesRef.current.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [active]);
  return lines[index] ?? lines[0];
}

/** The pulsing brand-gradient glyph used for every "thinking" state. */
function LyraGlow({ size = "md" }: { size?: "sm" | "md" }) {
  const dims = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <motion.span
      className={cn(
        "relative inline-flex items-center justify-center rounded-full bg-brand-gradient shrink-0",
        dims,
      )}
      animate={{ scale: [1, 1.14, 1], opacity: [0.85, 1, 0.85] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
    >
      <motion.span
        className="absolute inset-0 rounded-full bg-brand-gradient"
        animate={{ scale: [1, 1.9, 1], opacity: [0.5, 0, 0.5] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      />
      <Sparkles className={cn("relative text-white", size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3")} />
    </motion.span>
  );
}

export type LyraThinkingProps = {
  status: LyraStatus;
  /** Growing text for streaming tasks (chat/caption/custom_prompt). */
  streamingText?: string;
  error?: LyraError | null;
  startedAt?: number | null;
  onCancel?: () => void;
  onRetry?: () => void;
  /** Override the rotating idle-status copy, e.g. for cold-start insight refreshes. */
  statusMessages?: string[];
  /** Label shown once complete, briefly, before the caller swaps it away. */
  completeLabel?: string;
  size?: "sm" | "md";
  className?: string;
};

/**
 * Shared status affordance for every Lyra call site: thinking / streaming /
 * complete / error. Callers own where the *result* lands (a filled textarea,
 * a suggestion list, …) — this only renders progress and lifecycle chrome.
 */
export function LyraThinking({
  status,
  streamingText,
  error,
  startedAt = null,
  onCancel,
  onRetry,
  statusMessages,
  completeLabel = "Done",
  size = "md",
  className,
}: LyraThinkingProps) {
  const elapsed = useElapsed(status === "thinking" || status === "streaming", startedAt);
  const rotatingLine = useRotatingLine(
    status === "thinking",
    statusMessages ?? DEFAULT_STATUS_LINES,
  );
  const countdown = useCountdown(status === "error" ? error?.retryAfterSeconds : undefined);
  const text = size === "sm" ? "text-xs" : "text-sm";

  const showCancel =
    Boolean(onCancel) &&
    (status === "streaming" || (status === "thinking" && elapsed > CANCEL_AFTER_MS));

  return (
    <AnimatePresence mode="wait">
      {status === "thinking" && (
        <motion.div
          key="thinking"
          initial="hidden"
          animate="show"
          exit="hidden"
          variants={fadeIn}
          className={cn("flex items-center gap-2 text-muted-foreground", text, className)}
        >
          <LyraGlow size={size} />
          <span className="truncate">{rotatingLine}</span>
          {showCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="ml-1 inline-flex items-center gap-1 rounded-full border border-input px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <X className="h-3 w-3" />
              Cancel
            </button>
          )}
        </motion.div>
      )}

      {status === "streaming" && (
        <motion.div
          key="streaming"
          initial="hidden"
          animate="show"
          exit="hidden"
          variants={fadeIn}
          className={cn("space-y-1.5", className)}
        >
          <div className={cn("flex items-center gap-2 text-muted-foreground", text)}>
            <LyraGlow size={size} />
            <span>Lyra is writing…</span>
            {showCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="ml-1 inline-flex items-center gap-1 rounded-full border border-input px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
            )}
          </div>
          {streamingText !== undefined && (
            <p
              className={cn(
                "whitespace-pre-wrap rounded-md border bg-muted/40 px-3 py-2 leading-relaxed",
                text,
              )}
            >
              {streamingText}
              <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-current align-middle" />
            </p>
          )}
        </motion.div>
      )}

      {status === "complete" && (
        <motion.div
          key="complete"
          initial="hidden"
          animate="show"
          exit="hidden"
          variants={scaleIn}
          className={cn("flex items-center gap-1.5 text-success", text, className)}
        >
          <Check className="h-3.5 w-3.5" />
          <span>{completeLabel}</span>
        </motion.div>
      )}

      {status === "error" && error?.code === "AI_TOKEN_LIMIT_REACHED" && (
        <motion.div
          key="token-limit-error"
          initial="hidden"
          animate="show"
          exit="hidden"
          variants={scaleIn}
          className={cn(
            "flex flex-wrap items-center gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-warning",
            text,
            className,
          )}
        >
          <ArrowUpCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 min-w-[10rem]">
            You've used all your Lyra AI tokens for this period.
          </span>
          <Link
            to="/billings"
            className="inline-flex items-center gap-1 rounded-full border border-warning/30 px-2 py-0.5 text-xs transition-colors hover:bg-warning/10"
          >
            <ArrowUpCircle className="h-3 w-3" />
            Upgrade plan
          </Link>
        </motion.div>
      )}

      {status === "error" && error?.code !== "AI_TOKEN_LIMIT_REACHED" && (
        <motion.div
          key="error"
          initial="hidden"
          animate="show"
          exit="hidden"
          variants={scaleIn}
          className={cn(
            "flex flex-wrap items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive",
            text,
            className,
          )}
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 min-w-[10rem]">{error?.message ?? "Something went wrong."}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={countdown > 0}
              className="inline-flex items-center gap-1 rounded-full border border-destructive/30 px-2 py-0.5 text-xs transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RotateCcw className="h-3 w-3" />
              {countdown > 0 ? `Try again in ${countdown}s` : "Retry"}
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
