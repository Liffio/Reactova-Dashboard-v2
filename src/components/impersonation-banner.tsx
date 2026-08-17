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
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, LogOut, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { TOKEN_STORAGE_KEY, useAuthState } from "@/lib/auth/auth-store";
import { ApiError } from "@/lib/api/http";
import {
  clearImpersonationToken,
  consumeImpersonationHandoff,
  getImpersonationClaims,
  setImpersonationToken,
  type ImpersonationClaims,
} from "@/lib/api/impersonation";
import { endImpersonation } from "@/lib/api/impersonation-api";
import { escalateImpersonation } from "@/lib/api/admin-impersonation-api";
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
function useLiveImpersonationClaims(): {
  claims: ImpersonationClaims | null;
  /** R22: an on-demand re-read, called right after `EscalateDialog` writes a freshly rotated
   *  token into THIS tab's `sessionStorage` (via `setImpersonationToken`) — without this, the
   *  banner would still flip to WRITE within a second via the ticker below, but a manual refresh
   *  makes the mode badge/countdown update in the same paint as the dialog closing, not a beat
   *  later. */
  refresh: () => void;
} {
  const [claims, setClaims] = useState<ImpersonationClaims | null>(null);
  const sessionKey = claims?.isid ?? null;

  const refresh = useCallback(() => {
    setClaims(getImpersonationClaims());
  }, []);

  useEffect(() => {
    // The one-time "first client paint after hydration" read; the [sessionKey] effect below
    // takes over ticking once a session is found.
    consumeImpersonationHandoff();
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!sessionKey) return;
    const id = window.setInterval(refresh, 1000);
    return () => window.clearInterval(id);
  }, [sessionKey, refresh]);

  return { claims, refresh };
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

/**
 * Reads the ADMIN's own access token directly out of shared `localStorage` (R22). Both tabs are
 * the same browser/origin, so this key is visible here even though it was written by the OTHER
 * (admin console) tab — that's precisely how the admin's tab authenticated when it minted this
 * impersonation session in the first place, and Task 19/R20 never touched it: only the
 * impersonation token moved to per-tab `sessionStorage`, this one stayed exactly where it always
 * was. Returns `null` under SSR or when genuinely absent (e.g. the admin signed in from a
 * different browser and only ever shared the `#liffio_imp=` link — a real, if narrow, edge case).
 */
function getAdminSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

/**
 * The REAL escalate-to-write flow (R22 — replaces the old `EscalateHintDialog`, which only told
 * the operator to go do this somewhere else). Runs entirely IN this, the impersonated, tab:
 *
 * 1. Reads the admin's own token straight out of shared `localStorage` (`getAdminSessionToken`).
 * 2. Calls `escalateImpersonation(sessionId, body, { token: adminToken })` — the explicit
 *    `opts.token` override makes `http.ts`'s `resolveRequestToken` use THAT token for this one
 *    call instead of the ambient impersonation token every other request in this tab prefers.
 *    Server-side this is indistinguishable from a normal admin-console request: no `typ:
 *    "impersonation"` claim on it, so `requireAuth` authenticates as the admin,
 *    `requirePlatformAdmin` passes, and `IMPERSONATE_WRITE` + `requireTotpConfirm` verify the
 *    ADMIN's own MFA — exactly §8.5's step-up, running against the right person.
 * 3. On success, writes the rotated token into THIS SAME tab's `sessionStorage` via
 *    `setImpersonationToken` and calls `onEscalated()` (the claims hook's `refresh`) — no new
 *    tab, no teardown: this tab now simply holds the current, live, WRITE-mode token, so there is
 *    no stale token left anywhere to come back `401 IMPERSONATION_SUPERSEDED` on the next request.
 */
function EscalateDialog({
  sessionId,
  open,
  onOpenChange,
  onEscalated,
}: {
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEscalated: () => void;
}) {
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [notEnrolled, setNotEnrolled] = useState(false);
  const adminToken = open ? getAdminSessionToken() : null;

  const reset = () => {
    setReason("");
    setCode("");
    setNotEnrolled(false);
  };

  const mutation = useMutation({
    mutationFn: () => {
      if (!adminToken) {
        throw new Error(
          "Escalation requires your admin session in this browser; escalate is unavailable here.",
        );
      }
      return escalateImpersonation(
        sessionId,
        { reason: reason.trim(), confirmCode: code },
        { token: adminToken },
      );
    },
    onSuccess: (res) => {
      setImpersonationToken(res.token);
      onEscalated();
      onOpenChange(false);
      reset();
      toast.success("Escalated to WRITE.");
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "TOTP_REQUIRED") {
        setNotEnrolled(true);
        return;
      }
      if (err instanceof ApiError && err.code === "TOTP_INVALID") {
        setCode("");
        toast.error("Invalid code — try again.");
        return;
      }
      if (
        err instanceof ApiError &&
        (err.code === "SESSION_NOT_LIVE" ||
          err.code === "SESSION_ALREADY_WRITE" ||
          err.code === "SESSION_NOT_FOUND")
      ) {
        onOpenChange(false);
        reset();
        toast.info(
          err.code === "SESSION_ALREADY_WRITE"
            ? "This session is already WRITE — it'll pick up the change on the next request."
            : "This session is no longer live.",
        );
        return;
      }
      toast.error(err instanceof Error ? err.message : "Failed to escalate.");
    },
  });

  const trimmedReasonLength = reason.trim().length;
  const reasonValid = trimmedReasonLength >= 10 && trimmedReasonLength <= 1000;
  const codeValid = code.length === 6;

  const handleClose = () => {
    if (mutation.isPending) return;
    onOpenChange(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            Escalate to write
          </DialogTitle>
          <DialogDescription>
            Confirm with your own authenticator code to let this session perform write actions.
          </DialogDescription>
        </DialogHeader>

        {!adminToken ? (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
            Escalation requires your admin session in this browser; escalate is unavailable here.
          </div>
        ) : notEnrolled ? (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
            Your admin account has no authenticator app enrolled. Set one up under Settings →
            Security, then retry.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5 text-left">
              <Label htmlFor="banner-escalate-reason">
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="banner-escalate-reason"
                value={reason}
                maxLength={1000}
                placeholder="Why does this session need write access?"
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div className="space-y-2 text-left">
              <Label>Your authenticator code</Label>
              <InputOTP maxLength={6} value={code} onChange={(v) => setCode(v.replace(/\D/g, ""))}>
                <InputOTPGroup>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          {adminToken && !notEnrolled && (
            <Button
              disabled={!reasonValid || !codeValid || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "Escalating…" : "Escalate"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ImpersonationBanner() {
  const { claims, refresh: refreshClaims } = useLiveImpersonationClaims();
  const user = useAuthState((s) => s.user);
  const [escalateOpen, setEscalateOpen] = useState(false);
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
              onClick={() => setEscalateOpen(true)}
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
      <EscalateDialog
        sessionId={claims.isid}
        open={escalateOpen}
        onOpenChange={setEscalateOpen}
        onEscalated={refreshClaims}
      />
    </>
  );
}
