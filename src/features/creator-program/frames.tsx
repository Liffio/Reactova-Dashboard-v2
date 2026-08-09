import type { ReactNode } from "react";

import {
  ActivityTimeline,
  BenefitList,
  ChecksCard,
  ConnectionCard,
  EligibilityCard,
  NumberedSteps,
} from "./cards";
import { AlertBanner, ResolutionCard, SecondaryDisclosure } from "./attention";
import {
  Card,
  CpButton,
  CpLink,
  CreatorArea,
  Eyebrow,
  HelpBar,
  Meta,
  SectionTitle,
  StatusPill,
} from "./primitives";
import { RequirementMeter, RequirementPreview, SegmentMeter } from "./meters";
import { bannerCopy, notEligibleCopy, takeoverCopy } from "./copy";
import { CREATOR_PROGRAM_LINKS } from "./links";
import {
  formatAbsoluteInstant,
  formatDayMonth,
  formatFullDate,
  formatSyncedAgo,
  periodMonthName,
} from "./format";
import type { CreatorStatusResponse, CreatorThresholdsResponse } from "./contract";

export type FrameActions = {
  onReconnect: () => void;
  onCreateAutomation: () => void;
  onViewAutomations: () => void;
  onApply: () => void;
  onRetry: () => void;
};

type FrameProps = {
  status: CreatorStatusResponse;
  thresholds: CreatorThresholdsResponse | undefined;
  actions: FrameActions;
  now?: Date;
};

/** The hero. The headline is a full sentence with a full stop — it's a verdict. */
function VerdictHero({
  headline,
  body,
  pill,
  syncedAt,
  now,
  children,
}: {
  headline: string;
  body: string;
  pill: ReactNode;
  syncedAt: string | null;
  now?: Date;
  children?: ReactNode;
}) {
  const ago = formatSyncedAgo(syncedAt, now);
  return (
    <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start sm:gap-10">
      <div className="max-w-[640px]">
        <Eyebrow>Creator Program</Eyebrow>
        <h1 className="mt-2.5 text-[26px] font-semibold leading-[1.22] tracking-[-0.6px] sm:text-[32px]">
          {headline}
        </h1>
        <p className="mt-2.5 text-[15px] leading-relaxed text-[var(--cp-ink-body)]">{body}</p>
        {children}
      </div>
      <div className="shrink-0 sm:pt-[26px] sm:text-right">
        {pill}
        {ago && <Meta className="mt-2.5">Synced {ago}</Meta>}
      </div>
    </div>
  );
}

/** QuickActions — a slim strip with exactly one primary, support pushed right. */
function QuickActions({
  status,
  actions,
}: {
  status: CreatorStatusResponse;
  actions: FrameActions;
}) {
  const disconnected = status.account ? !status.account.isConnected : false;
  return (
    <div className="mt-8 flex flex-wrap items-center gap-2.5 border-t border-[var(--cp-hairline-strong)] pt-6">
      <Meta className="mr-1.5">Quick actions</Meta>
      <CpButton tone="primary" onClick={actions.onCreateAutomation}>
        Create automation
      </CpButton>
      <CpButton onClick={actions.onViewAutomations}>View automations</CpButton>
      {disconnected && <CpButton onClick={actions.onReconnect}>Reconnect Instagram</CpButton>}
      <CpButton
        className="sm:ml-auto"
        onClick={() => {
          window.location.href = CREATOR_PROGRAM_LINKS.supportEmail;
        }}
      >
        Contact support
      </CpButton>
    </div>
  );
}

/** The lower half of the membership page — shared by Active and the priority-2 banner frame. */
function MembershipBody({ status, actions, now }: FrameProps) {
  return (
    <>
      <div className="mt-9 flex flex-col gap-5 lg:flex-row">
        {status.account && (
          <ConnectionCard
            account={status.account}
            syncedAt={status.syncedAt}
            onReconnect={actions.onReconnect}
            now={now}
          />
        )}
        <BenefitList title="Your membership" description="Business plan, at no cost" />
        <ActivityTimeline events={status.timeline} />
      </div>
      <QuickActions status={status} actions={actions} />
    </>
  );
}

function RequirementsSection({ status, now }: FrameProps) {
  const progress = status.progress;
  if (!progress) return null;
  const month = periodMonthName(status.period);

  return (
    <div className="mt-9">
      <SectionTitle
        title="This month’s requirements"
        description={
          month
            ? `Both need to be met by the end of ${month} to keep your plan.`
            : "Both need to be met by the end of the month to keep your plan."
        }
      />
      <div className="mt-4 flex flex-col items-stretch gap-5 lg:flex-row">
        <div className="flex min-w-0 lg:flex-[1.55]">
          <RequirementMeter
            current={progress.dmCount}
            target={progress.dmTarget}
            period={status.period}
            now={now}
          />
        </div>
        <div className="flex min-w-0 lg:flex-1">
          <SegmentMeter current={progress.automationCount} target={progress.automationTarget} />
        </div>
      </div>
    </div>
  );
}

export function ActiveFrame(props: FrameProps) {
  const { status, now } = props;
  const month = periodMonthName(status.period);
  return (
    <CreatorArea>
      <VerdictHero
        headline={month ? `You’re on track for ${month}.` : "You’re on track."}
        body="Both requirements are on course. Keep this pace and your Business plan carries into next month automatically — there’s nothing to renew."
        pill={<StatusPill variant="active">Active member</StatusPill>}
        syncedAt={status.syncedAt}
        now={now}
      />
      <RequirementsSection {...props} />
      <MembershipBody {...props} />
    </CreatorArea>
  );
}

/**
 * Priority 2 — a usage shortfall. The numbers are real, so the whole page stays
 * and the banner goes on top. Nothing below is hidden or dimmed.
 */
export function AttentionBannerFrame(props: FrameProps) {
  const { status, actions, now } = props;
  const month = periodMonthName(status.period);
  const progress = status.progress;
  const banner = bannerCopy(status.primaryReason, {
    remaining: Math.max(0, (progress?.dmTarget ?? 0) - (progress?.dmCount ?? 0)),
    current: progress?.dmCount ?? 0,
    target: progress?.dmTarget ?? 0,
    daysLeft: status.period?.daysLeft ?? 0,
  });

  return (
    <CreatorArea>
      <VerdictHero
        headline={month ? `You’re behind for ${month}.` : "You’re behind this month."}
        body="There’s still time to close the gap. Broadening a keyword or adding an automation to a recent post is usually the quickest lift."
        pill={<StatusPill variant="attention">Needs attention</StatusPill>}
        syncedAt={status.syncedAt}
        now={now}
      />
      {banner && (
        <AlertBanner
          heading={banner.heading}
          body={banner.body}
          action={banner.action}
          onAction={actions.onViewAutomations}
        />
      )}
      <RequirementsSection {...props} />
      <MembershipBody {...props} />
    </CreatorArea>
  );
}

/**
 * Priority 1 — the takeover. Every number below would be stale, so none of them
 * render: that is the entire point of the takeover, not a side effect of it.
 */
export function AttentionTakeoverFrame({ status, actions }: FrameProps) {
  const copy = takeoverCopy(status.primaryReason, { brokeOn: formatDayMonth(status.syncedAt) });
  const isMetricsUnavailable = status.primaryReason === "MetricsUnavailable";
  const lastSync = formatAbsoluteInstant(status.syncedAt);

  return (
    <CreatorArea className="py-14 sm:py-16">
      <ResolutionCard
        heading={copy.heading}
        body={copy.body}
        action={copy.action}
        onAction={copy.action ? actions.onReconnect : undefined}
        reassurance={copy.reassurance}
        footnote={isMetricsUnavailable && lastSync ? `Last successful sync: ${lastSync}` : null}
        showIcon={!isMetricsUnavailable}
      />

      {isMetricsUnavailable ? (
        <HelpBar className="mx-auto mt-9 max-w-[560px]">
          <span>Nothing to do — we’ll retry automatically.</span>
          <CpLink href={CREATOR_PROGRAM_LINKS.supportEmail}>Contact support</CpLink>
        </HelpBar>
      ) : (
        // Synced time is deliberately absent from this frame: on a priority-1
        // condition it would read as "we have fresh data", which is the one
        // thing that isn't true.
        <SecondaryDisclosure reasons={status.secondaryReasons} />
      )}
    </CreatorArea>
  );
}

export function NotEligibleFrame({ status, thresholds, actions }: FrameProps) {
  const minPosts = thresholds?.minPosts ?? 15;
  const maxDays = thresholds?.maxDaysSinceLastPost ?? 30;
  const postCount = status.checks?.find((c) => c.key === "MinPosts")?.current ?? null;
  const copy = notEligibleCopy(status.primaryReason, { minPosts, maxDays, postCount });
  const needsConnection =
    status.primaryReason === "InstagramNotConnected" ||
    status.primaryReason === "InstagramDisconnected";

  return (
    <CreatorArea className="py-12 sm:py-14">
      <div className="mx-auto max-w-[520px]">
        <div className="text-center">
          <Eyebrow>Creator Program</Eyebrow>
          <h1 className="mt-2.5 text-[25px] font-semibold tracking-[-0.4px]">{copy.heading}</h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--cp-ink-body)]">
            {copy.body}
          </p>
        </div>

        {status.checks && <ChecksCard checks={status.checks} />}

        <div className="mt-6 text-center">
          <CpButton
            tone={needsConnection ? "primary" : "dark"}
            className="px-[22px] py-[11px] text-[14px]"
            onClick={needsConnection ? actions.onReconnect : actions.onRetry}
          >
            {needsConnection ? "Connect Instagram" : "Recheck my account"}
          </CpButton>
          <Meta className="mt-3">We recheck automatically each day too.</Meta>
        </div>
      </div>
    </CreatorArea>
  );
}

/** The offer — the invitation state. The headline is a proposition, so no full stop. */
export function OfferFrame({
  status,
  thresholds,
  now,
  onOpenConfirm,
}: FrameProps & { onOpenConfirm: () => void }) {
  const ago = formatSyncedAgo(status.syncedAt, now);
  const maxCreators = thresholds?.maxActiveCreators;
  // Connect→first-sync: Eligible arrives the moment Instagram is connected, but
  // checks stay null until the enqueued sync lands, and syncedAt is null with
  // it — so the "Checked …" line has nothing to say. The offer itself is real
  // and Join stays live; only the numbers are pending.
  const awaitingFirstSync = status.checks == null;

  return (
    <CreatorArea>
      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start sm:gap-10">
        <div className="max-w-[600px]">
          <Eyebrow>Creator Program</Eyebrow>
          <h1 className="mt-2.5 text-[26px] font-semibold leading-[1.22] tracking-[-0.6px] sm:text-[32px]">
            Become a Liffio Creator
          </h1>
          <p className="mt-2.5 text-[15px] leading-relaxed text-[var(--cp-ink-body)]">
            Use Liffio actively each month and your Business plan is free — no card, no invoice.
            Your account already meets the requirements, so joining takes one click.
          </p>
          <CpButton tone="primary" size="lg" className="mt-[22px]" onClick={onOpenConfirm}>
            Join Creator Program
          </CpButton>
        </div>
        <div className="shrink-0 sm:pt-[26px] sm:text-right">
          <StatusPill variant="qualified">Eligible to apply</StatusPill>
          {ago && <Meta className="mt-2.5">Checked {ago}</Meta>}
          {!ago && awaitingFirstSync && <Meta className="mt-2.5">Syncing your account…</Meta>}
        </div>
      </div>

      {/* ExchangeRow — 1fr and 1.35fr. The obligation side gets more room
          because it needs explaining and the benefit side doesn't. */}
      <div className="mt-9 flex flex-col items-stretch gap-5 lg:flex-row">
        <div className="flex min-w-0 lg:flex-1">
          <Card className="min-w-0 flex-1 p-6">
            <div className="text-[14px] font-semibold">What you get</div>
            <Meta className="mt-0.5">Business plan, at no cost</Meta>
            <div className="mt-4 text-[13.5px] leading-[2.3] text-[var(--cp-ink-strong)]">
              {[
                "Unlimited automations",
                "Full analytics",
                "Priority support",
                "Business plan features",
              ].map((b) => (
                <div key={b}>
                  <span aria-hidden className="font-semibold text-[var(--cp-coral)]">
                    ✓
                  </span>
                  &nbsp;&nbsp;{b}
                </div>
              ))}
            </div>
            <Meta className="mt-[18px] border-t border-[var(--cp-hairline)] pt-4 leading-relaxed">
              Your plan switches the moment you’re approved. Nothing to cancel first.
            </Meta>
          </Card>
        </div>

        <div className="flex min-w-0 lg:flex-[1.35]">
          <Card className="min-w-0 flex-1 p-6">
            <div className="text-[14px] font-semibold">What’s expected each month</div>
            <Meta className="mt-0.5">Two things we measure, one we ask for</Meta>
            <div className="mt-3.5">
              <RequirementPreview
                value={thresholds?.minMonthlyDms ?? 300}
                title="Automated DMs"
                description="Sent by your automations across the calendar month. You’ll see live progress on this page once you’re in."
              />
              <RequirementPreview
                value={thresholds?.minActiveAutomations ?? 2}
                title="Active automations"
                description="Running at the same time. Paused and draft automations don’t count."
              />
            </div>
            {/* Placement follows the design: below the divider, outside the
                measured pair, because this still isn't a counted metric. The
                wording does not — the design file called attribution an
                unenforced ask, but creators-policy §6.2 makes retaining the tag
                a condition of access and §8.2 makes removing it grounds for
                immediate revocation without warning. It is the single fastest
                way to lose membership, so the page must not read as optional. */}
            <div className="mt-1.5 border-t border-[var(--cp-hairline)] pt-3.5">
              <div className="text-[13.5px] font-medium">
                The “Powered by @Liffio” tag in every automated DM
              </div>
              <Meta className="mt-[3px] leading-snug">
                One short line in the message your automation sends. There’s no monthly counter for
                this one — it’s a condition of membership rather than a target. Removing or altering
                the tag can end your membership immediately, without warning.
              </Meta>
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-9">
        <SectionTitle
          title="Your account"
          description="Pulled from the Instagram account you’ve already connected. Nothing here is editable."
        />
        {/* No `status.checks &&` guard: during the connect→first-sync window
            checks is null, and gating on it left this section as a heading with
            nothing under it. EligibilityCard renders its own syncing state. */}
        {status.account && <EligibilityCard account={status.account} checks={status.checks} />}
      </div>

      <div className="mt-9 flex flex-col items-stretch gap-5 lg:flex-row">
        <div className="flex min-w-0 lg:flex-[1.5]">
          <Card className="min-w-0 flex-1 p-6">
            <div className="mb-3.5 text-[14px] font-semibold">How it works</div>
            <NumberedSteps
              steps={[
                "You submit your application. There’s nothing to fill in — we use the account you’ve already connected.",
                "We review it automatically. This usually takes a few seconds.",
                "If you’re approved, your Business plan starts straight away and this page becomes your progress tracker.",
                maxCreators
                  ? `If we need a closer look, or all ${maxCreators} spots are taken, we’ll email you. Waitlisted applications are promoted automatically when a spot opens.`
                  : "If we need a closer look, or every spot is taken, we’ll email you. Waitlisted applications are promoted automatically when a spot opens.",
              ]}
            />
          </Card>
        </div>
        <div className="flex min-w-0 lg:flex-1">
          <Card className="flex min-w-0 flex-1 flex-col justify-center p-6 text-center">
            <div className="text-[16px] font-semibold tracking-[-0.2px]">Ready to join?</div>
            <div className="mt-2 text-[12.5px] leading-relaxed text-[var(--cp-ink-2)]">
              One confirmation screen, then you’re done. No forms.
            </div>
            <CpButton tone="primary" size="lg" className="mt-5 w-full" onClick={onOpenConfirm}>
              Join Creator Program
            </CpButton>
            <Meta className="mt-3.5 leading-snug">
              You can leave the programme at any time from this page.
            </Meta>
          </Card>
        </div>
      </div>
    </CreatorArea>
  );
}

export function InReviewFrame({ status }: FrameProps) {
  const submitted = formatFullDate(status.latestApplication?.submittedAt ?? null);
  return (
    <CreatorArea className="py-12 sm:py-14">
      <div className="mx-auto max-w-[520px] text-center">
        <StatusPill variant="qualified">Application received</StatusPill>
        <h1 className="mt-[18px] text-[25px] font-semibold tracking-[-0.4px]">
          We’re reviewing your application
        </h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--cp-ink-body)]">
          {submitted
            ? `Submitted on ${submitted}. Most applications are decided automatically within a few seconds — yours needs a closer look, so a person is taking it from here.`
            : "Most applications are decided automatically within a few seconds — yours needs a closer look, so a person is taking it from here."}
        </p>
      </div>
      <HelpBar className="mx-auto mt-6 max-w-[520px]">
        <span>We’ll email you as soon as there’s a decision. Nothing to do until then.</span>
      </HelpBar>
    </CreatorArea>
  );
}

/** Waitlisted — mechanism, never an ETA. No position number: it would be a promise. */
export function WaitlistedFrame({ thresholds }: FrameProps) {
  const maxCreators = thresholds?.maxActiveCreators;
  return (
    <CreatorArea className="py-12 sm:py-14">
      <div className="mx-auto max-w-[520px] text-center">
        <StatusPill variant="qualified">You qualified</StatusPill>
        <h1 className="mt-[18px] text-[25px] font-semibold tracking-[-0.4px]">
          You’re on the waitlist
        </h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--cp-ink-body)]">
          Your application met the bar.{" "}
          {maxCreators
            ? `All ${maxCreators} spots are filled right now`
            : "Every spot is filled right now"}
          , so you’re in line for the next one.
        </p>
      </div>

      <Card className="mx-auto mt-7 max-w-[520px] p-[22px] sm:px-[26px]">
        <NumberedSteps
          title="How this works from here"
          steps={[
            "When an active creator leaves the programme, a spot opens.",
            "The longest-waiting qualified application is promoted automatically.",
            "You’ll get an email the moment that happens. Nothing to do until then.",
          ]}
        />
      </Card>

      <HelpBar className="mx-auto mt-5 max-w-[520px]">
        <span>Keep your account public and posting so you stay qualified.</span>
      </HelpBar>
    </CreatorArea>
  );
}

/**
 * Rejected — softened, and the cooldown framed as a date rather than a
 * countdown. The reason code is never surfaced raw, and no score is shown:
 * "ScoreBelowThreshold" tells the creator nothing they can act on.
 */
export function RejectedFrame({ status }: FrameProps) {
  const reapplyAt = formatFullDate(status.cooldown?.reapplyAt ?? null);
  return (
    <CreatorArea className="py-12 sm:py-14">
      <div className="mx-auto max-w-[500px] text-center">
        <h1 className="text-[25px] font-semibold tracking-[-0.4px]">Not a fit right now</h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--cp-ink-body)]">
          We’re keeping the programme small, so we can’t offer you a spot this time.
          {reapplyAt ? (
            <>
              {" "}
              You’re welcome to apply again from{" "}
              <b className="font-semibold text-[var(--cp-ink)]">{reapplyAt}</b>.
            </>
          ) : (
            " You’re welcome to apply again once your cooldown ends."
          )}
        </p>

        <Card className="mt-6 p-5 text-left sm:px-6">
          <div className="mb-2.5 text-[13.5px] font-semibold">
            What tends to help before reapplying
          </div>
          <div className="text-[13.5px] leading-[2] text-[var(--cp-ink-alt)]">
            <div>Posting consistently through the month</div>
            <div>Replies and comments on recent posts</div>
            <div>A feed that’s clearly a business, not a personal account</div>
          </div>
        </Card>
      </div>

      <HelpBar className="mx-auto mt-5 max-w-[500px]">
        <span>Think this is wrong?</span>
        <CpLink href={CREATOR_PROGRAM_LINKS.creatorEmail}>Reply to our email</CpLink>
      </HelpBar>
    </CreatorArea>
  );
}

/** Paused — a dignified dead end. The API returns nothing else, so the page must not invent a fix. */
export function PausedFrame() {
  return (
    <CreatorArea className="py-14 sm:py-16">
      <div className="mx-auto max-w-[460px] text-center">
        <StatusPill variant="paused">Membership paused</StatusPill>
        <h1 className="mt-[18px] text-[23px] font-semibold tracking-[-0.3px]">
          Your membership is paused
        </h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--cp-ink-body)]">
          Your Creator Program membership is on hold. Your automations and account aren’t affected.
          Our team can walk you through what happens next.
        </p>
      </div>
      <HelpBar className="mx-auto mt-8 max-w-[520px]">
        <CpLink href={CREATOR_PROGRAM_LINKS.supportEmail}>Contact support</CpLink>
        <CpLink href={CREATOR_PROGRAM_LINKS.creatorEmail}>Programme rules</CpLink>
      </HelpBar>
    </CreatorArea>
  );
}

/**
 * Error — `GET /status` failed. Deliberately distinct from MetricsUnavailable,
 * which is a *successful* response describing a known backend condition. Here
 * we genuinely don't know anything, so the page says so and offers a retry.
 */
export function ErrorFrame({ onRetry }: { onRetry: () => void }) {
  return (
    <CreatorArea className="py-14 sm:py-16">
      <div className="mx-auto max-w-[460px] text-center">
        <h1 className="text-[21px] font-semibold tracking-[-0.3px]">
          We couldn’t load your programme
        </h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--cp-ink-body)]">
          Something went wrong on our end fetching your status. Your membership and automations
          aren’t affected.
        </p>
        <CpButton tone="dark" className="mt-5" onClick={onRetry}>
          Try again
        </CpButton>
      </div>
      <HelpBar className="mx-auto mt-8 max-w-[520px]">
        <span>Still not working?</span>
        <CpLink href={CREATOR_PROGRAM_LINKS.supportEmail}>Contact support</CpLink>
      </HelpBar>
    </CreatorArea>
  );
}
