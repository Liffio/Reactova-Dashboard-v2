/**
 * Global registry of in-flight `useAutosave` flush functions. Lets a single
 * top-level actor (the session watcher) force every mounted draft form to
 * persist its latest snapshot before a forced logout, without each form
 * needing to know about session expiry.
 */

type FlushFn = () => Promise<void>;

const flushers = new Set<FlushFn>();

export function registerAutosaveFlush(flush: FlushFn): () => void {
  flushers.add(flush);
  return () => flushers.delete(flush);
}

/** Best-effort: flushes every mounted autosave, ignoring individual failures. */
export async function flushAllAutosaves(): Promise<void> {
  await Promise.all(Array.from(flushers).map((flush) => flush().catch(() => undefined)));
}
