/**
 * The impersonation banner — spec §5.7. Rendered purely FROM THE TOKEN'S CLAIMS (never from a
 * flag someone could flip), so it is structurally impossible to be in an impersonation session
 * without it showing: as long as `liffio_imp_token` holds a live token, this renders.
 *
 * "The only visual change in the client app" per §5.7 — no admin controls, no altered nav. The
 * one deliberate exception is the small CSS-variable handshake with `_app.tsx`'s TopBar (see the
 * comment on `BANNER_HEIGHT_VAR` below): it exists solely so the bar doesn't hide the customer's
 * own top nav, which §5.7 explicitly calls out as the failure mode to avoid.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, LogOut, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useAuthState } from "@/lib/auth/auth-store";
import {
  clearImpersonationToken,
  consumeImpersonationHandoff,
  getImpersonationClaims,
  type ImpersonationClaims,
} from "@/lib/api/impersonation";
import { endImpersonation } from "@/lib/api/impersonation-api";
import { useImpersonationEndedListener } from "@/hooks/use-impersonation-ended";

/**
 * Where the operator lands once this tab falls back to the admin's own (untouched) session —
 * i.e. after exit/expiry clears the imp token. Bare `/admin` is not a route in this app (no index
 * route there); `/admin/users` is an extant one and the natural landing page for "I was just
 * looking at a specific user's account."
 */
const ADMIN_LANDING_PATH = "/admin/users";

/**
 * Fixed bar height, and the name of the CSS variable `_app.tsx`'s sticky TopBar offsets by (and
 * `__root.tsx`'s `<body>` pads by) so it never renders underneath this bar. Kept as one constant
 * so the three spots — this component, `_app.tsx`, `__root.tsx` — cannot drift apart.
 */
const BANNER_HEIGHT_PX = 40;
export const IMPERSONATION_BANNER_HEIGHT_VAR = "--liffio-imp-banner-h";

/** Bar pulses once the session has this little time left (§5.7: "at 2 minutes remaining"). */
const PULSE_THRESHOLD_MS = 2 * 60 * 1000;

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Ticks once a second while a session is active. A single `setInterval`, keyed on the session's
 * `isid` rather than the claims object itself — `getImpersonationClaims()` returns a freshly
 * decoded object every call, so keying on the object would tear down and recreate the interval
 * every tick. Keying on `isid` means the interval is created exactly once per session and its
 * cleanup runs exactly once, on the render where the session ends (isid goes from a string to
 * null) OR the component unmounts — the two conditions spec §0.4 calls out by name.
 *
 * State starts `null` rather than lazily reading storage in `useState`'s initializer, and the
 * real read happens in an effect instead. This app is SSR'd (TanStack Start): the server always
 * renders signed-out/no-session (no `window`), so the client's FIRST render must also produce
 * `null` to hydrate cleanly — effects run only after that first render commits, client-side only —
 * the same SSR-safety shape `auth-store.ts`/`guards.tsx`'s mount-gate use for anything read from
 * storage. Reload-safety (spec §5) still holds: `sessionStorage` survives a reload of the SAME tab
 * (only clearing when the tab/window closes — a bonus: that doubles as a natural, if informal,
 * exit), and this effect fires on every mount including a full reload, so the real claims appear
 * one paint after hydration.
 *
 * `consumeImpersonationHandoff()` runs first, every mount: it's a no-op unless the URL fragment
 * Task 18 hands the token off through (`#liffio_imp=<token>`) is actually present, so it's safe to
 * call unconditionally rather than needing its own separate "is this the handoff navigation" gate.
 *
 * NOTE (R20): there is deliberately no cross-tab `storage`-event listener here. `sessionStorage` is
 * scoped per tab — a write in one tab never fires a `storage` event in another, because there is no
 * "another" sharing that storage object to fire it in. Nothing in this design relies on cross-tab
 * imp-token sync; each tab's session is self-contained. `IMPERSONATION_ENDED_EVENT` (same-tab, from
 * `http.ts`'s 401 handling) is the mechanism that matters for "the session died out from under
 * this tab," and it's unaffected by the storage-backend change (see `onImpersonationEnded` below).
 */
function useLiveImpersonationClaims(): ImpersonationClaims | null {
  const [claims, setClaims] = useState<ImpersonationClaims | null>(null);
  const sessionKey = claims?.isid ?? null;

  useEffect(() => {
    // The one-time "first client paint after hydration" read; the [sessionKey] effect below
    // takes over ticking once a session is found.
    consumeImpersonationHandoff();
    setClaims(getImpersonationClaims());
  }, []);

  useEffect(() => {
    if (!sessionKey) return;
    const id = window.setInterval(() => {
      setClaims(getImpersonationClaims());
    }, 1000);
    return () => window.clearInterval(id);
  }, [sessionKey]);

  return claims;
}

/**
 * Common end-of-session recovery: clear the token, toast, and hard-reload to an extant admin
 * route.
 *
 * A full reload (`window.location.href`), not a router navigation, is deliberate: this tab's
 * entire in-memory state — auth store, React Query cache, app-context's workspace list — was
 * populated AS THE TARGET via the imp token (that's the whole point of the token-resolution
 * change in http.ts). Once `clearImpersonationToken()` removes THIS tab's `sessionStorage` entry,
 * `http.ts`'s token-resolution point falls through to the admin's own session token — still sitting
 * untouched in this same tab's `localStorage` the whole time (the two-tab model, task-16-report
 * §5) — so a full reload is what re-bootstraps this tab AS THE ADMIN rather than leaving stale,
 * target-scoped React state around. `ADMIN_LANDING_PATH` (`/admin/users`), not bare `/admin` (not
 * a route — R20 fix), is where that reload lands; its own guard sends this browser to `/login`
 * instead if it turns out to have no admin session either (e.g. a shared machine).
 */
function endImpersonationAndRedirect(message: string): void {
  clearImpersonationToken();
  toast.info(message);
  window.location.href = ADMIN_LANDING_PATH;
}

function EscalateHintDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            Escalate from your admin tab
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Escalating to WRITE requires your own TOTP code and can only be authorized from your admin
          console session — not from inside the customer&apos;s own session, which is all this tab
          is. Switch back to the admin tab you started this impersonation from and use
          &quot;Escalate to write&quot; there. This tab will pick up WRITE access automatically on
          its next request once you do.
        </p>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ImpersonationBanner() {
  const claims = useLiveImpersonationClaims();
  const user = useAuthState((s) => s.user);
  const [escalateHintOpen, setEscalateHintOpen] = useState(false);
  const [exiting, setExiting] = useState(false);
  const hasEndedRef = useRef(false);
  const prevSessionKeyRef = useRef<string | null>(null);

  // Client-clock expiry (§5.7: "on expiry, redirect to /admin with a toast") — independent of any
  // server round trip, since an idle tab may not send a single request between "still valid" and
  // "expired". Fires exactly once per session, on the transition from a live session to none.
  useEffect(() => {
    const sessionKey = claims?.isid ?? null;
    if (!sessionKey && prevSessionKeyRef.current && !hasEndedRef.current) {
      hasEndedRef.current = true;
      endImpersonationAndRedirect("Impersonation session expired");
    }
    prevSessionKeyRef.current = sessionKey;
  }, [claims]);

  // Server-detected end/expiry/revoke/supersede (http.ts dispatches this on the matching 401s —
  // catches cases the client clock alone can't, e.g. a force-revoke from the admin console).
  const onImpersonationEnded = useCallback(() => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;
    endImpersonationAndRedirect("Impersonation session ended");
  }, []);
  useImpersonationEndedListener(onImpersonationEnded);

  // Reserve layout space for the bar (`_app.tsx`'s TopBar + `__root.tsx`'s <body> both read this
  // var) only while it is actually rendered, and release it the instant it isn't — otherwise a
  // stale offset would leave a permanent gap after the session ends.
  useEffect(() => {
    if (!claims) return;
    document.documentElement.style.setProperty(
      IMPERSONATION_BANNER_HEIGHT_VAR,
      `${BANNER_HEIGHT_PX}px`,
    );
    return () => {
      document.documentElement.style.removeProperty(IMPERSONATION_BANNER_HEIGHT_VAR);
    };
  }, [Boolean(claims)]); // eslint-disable-line react-hooks/exhaustive-deps -- presence transition only; claims itself changes every tick

  if (!claims) {
    return null;
  }

  const remainingMs = claims.exp * 1000 - Date.now();
  const pulsing = remainingMs <= PULSE_THRESHOLD_MS;
  const isWrite = claims.mode === "WRITE";
  const name = user?.name?.trim() || claims.email;
  const email = user?.email?.trim() || claims.email;

  const handleExit = async () => {
    if (exiting) return;
    setExiting(true);
    try {
      await endImpersonation();
    } catch {
      // Best-effort per task-16-report's client note: a 404 means "already ended", and any other
      // failure still means the operator's intent is to leave — exit locally either way rather
      // than trap them behind a broken call. The session, worst case, lingers server-side until
      // its hard 30-minute TTL; it never lingers in the UI.
    } finally {
      hasEndedRef.current = true;
      clearImpersonationToken();
      toast.success("Exited impersonation");
      window.location.href = ADMIN_LANDING_PATH;
    }
  };

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        style={{ height: BANNER_HEIGHT_PX }}
        className={cn(
          "fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-3 border-b px-3 text-sm font-medium shadow-md",
          isWrite
            ? "border-destructive/40 bg-destructive text-destructive-foreground"
            : "border-warning/40 bg-warning text-warning-foreground",
          pulsing && "animate-pulse",
        )}
      >
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">
          Impersonating {name} ({email}) · {isWrite ? "WRITE" : "VIEW ONLY"} ·{" "}
          {formatRemaining(remainingMs)} remaining
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          {!isWrite && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 border-current bg-transparent text-inherit hover:bg-black/10"
              onClick={() => setEscalateHintOpen(true)}
            >
              Escalate to write
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 border-current bg-transparent text-inherit hover:bg-black/10"
            disabled={exiting}
            onClick={() => void handleExit()}
          >
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
            Exit
          </Button>
        </div>
      </div>
      <EscalateHintDialog open={escalateHintOpen} onOpenChange={setEscalateHintOpen} />
    </>
  );
}
