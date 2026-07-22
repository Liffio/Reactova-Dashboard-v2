/**
 * Tracks "is the user actually using the app" so the session watcher can
 * silently refresh active sessions and only log out truly idle ones —
 * never nagging an active user with a "session about to expire" prompt.
 */
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "wheel",
] as const;

let lastActivityAt = Date.now();
let listening = false;

function markActive() {
  lastActivityAt = Date.now();
}

/** Idempotent — safe to call from every mount of the session watcher. */
export function ensureActivityTracking(): void {
  if (listening || typeof window === "undefined") {
    return;
  }
  listening = true;
  for (const event of ACTIVITY_EVENTS) {
    window.addEventListener(event, markActive, { passive: true });
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      markActive();
    }
  });
}

export function isRecentlyActive(withinMs: number): boolean {
  return Date.now() - lastActivityAt <= withinMs;
}
