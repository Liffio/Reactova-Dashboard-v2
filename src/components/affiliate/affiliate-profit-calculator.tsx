import { useMemo, useState } from "react";
import { Globe } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { useAffiliateCalculatorConfig } from "@/hooks/use-affiliate-calculator";

const SLIDER_MIN = 1;
const SLIDER_MAX = 500;
const DEFAULT_REFERRALS = 100;

function formatRegionalAmount(amount: number, currency: "USD" | "INR"): string {
  if (currency === "INR") {
    return `₹${Math.round(amount).toLocaleString("en-IN")}`;
  }
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function AffiliateProfitCalculator() {
  const { data: config, isLoading, isError } = useAffiliateCalculatorConfig();
  const [referrals, setReferrals] = useState(DEFAULT_REFERRALS);

  const yearlyEarnings = useMemo(() => {
    if (!config) return 0;
    const count = Math.max(SLIDER_MIN, Math.min(SLIDER_MAX, referrals));
    return count * config.monthlyCommissionPerReferral * 12;
  }, [referrals, config]);

  if (isLoading) {
    return (
      <section className="rounded-2xl border bg-card p-6 sm:p-8 shadow-soft space-y-4">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-10 w-full rounded-full" />
        <Skeleton className="h-12 w-48" />
      </section>
    );
  }

  if (isError || !config) {
    return (
      <section className="rounded-2xl border bg-card p-6 shadow-soft text-sm text-muted-foreground">
        Unable to load earnings estimate. Refresh the page to try again.
      </section>
    );
  }

  const { currency, currencyLabel, planMonthly, monthlyCommissionPerReferral, commissionRatePercent } = config;

  return (
    <section className="affiliate-earnings-calculator relative overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-soft">
      <div className="pointer-events-none absolute inset-0 bg-brand-gradient opacity-[0.06]" />
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />

      <div className="relative px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className="font-display text-lg sm:text-xl font-bold text-foreground tracking-tight">
            Calculate your potential earnings
          </h3>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
            <Globe className="h-3 w-3 shrink-0" />
            {currencyLabel}
            {config.countryCode ? ` · ${config.countryCode}` : ""}
          </span>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">Number of referrals per month</p>
          <span className="inline-flex min-w-[3.25rem] items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-sm font-bold tabular-nums text-primary-foreground shadow-sm ring-2 ring-primary/20">
            {referrals}
          </span>
        </div>

        <div className="mt-5 affiliate-earnings-slider">
          <Slider
            value={[referrals]}
            min={SLIDER_MIN}
            max={SLIDER_MAX}
            step={1}
            onValueChange={([value]) => setReferrals(value ?? DEFAULT_REFERRALS)}
            aria-label="Number of referrals per month"
          />
          <div className="mt-2 flex justify-between text-[10px] font-medium text-muted-foreground tabular-nums">
            <span>{SLIDER_MIN}</span>
            <span>{SLIDER_MAX}</span>
          </div>
        </div>

        <p className="mt-8 font-display text-4xl sm:text-5xl font-extrabold text-foreground tabular-nums tracking-tight">
          {formatRegionalAmount(yearlyEarnings, currency)}
          <span className="text-2xl sm:text-3xl font-semibold text-muted-foreground">/year</span>
        </p>

        <p className="mt-4 text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-xl">
          *Based on {commissionRatePercent}% commission on the {config.planName} plan (
          {formatRegionalAmount(planMonthly, currency)}/mo per referral →{" "}
          {formatRegionalAmount(monthlyCommissionPerReferral, currency)}/mo to you). Pricing shown in{" "}
          {config.region === "india" ? "Indian rupees" : "US dollars"}
          {config.regionSource === "ip"
            ? " based on your location"
            : config.regionSource === "profile"
              ? " based on your account country"
              : ""}
          . Actual earnings vary with plan, churn, hold period, and refunds.
        </p>
      </div>
    </section>
  );
}
