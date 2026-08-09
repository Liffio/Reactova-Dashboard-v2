import { formatFullDate } from "./format";
import type { CheckKey, PrimaryReason } from "./contract";

/**
 * Every creator-facing string on the page, in one place.
 *
 * Two rules the design fixes and this file enforces:
 *  - A reason code is never shown raw. `ScoreBelowThreshold` becomes "Not a fit
 *    right now"; the creator sees a sentence, not an enum member.
 *  - Nothing hints at application strength. No score, no percentage, no
 *    "you're close" — the eligibility checklist reports progress (11 / 15) and
 *    stops there.
 */

/**
 * The four rendered checks, in the contract's fixed render order.
 *
 * There is no `PublicAccount` row: Instagram doesn't allow a Business or
 * Creator account to be private, so it can't fail independently of
 * ProfessionalAccount. The server still evaluates it — it just isn't a row the
 * creator is asked to read.
 */
export const CHECK_LABEL: Record<CheckKey, string> = {
  InstagramConnected: "Instagram connected",
  ProfessionalAccount: "Business or Creator account",
  MinPosts: "At least {required} posts",
  RecentPost: "Posted in the last {required} days",
};

export function checkLabel(key: CheckKey, required: number | null): string {
  const template = CHECK_LABEL[key];
  return required == null ? template : template.replace("{required}", String(required));
}

/**
 * The trailing figure on a check row. Only MinPosts and RecentPost carry one,
 * and only in the form the design specifies: a bare ratio while failing, the
 * plain value once passed. Never a percentage, never a verdict.
 */
export function checkValue(
  key: CheckKey,
  passed: boolean,
  current: number | null,
  required: number | null,
): string | null {
  if (current == null) return null;
  if (key === "MinPosts") return passed ? String(current) : `${current} / ${required}`;
  if (key === "RecentPost") {
    if (!passed) return null;
    if (current === 0) return "today";
    return `${current} day${current === 1 ? "" : "s"} ago`;
  }
  return null;
}

/** The NotEligible frame: one blocker named, in the creator's language. */
export function notEligibleCopy(
  reason: PrimaryReason | null,
  opts: { minPosts: number; maxDays: number; postCount: number | null },
): { heading: string; body: string } {
  switch (reason) {
    case "InstagramNotConnected":
      return {
        heading: "Connect Instagram to get started",
        body: "The programme runs on your connected Instagram account — we check the requirements against it, and your automations send from it.",
      };
    case "PrivateAccount":
      return {
        heading: "Your account is private",
        body: "Automations can't reach people who comment on a private account. Switching to public in Instagram's settings is all that's needed.",
      };
    case "PersonalAccount":
      return {
        heading: "Switch to a Business or Creator account",
        body: "Personal accounts don't expose the tools automations need. The switch is free and takes a moment in Instagram's settings.",
      };
    case "InsufficientContent":
      return {
        heading: "A few more posts to go",
        body:
          opts.postCount == null
            ? `The programme is built for accounts with an established feed. You'll need at least ${opts.minPosts} posts.`
            : `The programme is built for accounts with an established feed. You'll need at least ${opts.minPosts} posts — you have ${opts.postCount}.`,
      };
    case "InactiveAccount":
      return {
        heading: "Post something recent",
        body: `The programme is for accounts that are actively posting. We look for at least one post in the last ${opts.maxDays} days.`,
      };
    default:
      return {
        heading: "Not eligible yet",
        body: "Your account doesn't meet the requirements for the programme just yet. We recheck automatically each day.",
      };
  }
}

/**
 * Priority-1 takeover copy. Every number on the page would be stale, so the
 * card names the break and offers at most one action.
 *
 * MetricsUnavailable is the one case with no action — there is genuinely
 * nothing for the creator to press, so `action` is null and the frame must not
 * invent a retry button.
 */
export function takeoverCopy(
  reason: PrimaryReason | null,
  opts: { brokeOn: string | null },
): { heading: string; body: string; action: string | null; reassurance: string | null } {
  const since = opts.brokeOn ? ` on ${opts.brokeOn}` : "";
  switch (reason) {
    case "InstagramDisconnected":
      return {
        heading: "Reconnect Instagram to keep your automations running",
        body: `Your Instagram connection dropped${since}, so your automations have stopped and this month's numbers have paused. Reconnecting picks up exactly where you left off.`,
        action: "Reconnect Instagram",
        reassurance: "Your membership is safe while you sort this out.",
      };
    case "PrivateAccount":
      return {
        heading: "Your account has been set to private",
        body: "Automations can't reach people who comment on a private account, so they've stopped and this month's numbers have paused. Switching back to public resumes everything.",
        action: "Open Instagram settings",
        reassurance: "Your membership is safe while you sort this out.",
      };
    case "PersonalAccount":
      return {
        heading: "Your account switched to Personal",
        body: "Personal accounts don't expose the tools your automations need, so they've stopped and this month's numbers have paused. Switching back to Business or Creator resumes everything.",
        action: "Open Instagram settings",
        reassurance: "Your membership is safe while you sort this out.",
      };
    case "MetricsUnavailable":
      return {
        heading: "We can't reach Instagram right now",
        body: "This one's on our side, not yours. We're having trouble pulling data from Instagram, so your numbers are frozen at their last known values. Your automations are still running and your standing is safe.",
        action: null,
        reassurance: null,
      };
    default:
      return {
        heading: "Something needs your attention",
        body: "We've paused this month's tracking while we sort out a problem with your account connection.",
        action: null,
        reassurance: "Your membership is safe while you sort this out.",
      };
  }
}

/**
 * The priority-2 banner. Numbers below are real and stay on the page, so this
 * says what's short and offers the quickest lift — it never repeats the meter.
 */
export function bannerCopy(
  reason: PrimaryReason | null,
  opts: { remaining: number; current: number; target: number; daysLeft: number },
): { heading: string; body: string; action: string | null } | null {
  switch (reason) {
    case "DmShortfall":
      return {
        heading: `${opts.remaining} more DM${opts.remaining === 1 ? "" : "s"} this month`,
        body: `You're at ${opts.current} of ${opts.target} with ${opts.daysLeft} day${opts.daysLeft === 1 ? "" : "s"} to go. Broadening a keyword or adding an automation to a recent post is usually the quickest lift.`,
        action: "Review automations",
      };
    case "InsufficientActiveAutomations":
      return {
        heading: "Your automations have dropped below the minimum",
        body: `The programme asks for ${opts.target} running at the same time. Paused and draft automations don't count towards this.`,
        action: "Review automations",
      };
    default:
      return null;
  }
}

/** The collapsed <details> summary — the only place secondaryReasons may render. */
export function secondaryDisclosureCopy(reason: PrimaryReason): string {
  switch (reason) {
    case "DmShortfall":
      return "Your automated DM count for this month is behind. It'll resume counting as soon as the connection is back.";
    case "InsufficientActiveAutomations":
      return "You're below the minimum number of active automations. Paused and draft automations don't count towards this.";
    case "PrivateAccount":
      return "Your account is currently set to private.";
    case "PersonalAccount":
      return "Your account is currently a Personal account rather than Business or Creator.";
    case "InstagramDisconnected":
    case "InstagramNotConnected":
      return "Your Instagram connection has dropped.";
    case "MetricsUnavailable":
      return "We're having trouble pulling data from Instagram.";
    case "InsufficientContent":
      return "Your account is below the minimum post count.";
    case "InactiveAccount":
      return "Your account hasn't posted recently.";
    default:
      return "There's one more thing to check on your account.";
  }
}

/** Timeline rows. Allowlisted types only — anything else never reaches the client. */
export const TIMELINE_LABEL = {
  Joined: "Joined the programme",
  RequirementsMet: "Requirements met",
  HealthRestored: "Health restored",
  InstagramSynced: "Instagram synced",
  Paused: "Membership paused",
  Reactivated: "Membership reactivated",
} as const;

/**
 * The inline notice inside the confirm modal when POST /apply comes back
 * blocked_by_cooldown — only reachable if a cooldown started in another tab.
 * A date, never a countdown.
 */
export function cooldownMessage(reapplyAt: string | null): string | null {
  const date = formatFullDate(reapplyAt);
  if (!date) return null;
  return `You're still in your cooldown period — you can apply again from ${date}.`;
}

export const BENEFITS = [
  "Unlimited automations",
  "Full analytics",
  "Priority support",
  "Business plan features",
] as const;
