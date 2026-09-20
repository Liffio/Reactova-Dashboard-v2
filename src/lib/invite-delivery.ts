/**
 * R3b. The words an owner reads when an invite email does not go out.
 *
 * ## Why this is one module and not a sentence at each call site
 *
 * Three places report the same event: the invite page right after inviting, the Team page's list of
 * pending invites, and the result of pressing Resend in either. If each wrote its own line they
 * would drift, and the one that drifts is always the one nobody looked at recently.
 *
 * ## The rule these sentences follow
 *
 * **The owner is told what happened to them, never what the provider said to us.** Brevo's own
 * words are "unrecognised IP address", which is true, unactionable, and frightening. It names our
 * infrastructure to a customer who cannot do anything about it and did nothing to cause it.
 *
 * For a blocked provider the sentence is the one R3b specifies: the email could not be sent, and
 * support has been notified. That second half is a promise, and the backend keeps it — a
 * `provider_blocked` classification reports to Sentry before the response is written
 * (`Backend/src/services/inviteDelivery.ts`). If that ever stops, this sentence has to change with
 * it.
 */

/** The classification the API answers with. Mirrors `InviteDeliveryIssue` on the backend. */
export type InviteDeliveryIssue = "provider_blocked" | "recipient_opted_out" | "send_failed";

export type InviteDeliveryMessage = {
  /** One line, for a toast or a badge's tooltip. */
  headline: string;
  /** What the owner can do about it. Empty when there is genuinely nothing. */
  detail: string;
  /** Whether offering Resend is honest. */
  canRetry: boolean;
};

const MESSAGES: Record<InviteDeliveryIssue, InviteDeliveryMessage> = {
  /**
   * 🔴 The Brevo IP allowlist, in the owner's words.
   *
   * No "provider", no "401", no "IP". Something on our side stopped the email; we know; somebody is
   * on it. Resend is still offered, because the allowlist is often fixed within the hour and the
   * owner should not have to recreate the invite to try again. `canRetry` says "this button is not
   * a lie", not "this will work".
   */
  provider_blocked: {
    headline: "The invite was created, but the email could not be sent.",
    detail:
      "This is a problem on our side, not with the address you entered. Support has been notified. " +
      "The invite is saved, so you can send it again in a little while.",
    canRetry: true,
  },
  recipient_opted_out: {
    headline: "The invite was created, but this person has turned these emails off.",
    detail:
      "Nothing is broken. They will not get an email however many times it is sent, so pass them " +
      "the invite another way, or ask them to turn invite emails back on.",
    canRetry: false,
  },
  send_failed: {
    headline: "The invite was created, but the email did not go through.",
    detail: "It may have been a temporary problem. The invite is saved, so you can send it again.",
    canRetry: true,
  },
};

export function inviteDeliveryMessage(
  issue: InviteDeliveryIssue | null | undefined,
): InviteDeliveryMessage {
  /**
   * An unknown or missing code falls back to the retryable wording rather than to silence.
   *
   * An older server, or a failure nobody has classified yet, still means an owner is standing in
   * front of an invite that went nowhere. Saying "it did not go through, try again" is right often
   * enough and wrong harmlessly; saying nothing leaves them believing it was sent.
   */
  if (!issue || !(issue in MESSAGES)) return MESSAGES.send_failed;
  return MESSAGES[issue];
}

/** What the Team page's badge says, which has to fit in a table cell. */
export function inviteDeliveryBadge(issue: InviteDeliveryIssue | null | undefined): string {
  if (issue === "recipient_opted_out") return "emails off";
  return "email not sent";
}
