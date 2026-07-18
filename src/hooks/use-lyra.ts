import { useCallback, useRef, useSyncExternalStore } from "react";
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

/**
 * Module-level store, keyed by `persistKey`, so a generation keeps running — and
 * keeps updating live — even when the UI that started it unmounts (closing a
 * Popover, a compose Dialog, a Sheet/drawer) and a *new* component instance
 * mounts later with the same key (reopening it). Plain component-local
 * `useState` can't survive that unmount; this can, because nothing here is
 * owned by any single component instance — `run`/`cancel`/`reset` operate on
 * the shared entry, and every mounted subscriber for that key re-renders
 * together. localStorage (via lyra-persist) still backs it for a full page
 * reload, where no live network stream can be resumed.
 */
type StoreEntry<K extends keyof LyraTaskMap> = {
  state: LyraState<K>;
  listeners: Set<() => void>;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store = new Map<string, StoreEntry<any>>();
const controllers = new Map<string, AbortController>();
const persistTimers = new Map<string, number>();

const PERSIST_DEBOUNCE_MS = 250;
let ephemeralCounter = 0;

function hydrate<K extends keyof LyraTaskMap>(persistKey: string | null): LyraState<K> {
  const base = IDLE_STATE as LyraState<K>;
  if (!persistKey) return base;
  const persisted = readLyraPersisted<LyraState<K>>(persistKey);
  if (!persisted) return base;
  // Only reached when there's no live in-memory entry for this key yet (fresh
  // tab / page reload) — a still-running background generation is always
  // caught by the `store` map first, so downgrading a stale "thinking"/
  // "streaming" snapshot to "complete" here only affects genuinely-dead runs
  // that a reload actually interrupted.
  if (persisted.status === "thinking" || persisted.status === "streaming") {
    return persisted.text || persisted.content ? { ...persisted, status: "complete" } : base;
  }
  return persisted;
}

function getEntry<K extends keyof LyraTaskMap>(key: string, persistKey: string | null): StoreEntry<K> {
  let entry = store.get(key) as StoreEntry<K> | undefined;
  if (!entry) {
    entry = { state: hydrate<K>(persistKey), listeners: new Set() };
    store.set(key, entry);
  }
  return entry;
}

function notify(key: string): void {
  store.get(key)?.listeners.forEach((cb) => cb());
}

function persistNow(persistKey: string | null, state: LyraState<keyof LyraTaskMap>): void {
  if (!persistKey) return;
  writeLyraPersisted(persistKey, state);
}

function schedulePersist(key: string, persistKey: string | null, state: LyraState<keyof LyraTaskMap>): void {
  if (!persistKey) return;
  const existing = persistTimers.get(key);
  if (existing !== undefined) window.clearTimeout(existing);
  persistTimers.set(
    key,
    window.setTimeout(() => {
      persistTimers.delete(key);
      persistNow(persistKey, state);
    }, PERSIST_DEBOUNCE_MS)
  );
}

function updateEntry<K extends keyof LyraTaskMap>(
  key: string,
  persistKey: string | null,
  patch: Partial<LyraState<K>>,
  opts?: { flush?: boolean }
): void {
  const entry = getEntry<K>(key, persistKey);
  entry.state = { ...entry.state, ...patch };
  notify(key);
  if (opts?.flush) persistNow(persistKey, entry.state);
  else schedulePersist(key, persistKey, entry.state);
}

async function runShared<K extends keyof LyraTaskMap>(
  key: string,
  persistKey: string | null,
  config: LyraCallConfig<K>
): Promise<LyraRunResult<K>> {
  controllers.get(key)?.abort();
  const controller = new AbortController();
  controllers.set(key, controller);

  updateEntry<K>(key, persistKey, {
    status: "thinking",
    text: "",
    content: null,
    error: null,
    startedAt: Date.now(),
  });

  let outcome: LyraRunResult<K>;

  if (lyraTaskSupportsStreaming(config.task)) {
    let acc = "";
    let streamError: LyraError | null = null;
    await streamLyra(
      { ...config, signal: controller.signal },
      {
        onDelta: (delta) => {
          acc += delta;
          updateEntry<K>(key, persistKey, { text: acc, status: "streaming" } as Partial<LyraState<K>>);
        },
        onComplete: () => {
          updateEntry<K>(key, persistKey, { status: "complete" } as Partial<LyraState<K>>, { flush: true });
        },
        onError: (err) => {
          streamError = err;
          updateEntry<K>(key, persistKey, { status: "error", error: err } as Partial<LyraState<K>>, {
            flush: true,
          });
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
      updateEntry<K>(
        key,
        persistKey,
        { content: result.content, status: "complete" } as Partial<LyraState<K>>,
        { flush: true }
      );
      outcome = { status: "complete", text: "", content: result.content };
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        outcome = { status: "cancelled" };
      } else {
        const lyraErr = err as LyraError;
        updateEntry<K>(key, persistKey, { status: "error", error: lyraErr } as Partial<LyraState<K>>, {
          flush: true,
        });
        outcome = { status: "error", error: lyraErr };
      }
    }
  }

  if (controllers.get(key) === controller) controllers.delete(key);
  return outcome;
}

function cancelShared(key: string, persistKey: string | null): void {
  controllers.get(key)?.abort();
  controllers.delete(key);
  updateEntry(key, persistKey, { status: "idle" }, { flush: true });
}

function resetShared(key: string, persistKey: string | null): void {
  controllers.get(key)?.abort();
  controllers.delete(key);
  const timer = persistTimers.get(key);
  if (timer !== undefined) {
    window.clearTimeout(timer);
    persistTimers.delete(key);
  }
  if (persistKey) clearLyraPersistedKey(persistKey);
  const entry = store.get(key);
  if (entry) {
    entry.state = IDLE_STATE as LyraState<keyof LyraTaskMap>;
    notify(key);
  }
}

/**
 * Drives one Lyra task invocation end-to-end (streaming or not) and exposes
 * enough state for a <LyraThinking/> consumer to render every phase.
 *
 * Pass `persistKey` to (a) survive a page refresh/relogin — the last known
 * state is mirrored to localStorage — and (b) keep a generation's context
 * across a modal/drawer/popover closing and reopening: state for a given
 * `persistKey` lives in a module-level store, not this component instance,
 * so closing the surrounding UI never kills an in-flight generation or loses
 * its progress. Reopen with the same key (e.g. built from a stable item id)
 * and it reattaches to whatever is/was happening. Without a `persistKey`,
 * state is scoped to just this one hook instance, as before.
 */
export function useLyra<K extends keyof LyraTaskMap>(options?: {
  persistKey?: string | null;
}): UseLyraResult<K> {
  const persistKey = options?.persistKey ?? null;
  const ephemeralKeyRef = useRef<string | null>(null);
  if (!persistKey && ephemeralKeyRef.current === null) {
    ephemeralKeyRef.current = `__ephemeral_${++ephemeralCounter}`;
  }
  const key = persistKey ?? (ephemeralKeyRef.current as string);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const entry = getEntry<K>(key, persistKey);
      entry.listeners.add(onStoreChange);
      return () => {
        entry.listeners.delete(onStoreChange);
      };
    },
    [key, persistKey]
  );

  const getSnapshot = useCallback(() => getEntry<K>(key, persistKey).state, [key, persistKey]);

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const run = useCallback(
    (config: LyraCallConfig<K>) => runShared<K>(key, persistKey, config),
    [key, persistKey]
  );
  const cancel = useCallback(() => cancelShared(key, persistKey), [key, persistKey]);
  const reset = useCallback(() => resetShared(key, persistKey), [key, persistKey]);

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
