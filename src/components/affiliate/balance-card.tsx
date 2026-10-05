import { Button } from "@/components/ui/button";
import type { AffiliatePayout, AffiliateProfile } from "@/lib/api/affiliate-api";
import { fmtDate, OPEN_PAYOUT_STATUSES, PAYOUT_STATUS } from "./affiliate-format";
import { usd, type PayoutState } from "./payout-state";

export function BalanceCard({
  profile,
  payouts,
  payoutState,
  onPayoutAction,
  onViewPayouts,
}: {
  profile: AffiliateProfile;
  payouts: AffiliatePayout[];
  payoutState: PayoutState;
  onPayoutAction: () => void;
  onViewPayouts: () => void;
}) {
  const terms = profile.programTerms;
  const min = terms?.minPayoutUsd ?? 0;
  const debt = profile.clawbackDebt ?? 0;
  const spendable = profile.spendableBalance ?? profile.availableBalance;
  const showMeter = !profile.isSuspended && debt <= profile.availableBalance && min > 0;
  const progress = Math.min(100, (spendable / min) * 100);
  const inflight = payouts.find((p) => OPEN_PAYOUT_STATUSES.includes(p.status));
  const lastPaid = payouts.find((p) => p.status === "PAID" && p.paidAt);

  return (
    <div className="flex flex-col rounded-2xl border bg-card px-5 pt-6 shadow-soft sm:px-6">
      <div className="mb-5 flex flex-1 flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[13px] text-muted-foreground" id="bal-label">
            Available to withdraw
          </div>
          <div
            className="mt-2.5 font-display text-5xl font-semibold leading-none tracking-tight tabular-nums"
            aria-labelledby="bal-label"
          >
            {usd(spendable)}
            <small className="ml-1.5 text-lg font-medium tracking-normal text-muted-foreground">
              {terms?.currency ?? "USD"}
            </small>
          </div>
          {debt > 0 && (
            <div className="mt-2 text-[12.5px] text-destructive">
              {usd(profile.availableBalance)} earned, minus {usd(debt)} from reversed commissions
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:min-w-[210px] sm:items-end">
          <Button
            className="h-11 w-full sm:h-10 sm:w-auto"
            disabled={payoutState.disabled}
            onClick={onPayoutAction}
          >
            {payoutState.label}
          </Button>
          <p className="max-w-[240px] text-[12.5px] text-muted-foreground sm:text-right">
            {payoutState.help}
          </p>
        </div>
      </div>

      {showMeter && (
        <div className="mb-5">
          <div className="mb-2 flex flex-wrap justify-between gap-3 text-[12.5px] text-muted-foreground">
            {spendable < min ? (
              <>
                <span>Progress to your first withdrawal</span>
                <span>
                  <b className="font-medium text-foreground">{usd(spendable)}</b> of {usd(min)}
                </span>
              </>
            ) : (
              <>
                <span>Above the {usd(min)} payout minimum</span>
                <span>{usd(profile.pendingBalance)} more clearing soon</span>
              </>
            )}
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Progress to the payout minimum"
            aria-valuemin={0}
            aria-valuemax={min}
            aria-valuenow={Math.min(spendable, min)}
          >
            <div
              className="h-full rounded-full bg-brand-gradient transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {inflight && (
        <div className="mb-5 flex items-center gap-2.5 rounded-lg bg-muted px-3 py-2.5 text-[13px]">
          <span className="h-2 w-2 flex-none rounded-full bg-warning ring-[3px] ring-warning/20" />
          <span className="flex-1">
            {usd(inflight.amount)} payout{" "}
            {(PAYOUT_STATUS[inflight.status]?.label ?? inflight.status).toLowerCase()} · requested{" "}
            {fmtDate(inflight.requestedAt)}
          </span>
          <button className="font-medium underline underline-offset-2" onClick={onViewPayouts}>
            View
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 border-t border-border/60 sm:grid-cols-3">
        <Ledger label="Total earned" value={usd(profile.totalEarned)} />
        <Ledger
          label="On hold"
          value={usd(profile.pendingBalance)}
          sub={terms?.holdDays ? `Clears after ${terms.holdDays} days` : undefined}
          className="border-l border-border/60 pl-5"
        />
        <Ledger
          label="Lifetime paid"
          value={usd(profile.lifetimePaid)}
          sub={lastPaid?.paidAt ? `Last paid ${fmtDate(lastPaid.paidAt)}` : "No payouts yet"}
          className="col-span-2 border-t border-border/60 sm:col-span-1 sm:border-l sm:border-t-0 sm:pl-5"
        />
      </div>
    </div>
  );
}

function Ledger({
  label,
  value,
  sub,
  className = "",
}: {
  label: string;
  value: string;
  sub?: string;
  className?: string;
}) {
  return (
    <div className={`pb-4 pt-4 ${className}`}>
      <div className="text-[13px] text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-xl font-semibold tracking-tight tabular-nums">
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
