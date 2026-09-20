/**
 * R3b. The owner is told what happened to them, never what the provider said to us.
 *
 * ## Two things are pinned here
 *
 * 1. **The words.** Specifically that the blocked-provider case says the email could not be sent
 *    and that support has been notified, which is what R3b asks for by name.
 * 2. **The absence of words.** No sentence anywhere in this module may contain the provider's
 *    vocabulary. That check is the one worth having: any future edit that "helpfully" surfaces the
 *    real reason to make the message more specific fails it.
 *
 * There is also a source scan below over the two screens that report delivery. This repo has no
 * React test harness, so a rendered assertion is not available; the rendered behaviour is proved by
 * the screenshot pairs in `workspace-plans-v4/ui-actual/`. Each scan below fails against the code
 * as it was before R3b.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { inviteDeliveryMessage, inviteDeliveryBadge } from "./invite-delivery";

const ALL = ["provider_blocked", "recipient_opted_out", "send_failed"] as const;

/**
 * Words that belong to Brevo, to HTTP, or to our infrastructure. None of them is an owner's word.
 */
const PROVIDER_VOCABULARY =
  /brevo|smtp|\bapi key\b|\bIP\b|allowlist|allow-list|whitelist|\b40[13]\b|\b50[023]\b|unrecognis|unrecogniz|template_unresolved|send_failed|provider|gateway|mailer/i;

describe("the owner's words", () => {
  it("says the email could not be sent and that support knows, for a blocked provider", () => {
    const m = inviteDeliveryMessage("provider_blocked");
    expect(m.headline).toMatch(/could not be sent/i);
    expect(m.detail).toMatch(/support has been notified/i);
    // And it says whose fault it is not, because the owner's first guess is the address they typed.
    expect(m.detail).toMatch(/not with the address/i);
  });

  it("never uses the provider's vocabulary, in any case", () => {
    for (const issue of ALL) {
      const m = inviteDeliveryMessage(issue);
      expect(m.headline, `headline for ${issue}`).not.toMatch(PROVIDER_VOCABULARY);
      expect(m.detail, `detail for ${issue}`).not.toMatch(PROVIDER_VOCABULARY);
      expect(inviteDeliveryBadge(issue), `badge for ${issue}`).not.toMatch(PROVIDER_VOCABULARY);
    }
  });

  it("always says the invite itself survived, so nobody re-invites the same person twice", () => {
    for (const issue of ALL) {
      const m = inviteDeliveryMessage(issue);
      expect(`${m.headline} ${m.detail}`, `for ${issue}`).toMatch(
        /invite was created|invite is saved|they will not get/i,
      );
    }
  });

  it("does not offer a retry to somebody who has turned these emails off", () => {
    // Every resend would fail identically. A button here is busywork dressed as a fix.
    expect(inviteDeliveryMessage("recipient_opted_out").canRetry).toBe(false);
    expect(inviteDeliveryMessage("provider_blocked").canRetry).toBe(true);
    expect(inviteDeliveryMessage("send_failed").canRetry).toBe(true);
  });

  it("falls back to the retryable wording rather than to silence", () => {
    // An older server, or a failure nobody has classified, still means an invite went nowhere.
    for (const unknown of [null, undefined, "something_new" as never]) {
      const m = inviteDeliveryMessage(unknown);
      expect(m.headline).toMatch(/did not go through/i);
      expect(m.canRetry).toBe(true);
    }
  });
});

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const strip = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");

const invitePage = strip(read("../routes/_app/team.invite.tsx"));
const teamPage = strip(read("../routes/_app/team.index.tsx"));
const notice = strip(read("../components/team/invite-delivery-notice.tsx"));

describe("the invite page reports what actually happened", () => {
  /**
   * 🔴 The defect R3b exists for.
   *
   * `toast.success("Invite sent")` fired whatever the API answered, and the page navigated away
   * immediately after, so a failed delivery was not merely unreported: it was contradicted, and the
   * owner was moved off the only screen that could have told them.
   */
  it("no longer claims the invite was sent regardless of the answer", () => {
    expect(invitePage).not.toMatch(/toast\.success\(\s*["']Invite sent["']\s*\)/);
  });

  it("reads emailSent before deciding what to say", () => {
    expect(invitePage).toMatch(/created\.emailSent/);
  });

  it("stays on the page when the email failed, instead of navigating away", () => {
    // The Resend button has to still be there a moment later, which a navigation would take away.
    const success = invitePage.slice(invitePage.indexOf("onSuccess: (created)"));
    const branch = success.slice(0, success.indexOf("onError"));
    const navigateAt = branch.indexOf("navigate(");
    const returnAt = branch.indexOf("return;");
    expect(navigateAt, "the success path must still navigate on a delivered email").toBeGreaterThan(
      -1,
    );
    expect(returnAt, "and must return before the undelivered case is handled").toBeGreaterThan(
      navigateAt,
    );
    expect(branch.slice(returnAt)).toMatch(/setUndelivered/);
  });

  it("offers Resend through the shared endpoint, not a new one", () => {
    expect(invitePage).toMatch(/resendTeamInvite\(/);
  });

  it("reports a failed resend the same way it reported the failed invite", () => {
    const resend = invitePage.slice(invitePage.indexOf("resendMutation"));
    expect(resend).toMatch(/result\.emailSent/);
    expect(resend).toMatch(/result\.deliveryIssue/);
  });
});

describe("the Team page marks an invite whose email failed", () => {
  it("no longer claims a resend worked regardless of the answer", () => {
    expect(teamPage).not.toMatch(/toast\.success\(\s*["']Invite resent["']\s*\)/);
    expect(teamPage).toMatch(/result\.emailSent/);
  });

  it("marks only invites recorded as failed, never ones never measured", () => {
    // `=== false`, not falsy: `null` is "we do not know", and must not be accused.
    expect(teamPage).toMatch(/lastDeliveryOk === false/);
    expect(teamPage).not.toMatch(/!inv\.lastDeliveryOk/);
  });

  it("chooses its words from the classification, never from a provider string", () => {
    expect(teamPage).toMatch(/inviteDeliveryMessage\(inv\.lastDeliveryIssue\)/);
    expect(teamPage).not.toMatch(/emailDetail|emailReason/);
  });

  it("offers Resend on a failed invite, and withholds it where it would be pointless", () => {
    expect(teamPage).toMatch(/inviteDeliveryMessage\(inv\.lastDeliveryIssue\)\.canRetry/);
  });
});

describe("the notice component", () => {
  it("has no way to be handed the provider's message", () => {
    // Not a convention: there is no prop for it, so a careless call site cannot pass one.
    expect(notice).not.toMatch(/emailDetail|emailReason|detail:\s*string/);
    expect(notice).toMatch(/issue:\s*InviteDeliveryIssue/);
  });
});
