export function formatNum(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatMoneyCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
}

export function formatMoney(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
}

/**
 * Instagram handles, rendered with exactly one `@`.
 *
 * ## Why this exists
 *
 * The stored form is not consistent, and cannot be relied on to be:
 * `platform_accounts.platform_username` and `leads.ig_username` are written *with* the sigil,
 * `creator_metrics_latest.instagram_username` *without* it, and Meta's Graph payloads carry the
 * bare name. Around twenty render sites each decided independently whether to prepend one — most
 * did, a few called `.replace(/^@/, "")` first — so a workspace whose handle was stored with the
 * sigil rendered as `@@xsquare337` in the topbar and correctly two components away.
 *
 * Prepending at the call site is the bug. The sigil is presentation, the column is data, and
 * whether a given row happens to carry one is not something a component should have to know.
 *
 * Returns `null` for an absent or empty handle so callers keep their own fallback ("—", the
 * workspace name, "Instagram account") instead of rendering a bare `@`.
 */
export function formatHandle(value: string | null | undefined): string | null {
  const bare = bareHandle(value);
  return bare && `@${bare}`;
}

/**
 * The handle with no sigil — for Instagram URLs, API arguments, and comparisons against a
 * workspace name, none of which want one. Same normalisation as {@link formatHandle}, so the two
 * can never disagree about what the handle is.
 */
export function bareHandle(value: string | null | undefined): string | null {
  const bare = (value ?? "").trim().replace(/^@+/, "").trim();
  return bare || null;
}
