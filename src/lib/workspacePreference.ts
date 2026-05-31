const LEGACY_KEY = "liffio_active_workspace_id";

const scopedKey = (userId: string) => `liffio_active_workspace_${userId}`;

export function readStoredActiveWorkspaceId(userId?: string | null): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  if (userId) {
    const scoped = localStorage.getItem(scopedKey(userId))?.trim();
    if (scoped) {
      return scoped;
    }
  }
  const legacy = localStorage.getItem(LEGACY_KEY)?.trim();
  return legacy || null;
}

export function persistActiveWorkspaceId(workspaceId: string, userId?: string | null): void {
  if (typeof window === "undefined" || !workspaceId.trim()) {
    return;
  }
  const id = workspaceId.trim();
  localStorage.setItem(LEGACY_KEY, id);
  if (userId) {
    localStorage.setItem(scopedKey(userId), id);
  }
}

export function clearStoredActiveWorkspaceId(userId?: string | null): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(LEGACY_KEY);
  if (userId) {
    localStorage.removeItem(scopedKey(userId));
  }
}
