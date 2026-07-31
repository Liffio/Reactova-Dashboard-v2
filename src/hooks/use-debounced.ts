import { useEffect, useState } from "react";

/**
 * Debounced mirror of a value, for search boxes that drive a server query.
 *
 * The point is to keep the input responsive while the *request* lags behind it — typing
 * "automation" should cost one query, not ten. Paired with a server-side search endpoint; it is
 * not a substitute for one.
 */
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
