import { useCallback, useEffect, useRef, useState } from "react";
import {
  callLyra,
  streamLyra,
  lyraTaskSupportsStreaming,
  type LyraCallConfig,
  type LyraError,
  type LyraTaskMap,
} from "@/lib/api/lyra-api";
import { clearLyraPersistedKey, readLyraPersisted, writeLyraPersisted } from "@/lib/lyra-persist";

export type LyraStatus = "idle" | "thinking" | "streaming" | "complete" | "error";

export type LyraRunResult<K extends keyof LyraTaskMap> =
  | { status: "complete"; text: string; content: LyraTaskMap[K]["output"] | null }
  | { status: "error"; error: LyraError }
  | { status: "cancelled" };

export type UseLyraResult<K extends keyof LyraTaskMap> = {
  status: LyraStatus;
  /** Assembled text so far, for streaming tasks (chat/caption/custom_prompt). */
  text: string;
  /** Typed structured output, populated for non-streaming tasks on complete. */
  content: LyraTaskMap[K]["output"] | null;
  error: LyraError | null;
  /** Timestamp (ms) the current/last run started, for cold-start UI timing. */
  startedAt: number | null;
  /** Drives the call and also resolves with the final outcome, so callers don't need to wait for a re-render to act on the result. */
  run: (config: LyraCallConfig<K>) => Promise<LyraRunResult<K>>;
  cancel: () => void;
  reset: () => void;
  isActive: boolean;
};

type LyraState<K extends keyof LyraTaskMap> = {
  status: LyraStatus;
  text: string;
  content: LyraTaskMap[K]["output"] | null;
  error: LyraError | null;
  startedAt: number | null;
};

const IDLE_STATE: LyraState<keyof LyraTaskMap> = {
  status: "idle",
  text: "",
  content: null,
  error: null,
  startedAt: null,
};

function hydrateState<K extends keyof LyraTaskMap>(persistKey: string | null): LyraState<K> {
  const base = IDLE_STATE as LyraState<K>;
  if (!persistKey) return base;
  const persisted = readLyraPersisted<LyraState<K>>(persistKey);
  if (!persisted) return base;
  // A reload interrupts any in-flight run — the network stream can't be
  // resumed, so surface whatever was captured as final instead of leaving
  // the UI stuck on a "thinking"/"streaming" animation forever.
  if (persisted.status === "thinking" || persisted.status === "streaming") {
    return persisted.text || persisted.content ? { ...persisted, status: "complete" } : base;
  }
  return persisted;
}

const PERSIST_DEBOUNCE_MS = 250;

/**
 * Drives one Lyra task invocation end-to-end (streaming or not) and exposes
 * enough state for a <LyraThinking/> consumer to render every phase.
 * Each call site owns one instance — don't share across unrelated buttons.
 *
 * Pass `persistKey` to survive a page refresh/relogin: the last known state
 * is mirrored to localStorage (debounced) and rehydrated on mount.
 */
export function useLyra<K extends keyof LyraTaskMap>(options?: {
  persistKey?: string | null;
}): UseLyraResult<K> {
  const persistKey = options?.persistKey ?? null;
  const persistKeyRef = useRef(persistKey);
  const [state, setState] = useState<LyraState<K>>(() => hydrateState<K>(persistKey));
  const abortRef = useRef<AbortController | null>(null);
  const persistTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (persistKeyRef.current === persistKey) return;
    persistKeyRef.current = persistKey;
    setState(hydrateState<K>(persistKey));
    // Only re-hydrate when the storage slot itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistKey]);

  const persistNow = useCallback((next: LyraState<K>) => {
    if (!persistKeyRef.current) return;
    writeLyraPersisted(persistKeyRef.current, next);
  }, []);

  const schedulePersist = useCallback(
    (next: LyraState<K>) => {
      if (!persistKeyRef.current) return;
      if (persistTimerRef.current !== null) window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = window.setTimeout(() => {
        persistTimerRef.current = null;
        persistNow(next);
      }, PERSIST_DEBOUNCE_MS);
    },
    [persistNow]
  );

  const update = useCallback(
    (patch: Partial<LyraState<K>>, opts?: { flush?: boolean }) => {
      setState((prev) => {
        const next = { ...prev, ...patch };
        if (opts?.flush) persistNow(next);
        else schedulePersist(next);
        return next;
      });
    },
    [persistNow, schedulePersist]
  );

  useEffect(
    () => () => {
      if (persistTimerRef.current !== null) window.clearTimeout(persistTimerRef.current);
    },
    []
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    update({ status: "idle" }, { flush: true });
  }, [update]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    if (persistKeyRef.current) clearLyraPersistedKey(persistKeyRef.current);
    setState(IDLE_STATE as LyraState<K>);
  }, []);

  const run = useCallback(
    async (config: LyraCallConfig<K>): Promise<LyraRunResult<K>> => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      update({ status: "thinking", text: "", content: null, error: null, startedAt: Date.now() });

      let outcome: LyraRunResult<K>;

      if (lyraTaskSupportsStreaming(config.task)) {
        let acc = "";
        let streamError: LyraError | null = null;
        await streamLyra(
          { ...config, signal: controller.signal },
          {
            onDelta: (delta) => {
              acc += delta;
              update({ text: acc, status: "streaming" });
            },
            onComplete: () => {
              update({ status: "complete" }, { flush: true });
            },
            onError: (err) => {
              streamError = err;
              update({ status: "error", error: err }, { flush: true });
            },
          }
        );
        outcome = controller.signal.aborted
          ? { status: "cancelled" }
          : streamError
            ? { status: "error", error: streamError }
            : { status: "complete", text: acc, content: null };
      } else {
        try {
          const result = await callLyra({ ...config, signal: controller.signal });
          update({ content: result.content, status: "complete" }, { flush: true });
          outcome = { status: "complete", text: "", content: result.content };
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            outcome = { status: "cancelled" };
          } else {
            const lyraErr = err as LyraError;
            update({ status: "error", error: lyraErr }, { flush: true });
            outcome = { status: "error", error: lyraErr };
          }
        }
      }

      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      return outcome;
    },
    [update]
  );

  return {
    status: state.status,
    text: state.text,
    content: state.content,
    error: state.error,
    startedAt: state.startedAt,
    run,
    cancel,
    reset,
    isActive: state.status === "thinking" || state.status === "streaming",
  };
}
