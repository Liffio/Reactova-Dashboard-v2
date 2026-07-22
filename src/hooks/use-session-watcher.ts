/**
 * Mounted once (in the authenticated app layout). Never nags an active user —
 * shortly before the access token expires it checks recent activity:
 *  - active in the last few minutes → silently rotates the refresh cookie,
 *    no UI at all,
 *  - idle → lets the session lapse and logs out with a single
 *    "signed out due to inactivity" toast (after flushing any in-progress
 *    drafts).
 * Also reacts to `SESSION_EXPIRED_EVENT`, fired by http.ts when a request
 * comes back 401 TOKEN_EXPIRED (e.g. a tab left open for days) — that always
 * gets one silent-refresh attempt first, since it's the token being stale,
 * not necessarily the user being idle.
 */
import { useEffect } from "react";
import { useAuthState } from "@/lib/auth/auth-store";
import {
  attemptSilentRefresh,
  forceSessionLogout,
  SESSION_EXPIRED_EVENT,
} from "@/lib/auth/session-expiry";
import { ensureActivityTracking, isRecentlyActive } from "@/lib/activity-tracker";

/** How long before actual expiry we check in and (maybe) refresh. */
const REFRESH_LEAD_MS = 60 * 1000;
/** Interaction within this window counts as "actively using the app". */
const ACTIVITY_WINDOW_MS = 5 * 60 * 1000;

export function useSessionWatcher() {
  const accessToken = useAuthState((s) => s.accessToken);
  const expiresAt = useAuthState((s) => s.accessTokenExpiresAt);

  useEffect(() => {
    ensureActivityTracking();
  }, []);

  // Sessions established before expiry-tracking shipped have no expiresAt —
  // learn it once via a background refresh so they get watched too.
  useEffect(() => {
    if (accessToken && !expiresAt) {
      void attemptSilentRefresh();
    }
  }, [accessToken, expiresAt]);

  useEffect(() => {
    if (!accessToken || !expiresAt) {
      return;
    }

    const runCheck = async () => {
      if (isRecentlyActive(ACTIVITY_WINDOW_MS)) {
        const result = await attemptSilentRefresh();
        if (result === false) void forceSessionLogout("expired");
        if (result === "idle") void forceSessionLogout("idle");
      } else {
        void forceSessionLogout("idle");
      }
    };

    const msUntilExpiry = expiresAt - Date.now();
    if (msUntilExpiry <= 0) {
      void runCheck();
      return;
    }

    const timer = window.setTimeout(
      () => void runCheck(),
      Math.max(msUntilExpiry - REFRESH_LEAD_MS, 0),
    );
    return () => window.clearTimeout(timer);
  }, [accessToken, expiresAt]);

  useEffect(() => {
    const onSessionExpired = () => {
      void attemptSilentRefresh().then((result) => {
        if (result === false) void forceSessionLogout("expired");
        if (result === "idle") void forceSessionLogout("idle");
      });
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
  }, []);
}
