import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

/**
 * Workspace-user-facing plugin client (distinct from `plugins-admin-api.ts`,
 * which is the superadmin lifecycle console).
 *
 * Key convention: the SPA route param is the plugin's SHORT key (the manifest
 * `parentModule.route` is `/plugins/user-audit` for manifest key
 * `plugin.user-audit`), but every API path takes the FULL manifest key.
 * Callers derive the full key as `plugin.` + short key before calling here.
 */

export type PluginTokenResponse = {
  /** Short-lived (~5m) iframe token, `typ: "plugin"` — never a session token. */
  token: string;
  /** ISO timestamp; the host re-fetches on the frame's `requestToken` message. */
  expiresAt: string;
};

/**
 * Issue a short-lived token for the plugin's iframe UI. Session-authenticated
 * (bearer + `x-workspace-id`); the server grants it only if the resolver gives
 * this session the plugin's `required_permission` — a 403 with code
 * `PLUGIN_NOT_INCLUDED` means the workspace/user is not entitled.
 */
export function getPluginToken(fullKey: string): Promise<PluginTokenResponse> {
  return apiRequest<PluginTokenResponse>(apiUri.plugins.token(fullKey), { method: "POST" });
}
