import { useCallback, useRef, useState } from "react";
import {
  callLyra,
  streamLyra,
  lyraTaskSupportsStreaming,
  type LyraCallConfig,
  type LyraError,
  type LyraTaskMap,
} from "@/lib/api/lyra-api";

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

/**
 * Drives one Lyra task invocation end-to-end (streaming or not) and exposes
 * enough state for a <LyraThinking/> consumer to render every phase.
 * Each call site owns one instance — don't share across unrelated buttons.
 */
export function useLyra<K extends keyof LyraTaskMap>(): UseLyraResult<K> {
  const [status, setStatus] = useState<LyraStatus>("idle");
  const [text, setText] = useState("");
  const [content, setContent] = useState<LyraTaskMap[K]["output"] | null>(null);
  const [error, setError] = useState<LyraError | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
    setText("");
    setContent(null);
    setError(null);
    setStartedAt(null);
  }, []);

  const run = useCallback(async (config: LyraCallConfig<K>): Promise<LyraRunResult<K>> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("thinking");
    setText("");
    setContent(null);
    setError(null);
    setStartedAt(Date.now());

    let outcome: LyraRunResult<K>;

    if (lyraTaskSupportsStreaming(config.task)) {
      let acc = "";
      let streamError: LyraError | null = null;
      await streamLyra(
        { ...config, signal: controller.signal },
        {
          onDelta: (delta) => {
            acc += delta;
            setText(acc);
            setStatus("streaming");
          },
          onComplete: () => {
            setStatus("complete");
          },
          onError: (err) => {
            streamError = err;
            setStatus("error");
            setError(err);
          },
        },
      );
      outcome = controller.signal.aborted
        ? { status: "cancelled" }
        : streamError
          ? { status: "error", error: streamError }
          : { status: "complete", text: acc, content: null };
    } else {
      try {
        const result = await callLyra({ ...config, signal: controller.signal });
        setContent(result.content);
        setStatus("complete");
        outcome = { status: "complete", text: "", content: result.content };
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          outcome = { status: "cancelled" };
        } else {
          const lyraErr = err as LyraError;
          setStatus("error");
          setError(lyraErr);
          outcome = { status: "error", error: lyraErr };
        }
      }
    }

    if (abortRef.current === controller) {
      abortRef.current = null;
    }
    return outcome;
  }, []);

  return {
    status,
    text,
    content,
    error,
    startedAt,
    run,
    cancel,
    reset,
    isActive: status === "thinking" || status === "streaming",
  };
}
