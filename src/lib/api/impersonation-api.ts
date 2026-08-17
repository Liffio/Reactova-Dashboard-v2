import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

export type EndImpersonationResult = {
  ok: true;
  sessionId: string;
  endedAt: string;
  endedReason: "MANUAL_EXIT";
};

/**
 * Ends the CURRENT impersonation session, authenticated with the impersonation token itself
 * (task-16-report §3.7) — there is no `:sid` to pass because the server ends whatever session
 * `req.impersonation.sessionId` names for that token. `http.ts`'s token-resolution point supplies
 * the impersonation token automatically since this call passes no explicit `token`.
 *
 * Per task-16-report's client note: a 404 here means "already ended" (closed by the sweep, the
 * admin force-ending it, or a previous click racing this one) — callers should treat that the same
 * as success and clear local state either way, not surface it as a failure.
 */
export function endImpersonation() {
  return apiRequest<EndImpersonationResult>(apiUri.impersonation.end, { method: "POST" });
}
