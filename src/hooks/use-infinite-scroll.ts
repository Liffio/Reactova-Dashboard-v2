/**
 * Sentinel-based infinite scroll (plan/NOTIFICATIONS, D7 / §6.3).
 *
 * An `IntersectionObserver` on a sentinel element, never a scroll-position
 * handler: scroll handlers fire continuously, need throttling, and break when
 * the container resizes.
 *
 * Three details this hook exists to get right, each a silent bug otherwise:
 *
 *  1. `root` must be the SCROLL CONTAINER, not the viewport. A viewport root
 *     reports a fully-visible scrollable div's sentinel as intersecting
 *     immediately, so every page loads at once on mount.
 *  2. Re-entrancy. `fetchNextPage` must not fire while a fetch is in flight —
 *     the observer re-fires on every layout shift the previous page caused.
 *  3. The sentinel usually does not exist on first render (the list is still
 *     loading). Both refs are therefore CALLBACK refs held in state, so the
 *     observer is created the moment the nodes mount and re-created if they are
 *     replaced — a plain `useRef` would leave the observer permanently
 *     unattached in exactly the common case.
 *
 * The observer is disconnected on unmount. A panel dropdown mounts and unmounts
 * on every open/close, so a leak here compounds quickly.
 */
import { useEffect, useRef, useState } from "react";

export function useInfiniteScroll(options: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  /** Start loading before the reader reaches the bottom. */
  rootMargin?: string;
  enabled?: boolean;
}) {
  const {
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    rootMargin = "200px",
    enabled = true,
  } = options;

  const [root, setRoot] = useState<HTMLElement | null>(null);
  const [sentinel, setSentinel] = useState<HTMLElement | null>(null);

  // Latest values without re-creating the observer on every render.
  const state = useRef({ hasNextPage, isFetchingNextPage, fetchNextPage });
  state.current = { hasNextPage, isFetchingNextPage, fetchNextPage };

  useEffect(() => {
    if (!enabled || !sentinel || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        const { hasNextPage: more, isFetchingNextPage: busy, fetchNextPage: load } = state.current;
        if (!more || busy) return;
        load();
      },
      { root, rootMargin, threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [enabled, root, sentinel, rootMargin]);

  return { rootRef: setRoot, sentinelRef: setSentinel };
}
