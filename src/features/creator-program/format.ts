import type { CreatorPeriod } from "./contract";

/**
 * Formatting for the Creator Program page. Every figure the page renders passes
 * through here so the rules the design sets — absolute instants for period
 * boundaries, relative only for "how long ago" — are applied in one place.
 */

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * "12 minutes ago" / "4 Aug". Relative only while it's genuinely recent —
 * past a day, a date is more useful than "17 days ago", and past a week
 * relative time stops being legible at all.
 */
export function formatSyncedAgo(iso: string | null, now: Date = new Date()): string | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;

  const delta = now.getTime() - then.getTime();
  if (delta < 0) return "just now";
  if (delta < MS_PER_MINUTE) return "just now";
  if (delta < MS_PER_HOUR) {
    const minutes = Math.floor(delta / MS_PER_MINUTE);
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  if (delta < MS_PER_DAY) {
    const hours = Math.floor(delta / MS_PER_HOUR);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  return formatDayMonth(iso);
}

/** "4 August, 6:12 PM" in the viewer's own zone — the MetricsUnavailable last-sync line. */
export function formatAbsoluteInstant(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "4 September 2026" — the reapply date on the Rejected frame. */
export function formatFullDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

/** "4 Aug" — timeline rows and older sync stamps. */
export function formatDayMonth(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * The ResetChip. An absolute local instant, never bare relative time: the
 * period boundary is 00:00 UTC, which presents as 5:30 AM in IST, and "resets
 * in 25 days" would hide that a creator's month rolls over mid-morning rather
 * than at midnight. Rendered in the viewer's own zone, with the zone named so
 * the instant is unambiguous.
 */
export function formatResetInstant(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const parts = date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  // Intl renders "1 Sep at 5:30 am GMT+5:30" in some locales; normalise the
  // separator so it matches the design's "1 Sep, 5:30 AM IST".
  return parts.replace(" at ", ", ");
}

/** "18,432" — grouped, never abbreviated. A follower count is read, not skimmed. */
export function formatCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString();
}

/**
 * "4.2%". Null renders as an em dash in --ink-3 — the default at launch, since
 * instagram_business_manage_insights is still in review. The row is never
 * hidden: a missing third stat unbalances the three-up grid.
 */
export function formatEngagement(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate)) return "—";
  return `${rate.toFixed(1)}%`;
}

/**
 * Fraction of the period elapsed, 0–1. Derived client-side from period.start /
 * period.end rather than sent by the server: one source of truth, so the marker
 * can't drift from the fill when the server clock and the render disagree.
 */
export function paceFraction(period: CreatorPeriod | null, now: Date = new Date()): number | null {
  if (!period) return null;
  const start = new Date(period.start).getTime();
  const end = new Date(period.end).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)));
}

/**
 * The "10 ahead of pace" / "91 behind pace" chip. Null when there's no pace to
 * compare against, or when the requirement is already met — past target the
 * meter stays met and stops commenting on pace.
 */
export function paceDelta(
  current: number,
  target: number,
  period: CreatorPeriod | null,
  now: Date = new Date(),
): { direction: "ahead" | "behind"; amount: number } | null {
  const fraction = paceFraction(period, now);
  if (fraction == null || target <= 0) return null;
  if (current >= target) return null;

  const expected = Math.round(target * fraction);
  const delta = current - expected;
  if (delta === 0) return null;
  return delta > 0
    ? { direction: "ahead", amount: delta }
    : { direction: "behind", amount: -delta };
}

/** "August" — the month the current period belongs to, for hero copy. */
export function periodMonthName(period: CreatorPeriod | null): string | null {
  if (!period) return null;
  const start = new Date(period.start);
  if (Number.isNaN(start.getTime())) return null;
  return start.toLocaleDateString(undefined, { month: "long", timeZone: "UTC" });
}
