/**
 * Step-up reauth ("Confirm it's you") client state — plan/settings-revamp.md, spec §4.
 *
 * The server answers an account-takeover call without a fresh proof with `403 REAUTH_REQUIRED`.
 * `apiRequest` catches that code globally, asks the registered prompt (the modal mounted by the
 * Settings layout) for a proof, stores the returned token here and retries the original call once.
 * The token is kept in memory only — it is bound server-side to this session and lives 5 minutes,
 * so persisting it would buy nothing and leak a credential into storage.
 */
let token: string | null = null;
let expiresAt = 0;

/** Resolves true when the user confirmed, false when they cancelled. */
type ReauthPrompt = () => Promise<boolean>;
let prompt: ReauthPrompt | null = null;
let pending: Promise<boolean> | null = null;

export const REAUTH_HEADER = "X-Reauth-Token";

export function getReauthToken(): string | null {
  if (!token || Date.now() >= expiresAt) return null;
  return token;
}

export function setReauthToken(value: string, expiresInSec: number): void {
  token = value;
  // A few seconds early, so a call never races the server-side expiry.
  expiresAt = Date.now() + Math.max(0, expiresInSec - 5) * 1000;
}

export function clearReauthToken(): void {
  token = null;
  expiresAt = 0;
}

/** Mounted once by whoever renders the modal. Returns an unregister function. */
export function registerReauthPrompt(fn: ReauthPrompt): () => void {
  prompt = fn;
  return () => {
    if (prompt === fn) prompt = null;
  };
}

/** Opens the modal (deduplicated across concurrent calls). False when no modal is mounted. */
export function requestReauth(): Promise<boolean> {
  if (!prompt) return Promise.resolve(false);
  if (!pending) {
    pending = prompt().finally(() => {
      pending = null;
    });
  }
  return pending;
}
