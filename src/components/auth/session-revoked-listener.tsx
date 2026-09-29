import { useEffect } from "react";

import { getSocket, type SessionRevokedReason } from "@/lib/socket";
import { useAuthState } from "@/lib/auth/auth-store";
import { forceSessionLogout } from "@/lib/auth/session-expiry";

/** What this device tells its user when its session was ended from somewhere else. */
const REASON_COPY: Record<SessionRevokedReason, string> = {
  signed_out: "You signed out in another tab",
  signed_out_elsewhere: "You were signed out from another device",
  password_changed: "Your password was changed, so this device was signed out",
  email_changed: "Your email was changed, so this device was signed out",
  admin: "An administrator ended your session",
  account_deleted: "Your account is scheduled for deletion",
};

/**
 * Headless listener for `session:revoked` (plan/realtime-session-revocation.md).
 *
 * The server puts every socket in `session:<sid>` for the device session it authenticated as, and
 * emits there when that session is ended elsewhere — "Sign out all other devices", a password or
 * email change, an admin revoke. This logs the device out on the spot instead of waiting for its
 * next API call to 401. Mounted once in the authenticated shell next to the other socket listeners.
 */
export function SessionRevokedListener() {
  const token = useAuthState((s) => s.accessToken);

  useEffect(() => {
    if (!token) return;
    const socket = getSocket();
    if (!socket) return;

    const onRevoked = (payload: { reason?: SessionRevokedReason } | undefined) => {
      const message =
        (payload?.reason && REASON_COPY[payload.reason]) || REASON_COPY.signed_out_elsewhere;
      void forceSessionLogout("revoked", message);
    };

    socket.on("session:revoked", onRevoked);
    return () => {
      socket.off("session:revoked", onRevoked);
    };
  }, [token]);

  return null;
}
