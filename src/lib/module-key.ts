/**
 * Derives a registry key from a human name.
 *
 * `"Content Studio"` → `content_studio`, `"Bulk export (beta)"` → `bulk_export_beta`.
 *
 * The key is what code imports and what every grant, mapping and package row references, so it is
 * immutable once created. Deriving it removes the most common way to get one wrong — typing it by
 * hand a second time, slightly differently — while leaving it overridable at creation for the
 * cases where the obvious slug is not the right identifier.
 */
export function deriveKey(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      // Strip accents so "Rôles" becomes "roles" rather than losing the character entirely.
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      // A key must start with a letter; a name beginning with a digit would otherwise be rejected
      // by the server with a message about a rule the operator never saw.
      .replace(/^(\d)/, "m_$1")
      .slice(0, 60)
  );
}

/** Mirrors the server's `KEY_PATTERN`, so the form rejects what the API would reject. */
export const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

export const isValidKey = (key: string): boolean => KEY_PATTERN.test(key);
