/**
 * Reacts to `IMPERSONATION_ENDED_EVENT`, fired by http.ts when a request made with the
 * impersonation token comes back 401 with one of requireAuth's impersonation-dead codes
 * (ended/expired/superseded/invalid — task-16-report §4). By the time this fires, http.ts has
 * already cleared `liffio_imp_token`; this hook's job is purely the user-facing side: tell the
 * operator their view of the customer just ended, then send them back to `/admin`.
 *
 * A tiny, single-purpose hook (rather than inlined in the banner) so `ImpersonationBanner` can
 * mount it unconditionally alongside its own claims-driven render — the LISTENER must be live even
 * on a render where `getImpersonationClaims()` returns null (e.g. the event races the banner's own
 * expiry detection and wins), not only while the bar is visible.
 */
import { useEffect } from "react";
import { IMPERSONATION_ENDED_EVENT } from "@/lib/session-events";

export function useImpersonationEndedListener(onEnded: () => void): void {
  useEffect(() => {
    const handler = () => onEnded();
    window.addEventListener(IMPERSONATION_ENDED_EVENT, handler);
    return () => window.removeEventListener(IMPERSONATION_ENDED_EVENT, handler);
  }, [onEnded]);
}
