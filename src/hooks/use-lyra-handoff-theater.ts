/**
 * Step engine for the Lyra handoff "theater": after a redirect from the Ask AI
 * drawer, the destination page queues one step per form field and this hook
 * plays them back — each tick applies one step's form mutation and advances the
 * synced checklist in the handoff toast.
 *
 * The generation already happened before the redirect, so this is deliberate
 * choreography, not real progress — which is why it is instantly skippable:
 * any click while it runs (or `prefers-reduced-motion`) applies every
 * remaining step at once.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type TheaterStep = {
  /** Checklist line shown in the handoff toast, e.g. "Writing your caption". */
  label: string;
  /** Form mutation for this step. Runs exactly once, in order. */
  apply: () => void;
};

export type TheaterPhase = "idle" | "running" | "done";

const TICK_MS = 450;
/** How long the completed toast lingers before auto-dismissing. */
const DONE_LINGER_MS = 6000;

export function useLyraHandoffTheater() {
  const [steps, setSteps] = useState<TheaterStep[]>([]);
  const [phase, setPhase] = useState<TheaterPhase>("idle");
  /** Index of the step currently being "worked on"; steps below it are done. */
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  const stepsRef = useRef<TheaterStep[]>([]);
  const indexRef = useRef(0);
  const phaseRef = useRef<TheaterPhase>("idle");
  const timerRef = useRef<number | null>(null);
  const lingerRef = useRef<number | null>(null);
  const onDoneRef = useRef<(() => void) | null>(null);

  const clearTimers = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (lingerRef.current !== null) {
      window.clearTimeout(lingerRef.current);
      lingerRef.current = null;
    }
  };

  const finish = useCallback(() => {
    clearTimers();
    phaseRef.current = "done";
    setPhase("done");
    setCurrentIndex(stepsRef.current.length);
    onDoneRef.current?.();
    lingerRef.current = window.setTimeout(() => setVisible(false), DONE_LINGER_MS);
  }, []);

  /** Applies every not-yet-applied step immediately and jumps to the end state. */
  const skip = useCallback(() => {
    if (phaseRef.current !== "running") return;
    for (let i = indexRef.current; i < stepsRef.current.length; i++) {
      stepsRef.current[i].apply();
    }
    indexRef.current = stepsRef.current.length;
    finish();
  }, [finish]);

  const start = useCallback(
    (nextSteps: TheaterStep[], options?: { onDone?: () => void }) => {
      clearTimers();
      stepsRef.current = nextSteps;
      indexRef.current = 0;
      onDoneRef.current = options?.onDone ?? null;
      setSteps(nextSteps);
      setVisible(true);

      if (nextSteps.length === 0) {
        finish();
        return;
      }

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reducedMotion) {
        phaseRef.current = "running";
        skip();
        return;
      }

      phaseRef.current = "running";
      setPhase("running");
      setCurrentIndex(0);

      timerRef.current = window.setInterval(() => {
        const i = indexRef.current;
        if (i >= stepsRef.current.length) {
          finish();
          return;
        }
        stepsRef.current[i].apply();
        indexRef.current = i + 1;
        if (indexRef.current >= stepsRef.current.length) {
          finish();
        } else {
          setCurrentIndex(indexRef.current);
        }
      }, TICK_MS);
    },
    [finish, skip],
  );

  /** Hide the toast immediately (e.g. the compose dialog was closed mid-review). */
  const dismiss = useCallback(() => {
    clearTimers();
    if (phaseRef.current === "running") {
      // Never leave the form half-filled — dismissing mid-run completes the fill.
      for (let i = indexRef.current; i < stepsRef.current.length; i++) {
        stepsRef.current[i].apply();
      }
      indexRef.current = stepsRef.current.length;
      phaseRef.current = "done";
      setPhase("done");
      setCurrentIndex(stepsRef.current.length);
    }
    setVisible(false);
  }, []);

  // Any click while the theater runs skips straight to the finished state.
  useEffect(() => {
    if (phase !== "running") return;
    const onPointerDown = () => skip();
    document.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => document.removeEventListener("pointerdown", onPointerDown, { capture: true });
  }, [phase, skip]);

  useEffect(() => clearTimers, []);

  return { steps, phase, currentIndex, visible, start, skip, dismiss };
}
