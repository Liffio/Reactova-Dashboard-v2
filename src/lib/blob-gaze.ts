import { gaze, type Gaze } from "blobatar/gaze";

/**
 * Blobatar eyes that follow the user — personality, never interaction.
 *
 * - **Mouse / trackpad**: the library's own pointer pursuit (`target: "pointer"`).
 * - **Touch**: there is no hover, so the eyes look at each tap, then drift back to their own idle
 *   glance a moment later.
 *
 * ## Why nothing here can break a click
 * Every listener is `passive`, attached to `window`, and only READS the event: no `preventDefault`,
 * no `stopPropagation`, no capture that could reorder handlers, no `pointer-events` changes. The
 * driver itself only writes CSS custom properties on the blob's `.mo-eyes`. A tap reaches exactly
 * the element it reached before.
 *
 * ## The touch shim
 * `gaze()` attaches only when `(hover: hover) and (pointer: fine)` matches — a sensible default for
 * cursor pursuit, but it means a phone never gets a driver, so `lookAt(tap)` would do nothing. For
 * touch devices we answer that one query as "matches" while the driver is being constructed. The
 * reduced-motion query is untouched, so `prefers-reduced-motion` still switches everything off.
 */

const FINE_POINTER = "(hover: hover) and (pointer: fine)";
/** How long the eyes hold a tap before handing back to the idle glance. */
const TAP_HOLD_MS = 1600;

const isBrowser = () => typeof window !== "undefined" && typeof window.matchMedia === "function";

/** Build a driver as if the device had a fine pointer, restoring `matchMedia` straight after. */
function gazeForTouch(svg: SVGSVGElement): Gaze {
  const real = window.matchMedia.bind(window);
  const fake: MediaQueryList = {
    matches: true,
    media: FINE_POINTER,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  };
  window.matchMedia = ((query: string) =>
    query === FINE_POINTER ? fake : real(query)) as typeof window.matchMedia;
  try {
    return gaze(svg);
  } finally {
    window.matchMedia = real;
  }
}

// ── Touch: one shared tap listener for every blob on the page ───────────────────────────────
const touchGazes = new Set<Gaze>();
let releaseTimer: number | undefined;

function onTap(e: PointerEvent) {
  // Only real touches/pens; a mouse on a hybrid device is handled by pointer pursuit.
  if (e.pointerType === "mouse") return;
  const point = { x: e.clientX, y: e.clientY };
  for (const g of touchGazes) g.lookAt(point);
  window.clearTimeout(releaseTimer);
  releaseTimer = window.setTimeout(() => {
    for (const g of touchGazes) g.lookAt(null);
  }, TAP_HOLD_MS);
}

function registerTouch(g: Gaze) {
  if (touchGazes.size === 0) window.addEventListener("pointerdown", onTap, { passive: true });
  touchGazes.add(g);
}

function unregisterTouch(g: Gaze) {
  touchGazes.delete(g);
  if (touchGazes.size === 0) {
    window.removeEventListener("pointerdown", onTap);
    window.clearTimeout(releaseTimer);
  }
}

/**
 * Attach eye-following to one blobatar `<svg>`. Returns the teardown. Safe to call during SSR or
 * with a missing element (no-op). Never throws — a face that doesn't move is fine; an avatar that
 * breaks rendering is not.
 */
export function attachBlobGaze(svg: SVGSVGElement | null): () => void {
  if (!svg || !isBrowser()) return () => undefined;
  try {
    const finePointer = window.matchMedia(FINE_POINTER).matches;
    if (finePointer) {
      const g = gaze(svg, { target: "pointer" });
      return () => g.stop();
    }
    const g = gazeForTouch(svg);
    registerTouch(g);
    return () => {
      unregisterTouch(g);
      g.stop();
    };
  } catch {
    return () => undefined;
  }
}
