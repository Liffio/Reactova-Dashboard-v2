import { Sparkles } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ConsentAgreementDialog,
  type ConsentItem,
  type PolicyLink,
} from "@/components/legal/consent-agreement-dialog";
import { Avatar, Figure, Meta, StatusPill, Tick } from "./primitives";
import { BENEFITS } from "./copy";
import { CREATOR_PROGRAM_LINKS } from "./links";
import { formatCount } from "./format";
import type { CreatorAccount, CreatorThresholdsResponse } from "./contract";
import { formatHandle } from "@/lib/format";

/** Every slug here is live on liffio.com. */
const POLICY_LINKS: readonly PolicyLink[] = [
  { slug: "creators-policy", label: "Creators Program Policy" },
  { slug: "terms-of-service", label: "Terms of Service" },
  { slug: "privacy-policy", label: "Privacy Policy" },
  { slug: "acceptable-use-policy", label: "Acceptable Use Policy" },
];

const CONSENTS: readonly ConsentItem[] = [
  {
    id: "terms",
    label: (
      <>
        I agree to the{" "}
        <a
          href={CREATOR_PROGRAM_LINKS.terms}
          target="_blank"
          rel="noopener noreferrer"
          // Inside a <label>: open the page, don't toggle the checkbox.
          onClick={(e) => e.stopPropagation()}
          className="font-medium text-primary underline underline-offset-2"
        >
          Creator Program Terms
        </a>
      </>
    ),
  },
  { id: "requirements", label: "I understand the monthly participation requirements" },
  {
    id: "pause",
    // "Paused" alone understated it: creators-policy §9 reserves the right to
    // revoke access outright, which is the stronger outcome the creator is
    // actually consenting to. Both are named because both can happen.
    label: "I understand my membership can be paused or revoked if I stop meeting them",
  },
];

/** Numbered heading — the same document style as the affiliate agreement. */
function SectionTitle({ n, children }: { n: number; children: string }) {
  return (
    <h4 className="text-sm font-semibold text-foreground">
      {n}. {children}
    </h4>
  );
}

const PARA = "text-sm leading-relaxed text-muted-foreground";
const LINK = "font-medium text-primary underline underline-offset-2";

/**
 * ConfirmJoinModal — consent only, in the shared program-agreement layout
 * (`ConsentAgreementDialog`, the same shell as the affiliate agreement).
 *
 * There are no inputs of any kind: the application uses the account already
 * connected, so anything to type would be a field we'd then have to ignore.
 * Submit stays inactive until all three boxes are ticked, and Escape and Cancel
 * both close with no side effects — closing this modal must never leave a
 * half-submitted application behind. Ticks reset on every close (the shell does it).
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
  if (isSubmitting) return <SubmittingModal open={open} />;

  return (
    <ConsentAgreementDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={Sparkles}
      title="Creator Program Agreement"
      description="Please read the agreement in full. The confirmations below unlock once you reach the end."
      policies={POLICY_LINKS}
      consents={CONSENTS}
      cancelLabel="Cancel"
      submitLabel="Submit application"
      onSubmit={onSubmit}
      // Scope for the Creator Program primitives' colour variables (Avatar, StatusPill, …).
      className="creator-program"
      notice={
        notice ? (
          <div className="rounded-lg border border-[var(--cp-amber-border)] bg-[var(--cp-amber-bg)] px-3 py-2 text-xs text-[var(--cp-amber-fg)]">
            {notice}
          </div>
        ) : null
      }
    >
      <div className="space-y-6">
        {account && (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3.5 py-3">
            <Avatar url={account.profilePictureUrl} handle={account.handle} size={34} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">
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

        <section className="space-y-2">
          <SectionTitle n={1}>What you receive</SectionTitle>
          <ul className={`space-y-1 ${PARA}`}>
            {BENEFITS.map((benefit) => (
              <li key={benefit}>
                <Tick />
                &nbsp; {benefit}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <SectionTitle n={2}>What you maintain, monthly</SectionTitle>
          <ul className={`space-y-1 ${PARA}`}>
            <li>
              <Figure className="font-semibold text-foreground">
                {thresholds?.minMonthlyDms ?? "—"}
              </Figure>
              &nbsp; automated DMs
            </li>
            <li>
              <Figure className="font-semibold text-foreground">
                {thresholds?.minActiveAutomations ?? "—"}
              </Figure>
              &nbsp; active automations
            </li>
          </ul>
          <p className={PARA}>
            Plus the “Powered by @Liffio” tag in every automated DM — required, not counted.
          </p>
        </section>

        <section className="space-y-2">
          <SectionTitle n={3}>Membership and leaving</SectionTitle>
          {/* Matches creators-policy §9 and §8.2. The previous wording
              promised an email unconditionally and named pausing as the
              only outcome; the policy reserves the right to revoke, commits
              only to reasonable efforts to notify, and carves out serious
              violations entirely. */}
          <p className={PARA}>
            Membership can be paused, or access revoked, if you stop meeting the requirements. We’ll
            make reasonable efforts to email you first — but serious violations, including removing
            the “Powered by @Liffio” tag, can end it immediately without warning.
          </p>
          <p className={PARA}>
            You can leave at any time. Your automations, leads and data stay exactly as they are.
          </p>
          {thresholds && (
            <p className={PARA}>
              The programme is capped at {thresholds.maxActiveCreators} active creators.
            </p>
          )}
        </section>

        <section className="space-y-2">
          <SectionTitle n={4}>Terms and your data</SectionTitle>
          <p className={PARA}>
            The{" "}
            <a
              href={CREATOR_PROGRAM_LINKS.terms}
              target="_blank"
              rel="noopener noreferrer"
              className={LINK}
            >
              Creator Program Terms
            </a>{" "}
            cover participation, the Liffio recommendation, and how membership can end. We use your
            connected Instagram profile and your automation activity to check requirements — nothing
            new is collected for the programme. See the{" "}
            <a
              href={CREATOR_PROGRAM_LINKS.privacy}
              target="_blank"
              rel="noopener noreferrer"
              className={LINK}
            >
              Privacy Policy
            </a>
            .
          </p>
        </section>
      </div>
    </ConsentAgreementDialog>
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
