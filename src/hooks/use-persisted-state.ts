import { useEffect, useRef, useState } from "react";
import { readLyraPersisted, writeLyraPersisted } from "@/lib/lyra-persist";

/**
 * useState that mirrors to localStorage under `key`, hydrating on mount.
 * Pass `key: null` to disable persistence (e.g. while a workspace id isn't
 * known yet) — behaves like plain useState in that case. Changing `key`
 * re-hydrates from the new slot.
 */
export function usePersistedState<T>(
  key: string | null,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const keyRef = useRef(key);
  const [state, setState] = useState<T>(() => {
    if (!key) return initialValue;
    const persisted = readLyraPersisted<T>(key);
    return persisted ?? initialValue;
  });

  useEffect(() => {
    if (keyRef.current === key) return;
    keyRef.current = key;
    setState(key ? (readLyraPersisted<T>(key) ?? initialValue) : initialValue);
    // Only re-hydrate when the storage slot itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!key) return;
    writeLyraPersisted(key, state);
  }, [key, state]);

  return [state, setState];
}
