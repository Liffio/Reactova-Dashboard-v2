import type { ReactNode } from "react";

import { Avatar, Card, Figure, Meta, Pending, StatusPill, Tick } from "./primitives";
import { BENEFITS, TIMELINE_LABEL, checkLabel, checkValue } from "./copy";
import { formatCount, formatDayMonth, formatEngagement, formatSyncedAgo } from "./format";
import type { CreatorAccount, EligibilityCheck, TimelineEvent } from "./contract";

/**
 * The three stats under the account header. Engagement is here even when it's
 * null — the row is never hidden. A missing third stat unbalances the three-up
 * grid, and `engagementRate: null` is the *default* at launch rather than an
 * edge case: instagram_business_manage_insights is still in review, so most
 * accounts have no figure to show.
 */
function AccountStats({ account }: { account: CreatorAccount }) {
  const engagement = formatEngagement(account.engagementRate);
  const engagementMissing = account.engagementRate == null;

  return (
    <div className="mt-5 flex border-t border-[var(--cp-hairline)] pt-[18px]">
      <div className="flex-1">
        <Meta>Followers</Meta>
        <Figure className="mt-[3px] block text-[18px] font-semibold">
          {formatCount(account.followerCount)}
        </Figure>
      </div>
      <div className="flex-1">
        <Meta>Posts</Meta>
        <Figure className="mt-[3px] block text-[18px] font-semibold">
          {formatCount(account.postCount)}
        </Figure>
      </div>
      <div className="flex-1">
        <Meta>Engagement</Meta>
        <Figure
          className={
            engagementMissing
              ? "mt-[3px] block text-[18px] font-semibold text-[var(--cp-ink-3)]"
              : "mt-[3px] block text-[18px] font-semibold"
          }
        >
          {engagement}
        </Figure>
      </div>
    </div>
  );
}

function AccountHeader({ account, size = 42 }: { account: CreatorAccount; size?: number }) {
  return (
    <div className="flex items-center gap-[13px]">
      <Avatar url={account.profilePictureUrl} handle={account.handle} size={size} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold">
          {account.handle ? `@${account.handle}` : "Instagram account"}
        </div>
        <Meta className="mt-px">{account.accountType} account</Meta>
      </div>
    </div>
  );
}

/**
 * ConnectionCard. The Reconnect button appears only when disconnected — a
 * working connection needs no button offering to fix it.
 */
export function ConnectionCard({
  account,
  syncedAt,
  onReconnect,
  now,
}: {
  account: CreatorAccount;
  syncedAt: string | null;
  onReconnect?: () => void;
  now?: Date;
}) {
  const ago = formatSyncedAgo(syncedAt, now);

  return (
    <Card className="min-w-0 flex-1 p-[22px] sm:px-6">
      <div className="flex items-center gap-[13px]">
        <Avatar url={account.profilePictureUrl} handle={account.handle} size={42} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold">
            {account.handle ? `@${account.handle}` : "Instagram account"}
          </div>
          <Meta className="mt-px">{account.accountType} account</Meta>
        </div>
        <StatusPill
          variant={account.isConnected ? "connected" : "attention"}
          className="font-normal"
        >
          {account.isConnected ? "Connected" : "Disconnected"}
        </StatusPill>
      </div>

      <AccountStats account={account} />

      {ago && <Meta className="mt-4">Last synced {ago}</Meta>}

      {!account.isConnected && onReconnect && (
        <button
          type="button"
          onClick={onReconnect}
          className="mt-4 w-full rounded-[9px] border border-[var(--cp-coral)] bg-[var(--cp-coral)] px-4 py-[9px] text-[13px] font-medium text-white hover:opacity-95"
        >
          Reconnect Instagram
        </button>
      )}
    </Card>
  );
}

/**
 * The five hard checks. Read-only, straight from `/status` — and never a score,
 * a percentage or a "you're close" hint. A creator who can't tell how strong
 * their application is can't be disappointed by a number that turned out not to
 * mean what they thought.
 */
export function CheckList({ checks }: { checks: EligibilityCheck[] }) {
  return (
    <div className="text-[13.5px]">
      {checks.map((check) => {
        const value = checkValue(check.key, check.passed, check.current, check.required);
        return (
          <div
            key={check.key}
            className="flex items-center gap-2.5 border-t border-[var(--cp-hairline)] py-2 first:border-t-0"
          >
            {check.passed ? <Tick /> : <Pending />}
            <span className="flex-1">{checkLabel(check.key, check.required)}</span>
            {value && <Figure className="text-[12.5px] text-[var(--cp-ink-3)]">{value}</Figure>}
          </div>
        );
      })}
    </div>
  );
}

/** The NotEligible frame's checklist, in its own card with the "what we check" lead-in. */
export function ChecksCard({ checks }: { checks: EligibilityCheck[] }) {
  return (
    <Card className="mt-7 p-5 sm:px-6">
      <Meta className="mb-3.5">What we check before you apply</Meta>
      <CheckList checks={checks} />
    </Card>
  );
}

/**
 * EligibilityCard — ConnectionCard plus the check list, split by a hairline.
 * The apply page's single source of "here's your account, here's what we
 * looked at", so the creator never has to reconcile two versions of it.
 */
export function EligibilityCard({
  account,
  checks,
}: {
  account: CreatorAccount;
  checks: EligibilityCheck[];
}) {
  return (
    <Card className="mt-4 flex flex-col gap-8 p-6 sm:flex-row sm:gap-[34px]">
      <div className="min-w-0 flex-1">
        <AccountHeader account={account} />
        <AccountStats account={account} />
      </div>

      <div aria-hidden className="hidden w-px shrink-0 bg-[var(--cp-hairline-soft)] sm:block" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <Meta>What we checked</Meta>
          <StatusPill variant="qualified">Eligible to apply</StatusPill>
        </div>
        <div className="mt-3">
          <CheckList checks={checks} />
        </div>
      </div>
    </Card>
  );
}

export function BenefitList({ title, description }: { title: string; description: string }) {
  return (
    <Card className="min-w-0 flex-1 p-[22px] sm:px-6">
      <div className="text-[14px] font-semibold">{title}</div>
      <Meta className="mt-0.5">{description}</Meta>
      <div className="mt-3.5 text-[13px] leading-[2.3] text-[var(--cp-ink-strong)]">
        {BENEFITS.map((benefit) => (
          <div key={benefit}>
            <Tick />
            &nbsp;&nbsp;{benefit}
          </div>
        ))}
      </div>
    </Card>
  );
}

/**
 * ActivityTimeline. Caps at four and renders allowlisted types only — anything
 * else was dropped server-side and never reaches here. Renders nothing at all
 * rather than an empty card with a heading over blank space.
 */
export function ActivityTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return null;

  return (
    <Card className="min-w-0 flex-1 p-[22px] sm:px-6">
      <div className="text-[14px] font-semibold">Recent activity</div>
      <div className="mt-2.5">
        {events.slice(0, 4).map((event) => (
          <div
            key={`${event.type}-${event.at}`}
            className="flex gap-3 border-t border-[var(--cp-hairline)] py-2.5 text-[13px] first:border-t-0"
          >
            <span className="flex-1">{TIMELINE_LABEL[event.type] ?? event.type}</span>
            <span className="text-[12.5px] text-[var(--cp-ink-3)]">{formatDayMonth(event.at)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** The numbered list shared by the waitlist card and the apply page's How it works. */
export function NumberedSteps({ steps, title }: { steps: ReactNode[]; title?: string }) {
  return (
    <>
      {title && <div className="mb-3.5 text-[13.5px] font-semibold">{title}</div>}
      <div className="text-[13.5px] leading-relaxed text-[var(--cp-ink-alt)]">
        {steps.map((step, i) => (
          <div
            key={i}
            className="flex gap-3.5 border-t border-[var(--cp-hairline)] py-[13px] first:border-t-0 first:pt-0 last:pb-0"
          >
            <Figure className="w-3.5 shrink-0 pt-0.5 text-[12.5px] text-[var(--cp-ink-3)]">
              {i + 1}
            </Figure>
            <span>{step}</span>
          </div>
        ))}
      </div>
    </>
  );
}
