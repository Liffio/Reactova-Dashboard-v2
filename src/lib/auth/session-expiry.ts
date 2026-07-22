/**
 * Shared logic for the forced-logout flow. Silent refreshes happen without
 * any UI; the only user-visible moment is the toast fired here, once, at the
 * point the session actually ends — no proactive "about to expire" nagging.
 * Lives apart from `http.ts` and `use-auth.ts` to avoid a circular import
 * (http -> session-expiry -> auth-api -> http); http.ts only ever reaches
 * this indirectly via the `liffio:session-expired` window event.
 */
import { toast } from "sonner";
import { authStore } from "@/lib/auth/auth-store";
import { loginPathWithRedirect } from "@/lib/auth/auth-navigation";
import { ApiError } from "@/lib/api/http";
import { logout, refreshAccessToken } from "@/lib/api/auth-api";
import { flushAllAutosaves } from "@/lib/autosave-registry";
import { clearStoredActiveWorkspaceId } from "@/lib/workspace-preference";
import { clearLyraPersisted } from "@/lib/lyra-persist";

export { SESSION_EXPIRED_EVENT } from "@/lib/session-events";

export type SessionEndReason = "idle" | "expired";

let loggingOut = false;

/**
 * Rotates the refresh cookie for a fresh access token.
 * Resolves `"idle"` when the backend itself rejected the rotation as an
 * inactivity timeout (server-side safety net), `false` for any other
 * failure (revoked/expired refresh token), `true` on success.
 */
export async function attemptSilentRefresh(): Promise<boolean | "idle"> {
  try {
    const result = await refreshAccessToken();
    authStore.setSession({
      accessToken: result.accessToken,
      accessTokenExpiresAt: result.accessTokenExpiresAt,
    });
    authStore.setAuthorization(result.authorization);
    return true;
  } catch (err) {
    return err instanceof ApiError && err.code === "SESSION_IDLE_TIMEOUT" ? "idle" : false;
  }
}

/** Flushes any in-progress drafts, clears the session, and redirects to login. */
export async function forceSessionLogout(reason: SessionEndReason = "expired"): Promise<void> {
  if (loggingOut || !authStore.getState().accessToken) {
    return;
  }
  loggingOut = true;

  const userId = authStore.getState().user?.id;
  await flushAllAutosaves();
  clearStoredActiveWorkspaceId(userId);
  clearLyraPersisted(userId);
  authStore.clear();
  void logout().catch(() => undefined);

  toast.error(
    reason === "idle" ? "You were signed out due to inactivity" : "Your session has ended",
    {
      description: "Please log back in to continue — your unsaved work has been saved as a draft.",
      duration: 6000,
    },
  );

  window.setTimeout(() => {
    window.location.replace(
      loginPathWithRedirect(window.location.pathname + window.location.search),
    );
  }, 1200);
}
