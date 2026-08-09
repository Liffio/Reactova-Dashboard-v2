import { useState } from "react";
import { AlertTriangle } from "lucide-react";

import { CpButton, Meta } from "./primitives";
import { secondaryDisclosureCopy } from "./copy";
import type { PrimaryReason } from "./contract";

/**
 * AlertBanner — priority-2 conditions only. Heading, one line, one action.
 *
 * Priority 2 means the numbers below are real, so the page stays intact and the
 * creator keeps them; the banner sits on top rather than replacing anything.
 * Dismissible for the session: the shortfall is still visible in the meter, so
 * a creator who has read it once doesn't need it pinned.
 */
export function AlertBanner({
  heading,
  body,
  action,
  onAction,
}: {
  heading: string;
  body: string;
  action?: string | null;
  onAction?: () => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="mt-6 flex flex-col gap-4 rounded-xl border border-[var(--cp-amber-border)] bg-[var(--cp-amber-bg)] px-5 py-4 sm:flex-row sm:items-center">
      <div className="flex-1">
        <div className="text-[13.5px] font-semibold text-[var(--cp-amber-fg-strong)]">
          {heading}
        </div>
        <div className="mt-[3px] text-[13px] text-[var(--cp-amber-fg)]">{body}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {action && onAction && (
          <CpButton tone="amber" onClick={onAction}>
            {action}
          </CpButton>
        )}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-md px-2 py-1 text-[12.5px] text-[var(--cp-amber-fg)] hover:bg-[var(--cp-card)]/50"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

/**
 * ResolutionCard — the priority-1 takeover.
 *
 * One heading, one paragraph, at most one action, and deliberately no slot for
 * a second issue: priority 1 means every number below would be stale, so the
 * page shows the break instead of a dashboard the creator can't trust.
 * MetricsUnavailable passes `action: null` — there is genuinely nothing to
 * press, and inventing a retry button would be a lie about who can fix it.
 */
export function ResolutionCard({
  heading,
  body,
  action,
  onAction,
  reassurance,
  footnote,
  showIcon = true,
}: {
  heading: string;
  body: string;
  action?: string | null;
  onAction?: () => void;
  reassurance?: string | null;
  footnote?: string | null;
  showIcon?: boolean;
}) {
  return (
    <div className="mx-auto max-w-[460px] text-center">
      {showIcon && (
        <div className="mx-auto mb-[22px] flex h-[46px] w-[46px] items-center justify-center rounded-xl bg-[var(--cp-avatar)] text-[var(--cp-eyebrow)]">
          <AlertTriangle className="h-5 w-5" aria-hidden />
        </div>
      )}
      <h2 className="text-[23px] font-semibold leading-tight tracking-[-0.3px]">{heading}</h2>
      <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--cp-ink-body)]">{body}</p>
      {action && onAction && (
        <CpButton
          tone="primary"
          onClick={onAction}
          className="mt-6 px-[22px] py-[11px] text-[14px]"
        >
          {action}
        </CpButton>
      )}
      {reassurance && <Meta className="mt-3.5">{reassurance}</Meta>}
      {footnote && <Meta className="mt-[18px]">{footnote}</Meta>}
    </div>
  );
}

/**
 * SecondaryDisclosure — the only place `secondaryReasons` may render.
 *
 * Collapsed by design. On a takeover the secondary issue is real but not
 * actionable yet (the connection has to come back first), so surfacing it
 * alongside the primary would split the one action the card is asking for.
 */
export function SecondaryDisclosure({ reasons }: { reasons: PrimaryReason[] }) {
  if (reasons.length === 0) return null;

  return (
    <div className="mx-auto mt-10 max-w-[560px]">
      <details className="border-t border-[var(--cp-hairline-strong)] pt-4">
        <summary className="cursor-pointer list-none text-[13px] text-[var(--cp-ink-2)] marker:content-['']">
          {reasons.length} other thing{reasons.length === 1 ? "" : "s"} to check
        </summary>
        <div className="mt-3 space-y-2 text-[13px] leading-relaxed text-[var(--cp-ink-2)]">
          {reasons.map((reason) => (
            <p key={reason}>{secondaryDisclosureCopy(reason)}</p>
          ))}
        </div>
      </details>
    </div>
  );
}
