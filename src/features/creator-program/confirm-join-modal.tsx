import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, CpButton, CpLink, Figure, Meta, StatusPill, Tick } from "./primitives";
import { BENEFITS } from "./copy";
import { CREATOR_PROGRAM_LINKS } from "./links";
import { formatCount } from "./format";
import type { CreatorAccount, CreatorThresholdsResponse } from "./contract";
import { formatHandle } from "@/lib/format";

const CONSENTS = [
  { id: "terms", label: "I agree to the Creator Program Terms" },
  { id: "requirements", label: "I understand the monthly participation requirements" },
  {
    id: "pause",
    // "Paused" alone understated it: creators-policy §9 reserves the right to
    // revoke access outright, which is the stronger outcome the creator is
    // actually consenting to. Both are named because both can happen.
    label: "I understand my membership can be paused or revoked if I stop meeting them",
  },
] as const;

function ConsentCheckbox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={
        checked
          ? "mt-px flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] border-[var(--cp-coral)] bg-[var(--cp-coral)] text-[11px] font-semibold text-white"
          : "mt-px h-[17px] w-[17px] shrink-0 rounded-[5px] border-[1.5px] border-[var(--cp-checkbox-border)] bg-[var(--cp-card)]"
      }
    >
      {checked ? "✓" : null}
    </span>
  );
}

/**
 * ConfirmJoinModal — 560px, consent only.
 *
 * There are no inputs of any kind: the application uses the account already
 * connected, so anything to type would be a field we'd then have to ignore.
 * Submit stays inactive until all three boxes are ticked, and Escape and Cancel
 * both close with no side effects — closing this modal must never leave a
 * half-submitted application behind.
 */
export function ConfirmJoinModal({
  open,
  onOpenChange,
  account,
  thresholds,
  onSubmit,
  isSubmitting,
  /**
   * The inline notice for the POST /apply outcomes that keep this modal open
   * rather than closing to a frame change: blocked_by_cooldown (only reachable
   * if a cooldown started in another tab) and metrics_unavailable (retryable —
   * nothing was written). Both need the reason attached to the button the
   * creator just pressed. Submit stays live underneath it, so metrics_unavailable
   * can be retried by pressing it again.
   */
  notice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: CreatorAccount | null;
  thresholds: CreatorThresholdsResponse | undefined;
  onSubmit: () => void;
  isSubmitting: boolean;
  notice: string | null;
}) {
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const allTicked = CONSENTS.every((c) => ticked[c.id]);

  // Reopening starts from scratch — consent given in a previous session of the
  // modal is not consent given now.
  useEffect(() => {
    if (!open) setTicked({});
  }, [open]);

  if (isSubmitting) return <SubmittingModal open={open} />;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="creator-program w-[calc(100vw-1.5rem)] gap-0 overflow-hidden rounded-2xl border-[var(--cp-card-border)] bg-[var(--cp-card)] p-0 text-[var(--cp-ink)] shadow-[var(--cp-shadow-modal)] sm:max-w-[560px]">
        <DialogHeader className="space-y-0 border-b border-[var(--cp-hairline-soft)] px-[26px] pb-[18px] pt-[22px] text-left">
          <DialogTitle className="text-[17px] font-semibold tracking-[-0.2px]">
            Join Creator Program
          </DialogTitle>
          <DialogDescription className="mt-1 text-[12.5px] text-[var(--cp-ink-2)]">
            Confirm what you’re agreeing to, then submit.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto px-[26px] py-[22px]">
          {account && (
            <div className="flex items-center gap-3 rounded-[10px] border border-[var(--cp-hairline-soft)] bg-[var(--cp-page)] px-3.5 py-3">
              <Avatar url={account.profilePictureUrl} handle={account.handle} size={34} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold">
                  {formatHandle(account.handle) ?? "Instagram account"}
                </div>
                <Meta>
                  {account.accountType} account · {formatCount(account.followerCount)} followers
                </Meta>
              </div>
              <StatusPill variant="connected" className="font-normal">
                Connected
              </StatusPill>
            </div>
          )}

          <div className="mt-5 flex flex-col gap-6 sm:flex-row">
            <div className="flex-1">
              <Meta className="mb-[7px]">You receive</Meta>
              <div className="text-[12.5px] leading-[1.95] text-[var(--cp-ink-alt)]">
                {BENEFITS.map((benefit) => (
                  <div key={benefit}>
                    <Tick />
                    &nbsp; {benefit}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <Meta className="mb-[7px]">You maintain, monthly</Meta>
              <div className="text-[12.5px] leading-[1.95] text-[var(--cp-ink-alt)]">
                <div>
                  <Figure className="font-semibold">{thresholds?.minMonthlyDms ?? "—"}</Figure>
                  &nbsp; automated DMs
                </div>
                <div>
                  <Figure className="font-semibold">
                    {thresholds?.minActiveAutomations ?? "—"}
                  </Figure>
                  &nbsp; active automations
                </div>
                <Meta className="mt-1 leading-snug">
                  Plus the “Powered by @Liffio” tag in every automated DM — required, not counted.
                </Meta>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-[10px] border border-[var(--cp-hairline-soft)] bg-[var(--cp-page)] px-4 py-3.5">
            <Meta className="mb-2">Worth knowing</Meta>
            <div className="space-y-1.5 text-[12.5px] leading-relaxed text-[var(--cp-ink-alt)]">
              {/* Matches creators-policy §9 and §8.2. The previous wording
                  promised an email unconditionally and named pausing as the
                  only outcome; the policy reserves the right to revoke, commits
                  only to reasonable efforts to notify, and carves out serious
                  violations entirely. */}
              <div>
                Membership can be paused, or access revoked, if you stop meeting the requirements.
                We’ll make reasonable efforts to email you first — but serious violations, including
                removing the “Powered by @Liffio” tag, can end it immediately without warning.
              </div>
              <div>
                You can leave at any time. Your automations, leads and data stay exactly as they
                are.
              </div>
              {thresholds && (
                <div>
                  The programme is capped at {thresholds.maxActiveCreators} active creators.
                </div>
              )}
            </div>
          </div>

          <Meta className="mt-4 leading-relaxed">
            The <CpLink href={CREATOR_PROGRAM_LINKS.terms}>Creator Program Terms</CpLink> cover
            participation, the Liffio recommendation, and how membership can end. We use your
            connected Instagram profile and your automation activity to check requirements — nothing
            new is collected for the programme.{" "}
            <CpLink href={CREATOR_PROGRAM_LINKS.privacy}>Privacy</CpLink>.
          </Meta>

          <div className="mt-5 border-t border-[var(--cp-hairline)] pt-[18px]">
            {CONSENTS.map((consent) => (
              <label
                key={consent.id}
                className="flex cursor-pointer items-start gap-[11px] py-[7px] text-[13px]"
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={Boolean(ticked[consent.id])}
                  onChange={(e) =>
                    setTicked((prev) => ({ ...prev, [consent.id]: e.target.checked }))
                  }
                />
                <ConsentCheckbox checked={Boolean(ticked[consent.id])} />
                <span>{consent.label}</span>
              </label>
            ))}
          </div>

          {notice && (
            <div className="mt-4 rounded-[10px] border border-[var(--cp-amber-border)] bg-[var(--cp-amber-bg)] px-4 py-3 text-[12.5px] text-[var(--cp-amber-fg)]">
              {notice}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 border-t border-[var(--cp-hairline-soft)] bg-[var(--cp-modal-footer)] px-[26px] py-[18px]">
          <CpButton onClick={() => onOpenChange(false)}>Cancel</CpButton>
          <CpButton tone="primary" className="ml-auto" disabled={!allTicked} onClick={onSubmit}>
            Submit application
          </CpButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * SubmittingModal — holds the wait inside the modal rather than closing to an
 * empty page. The parent hands off to PageSkeleton only if the request runs
 * past ~3s, so a decision that takes a moment never flashes a blank screen.
 */
export function SubmittingModal({ open }: { open: boolean }) {
  return (
    <Dialog open={open}>
      {/* No close affordance while the request is in flight: `[&>button]:hidden`
          hides DialogContent's built-in ×, and Escape / outside-click are
          swallowed. Closing here would abandon an application mid-decision. */}
      <DialogContent
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="creator-program w-[calc(100vw-1.5rem)] gap-0 overflow-hidden rounded-2xl border-[var(--cp-card-border)] bg-[var(--cp-card)] p-0 text-[var(--cp-ink)] shadow-[var(--cp-shadow-modal)] [&>button]:hidden sm:max-w-[560px]"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Reviewing your application</DialogTitle>
          <DialogDescription>This usually takes a few seconds.</DialogDescription>
        </DialogHeader>
        <div className="px-[26px] py-11 text-center">
          <div className="mx-auto h-[34px] w-[34px] animate-spin rounded-full border-2 border-[var(--cp-hairline)] border-t-[var(--cp-coral)]" />
          <div className="mt-[18px] text-[15px] font-semibold">Reviewing your application</div>
          <div className="mt-1.5 text-[12.5px] text-[var(--cp-ink-2)]">
            This usually takes a few seconds.
          </div>
        </div>
        <div className="flex justify-center border-t border-[var(--cp-hairline-soft)] bg-[var(--cp-modal-footer)] px-[26px] py-[18px]">
          <Meta>Don’t close this window</Meta>
        </div>
      </DialogContent>
    </Dialog>
  );
}
