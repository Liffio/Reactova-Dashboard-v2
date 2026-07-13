/**
 * Thin, safe wrapper around window.umami. The script loads `defer` from a
 * third-party origin, so `window.umami` may not exist yet when the app first
 * knows the user — safeIdentify retries for ~5s instead of silently dropping
 * the call (this bit us on the marketing site before the retry was added).
 */

declare global {
  interface Window {
    umami?: {
      identify: (uniqueId: string, data?: Record<string, unknown>) => void;
      track: (eventName: string, data?: Record<string, unknown>) => void;
    };
  }
}

let identifiedUserId: string | null = null;

export function safeIdentify(userId: string, attemptsLeft = 50): void {
  if (typeof window === "undefined" || !userId) {
    return;
  }
  if (identifiedUserId === userId) {
    return;
  }

  if (window.umami?.identify) {
    try {
      window.umami.identify(userId);
      identifiedUserId = userId;
    } catch {
      // Analytics must never block or throw for a real user action.
    }
    return;
  }

  if (attemptsLeft <= 0) {
    return;
  }
  setTimeout(() => safeIdentify(userId, attemptsLeft - 1), 100);
}
