import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AFFILIATE_COMMISSION_RATE,
  AFFILIATE_PLAN_OPTIONS,
} from "@/lib/affiliateProgramContent";

export function AffiliateProfitCalculator() {
  const [referrals, setReferrals] = useState(10);
  const [planId, setPlanId] = useState<(typeof AFFILIATE_PLAN_OPTIONS)[number]["id"]>("pro");

  const plan = AFFILIATE_PLAN_OPTIONS.find((p) => p.id === planId) ?? AFFILIATE_PLAN_OPTIONS[1];

  const { monthly, yearly } = useMemo(() => {
    const count = Math.max(0, Math.min(500, referrals));
    const monthlyGross = count * plan.monthlyUsd * AFFILIATE_COMMISSION_RATE;
    return {
      monthly: monthlyGross,
      yearly: monthlyGross * 12,
    };
  }, [referrals, plan.monthlyUsd]);

  return (
    <div className="surface-card overflow-hidden">
      <div className="dashboard-panel-head flex-row items-center gap-2">
        <Calculator className="h-4 w-4 text-primary shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-foreground">Profit calculator</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Estimate recurring commission at {AFFILIATE_COMMISSION_RATE * 100}% — actual earnings vary
          </p>
        </div>
      </div>
      <div className="p-4 sm:p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="affiliate-referrals">Active paying referrals</Label>
            <Input
              id="affiliate-referrals"
              type="number"
              min={0}
              max={500}
              value={referrals}
              onChange={(e) => setReferrals(Number(e.target.value) || 0)}
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="affiliate-plan">Average plan price</Label>
            <select
              id="affiliate-plan"
              value={planId}
              onChange={(e) => setPlanId(e.target.value as typeof planId)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {AFFILIATE_PLAN_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label} — ${option.monthlyUsd}/mo
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-inset rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Est. monthly</p>
            <p className="text-2xl font-bold tabular-nums mt-1 text-primary">
              ${monthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="glass-inset rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Est. yearly</p>
            <p className="text-2xl font-bold tabular-nums mt-1">
              ${yearly.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Assumes all referrals stay subscribed for 12 months. Commissions are subject to a hold period,
          chargebacks, and plan changes. Not a guarantee of income.
        </p>
      </div>
    </div>
  );
}
