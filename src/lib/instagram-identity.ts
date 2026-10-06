import { bareHandle } from "@/lib/format";

/**
 * Who an Instagram person is, for display, when we may not know their username.
 *
 * Instagram's messaging webhook carries only a numeric, app-scoped id; the username, name and
 * picture come from a separate profile lookup that Instagram can refuse (the person has not
 * messaged the business yet). Where a username column cannot be empty, the backend stores the id,
 * or on the comment lane `@` + its first 8 characters, in its place. Neither is a handle and neither
 * may be shown as one: to a user "@17841402…" reads as a bug.
 */

/** The real username, without the `@`, or null when there is none (or only the id standing in). */
export function realHandle(
  username: string | null | undefined,
  igUserId?: string | null,
): string | null {
  const bare = bareHandle(username);
  if (!bare) return null;
  const id = (igUserId ?? "").trim();
  if (id && (bare === id || bare === id.slice(0, 8))) return null;
  return bare;
}

/** How the profile lookup went, as the contacts API reports it. */
export type ProfileStatus = "queued" | "ok" | "no_consent" | "failed" | null | undefined;

export interface InstagramIdentity {
  /** The main line: the name, else `@username`, else "Instagram user". Never the id. */
  primary: string;
  /** `@username` when the main line is the name; otherwise null. */
  secondary: string | null;
  /** One letter for the avatar, or null when nothing is known (show a person icon instead). */
  initial: string | null;
  /** Instagram declined to share the profile, so "Instagram user" is final, not a loading state. */
  withheld: boolean;
}

export const UNKNOWN_PERSON = "Instagram user";
export const WITHHELD_HINT = "Instagram didn't share this person's profile.";
/**
 * Why `isFollowing` is null rather than true/false: Instagram only shares it once the person has
 * messaged the account, tapped an ice breaker, or tapped a persistent menu button — a commenter
 * who has done none of those cannot be looked up. Not a loading failure.
 */
export const FOLLOW_UNKNOWN_HINT =
  "Instagram only shares this once the person messages the account.";

export function instagramIdentity(p: {
  igUserId?: string | null;
  igUsername?: string | null;
  displayName?: string | null;
  profileStatus?: ProfileStatus;
}): InstagramIdentity {
  const username = realHandle(p.igUsername, p.igUserId);
  const name = p.displayName?.trim() || null;
  const primary = name ?? (username ? `@${username}` : UNKNOWN_PERSON);
  return {
    primary,
    secondary: name && username ? `@${username}` : null,
    initial: (name ?? username)?.charAt(0).toUpperCase() || null,
    withheld:
      !name && !username && (p.profileStatus === "no_consent" || p.profileStatus === "failed"),
  };
}
