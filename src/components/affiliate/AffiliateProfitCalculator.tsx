import { useMemo, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { useBillingConfigQuery } from "@/hooks/useBilling";
import {
  AFFILIATE_COMMISSION_RATE,
  AFFILIATE_COMMISSION_RATE_PERCENT,
} from "@/lib/affiliateProgramContent";

const SLIDER_MIN = 1;
const SLIDER_MAX = 500;
const DEFAULT_REFERRALS = 100;

function formatMoney(amount: number): string {
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function AffiliateProfitCalculator() {
  const { data: billingConfig } = useBillingConfigQuery();
  const [referrals, setReferrals] = useState(DEFAULT_REFERRALS);

  const starterMonthlyUsd =
    billingConfig?.plans.find((p) => p.plan === "STARTER")?.pricing.monthlyUsd ?? 9;

  const monthlyCommissionPerReferral = starterMonthlyUsd * AFFILIATE_COMMISSION_RATE;

  const yearlyEarnings = useMemo(() => {
    const count = Math.max(SLIDER_MIN, Math.min(SLIDER_MAX, referrals));
    return count * monthlyCommissionPerReferral * 12;
  }, [referrals, monthlyCommissionPerReferral]);

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-violet-500/20 shadow-[0_20px_50px_-12px_rgba(88,28,135,0.35)]"
      style={{
        background:
          "linear-gradient(145deg, hsl(262 32% 14%) 0%, hsl(258 28% 10%) 45%, hsl(270 22% 8%) 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, hsl(320 70% 55%) 0%, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, hsl(265 80% 50%) 0%, transparent 70%)" }}
      />

      <div className="relative px-5 py-6 sm:px-8 sm:py-8">
        <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
          Calculate your potential earnings
        </h3>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-white/85">Number of referrals per month</p>
          <span
            className="inline-flex min-w-[3.25rem] items-center justify-center rounded-lg px-3 py-1.5 text-sm font-bold tabular-nums text-white shadow-sm"
            style={{ background: "linear-gradient(135deg, hsl(330 75% 58%) 0%, hsl(280 70% 52%) 100%)" }}
          >
            {referrals}
          </span>
        </div>

        <div className="mt-4">
          <Slider
            value={[referrals]}
            min={SLIDER_MIN}
            max={SLIDER_MAX}
            step={1}
            onValueChange={([value]) => setReferrals(value ?? DEFAULT_REFERRALS)}
            className="[&_[role=slider]]:h-5 [&_[role=slider]]:w-5 [&_[role=slider]]:border-0 [&_[role=slider]]:shadow-md [&_[role=slider]]:bg-[hsl(330,75%,58%)] [&_.bg-primary]:bg-white/90 [&_.bg-secondary]:h-2.5 [&_.bg-secondary]:bg-white/25"
            aria-label="Number of referrals per month"
          />
          <div className="mt-1.5 flex justify-between text-[10px] font-medium text-white/40 tabular-nums">
            <span>{SLIDER_MIN}</span>
            <span>{SLIDER_MAX}</span>
          </div>
        </div>

        <p className="mt-8 text-4xl sm:text-5xl font-extrabold text-white tabular-nums tracking-tight">
          {formatMoney(yearlyEarnings)}
          <span className="text-2xl sm:text-3xl font-semibold text-white/70">/year</span>
        </p>

        <p className="mt-4 text-xs sm:text-sm text-white/55 leading-relaxed max-w-xl">
          *Based on {AFFILIATE_COMMISSION_RATE_PERCENT}% commission on the Starter plan (
          {formatMoney(starterMonthlyUsd)}/mo per referral →{" "}
          {formatMoney(monthlyCommissionPerReferral)}/mo to you). Actual earnings vary with plan,
          churn, hold period, and refunds.
        </p>
      </div>
    </section>
  );
}
