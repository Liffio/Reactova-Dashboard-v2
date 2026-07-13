/**
 * User+workspace-scoped localStorage persistence for Lyra AI state (results,
 * in-progress drafts, UI toggles), so they survive a page refresh or a
 * relogin on the same browser. Follows the scoping convention used by
 * workspace-preference.ts (`liffio_..._${userId}`), and is cleared alongside
 * it on logout so one account's cached AI content never leaks to the next.
 */
const PREFIX = "liffio_lyra_";

const isBrowser = typeof window !== "undefined";

export function lyraStorageKey(
  userId: string | null | undefined,
  workspaceId: string | null | undefined,
  scope: string
): string {
  return `${PREFIX}${userId || "anon"}_${workspaceId || "default"}_${scope}`;
}

export function readLyraPersisted<T>(key: string): T | null {
  if (!isBrowser) return null;
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeLyraPersisted<T>(key: string, value: T): void {
  if (!isBrowser) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota exceeded / private mode — persistence is best-effort
  }
}

export function clearLyraPersistedKey(key: string): void {
  if (!isBrowser) return;
  localStorage.removeItem(key);
}

/** Removes every persisted Lyra entry for a user, e.g. on logout. */
export function clearLyraPersisted(userId?: string | null): void {
  if (!isBrowser) return;
  const prefix = `${PREFIX}${userId || "anon"}_`;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) localStorage.removeItem(key);
  }
}
