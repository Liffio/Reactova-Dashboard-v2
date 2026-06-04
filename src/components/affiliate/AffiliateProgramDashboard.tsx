import { useState } from "react";
import { DollarSign, Clock, Users, Wallet } from "lucide-react";
import { PageMetricCard } from "@/components/page/PageMetricCard";
import { Button } from "@/components/ui/button";
import { CopyField } from "@/components/CopyButton";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AFFILIATE_MIN_PAYOUT_USD } from "@/lib/affiliateProgramContent";
import {
  useAffiliateDashboard,
  useAffiliateLinks,
  useAffiliatePayouts,
  useAffiliateProfile,
  useAffiliateReferrals,
  useRequestAffiliatePayout,
  useSetCustomAffiliateCode,
} from "@/hooks/useAffiliate";

export function AffiliateProgramDashboard() {
  const { data: dashboard, isLoading } = useAffiliateDashboard();
  const { data: links } = useAffiliateLinks();
  const { data: profile } = useAffiliateProfile();
  const { data: referrals } = useAffiliateReferrals();
  const { data: payouts } = useAffiliatePayouts();
  const saveCustomCode = useSetCustomAffiliateCode();
  const requestPayout = useRequestAffiliatePayout();
  const [customCode, setCustomCode] = useState("");
  const balance = dashboard?.availableBalance ?? 0;
  const shareLink = links?.customLink ?? links?.randomLink ?? "";

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="p-5 surface-card">
        <div className="text-xs text-muted-foreground mb-2">Your referral link</div>
        <CopyField value={isLoading ? "Loading…" : shareLink} />
        <p className="text-xs text-muted-foreground mt-2">
          Referred users get 10% off their first payment. You earn 50% of every recurring payment while
          they stay subscribed.
        </p>
        <div className="mt-4 flex flex-col sm:flex-row gap-2 items-end">
          <div className="flex-1 space-y-1 w-full">
            <label className="text-xs text-muted-foreground">Custom code (optional, one per account)</label>
            <Input
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value)}
              placeholder={profile?.customCode ?? "yourname"}
            />
          </div>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            disabled={saveCustomCode.isPending || !customCode.trim()}
            onClick={() => saveCustomCode.mutate(customCode.trim())}
          >
            Save custom code
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <PageMetricCard
          icon={DollarSign}
          label="Total earned"
          value={`$${(dashboard?.totalEarned ?? 0).toFixed(2)}`}
          loading={isLoading}
        />
        <PageMetricCard
          icon={Wallet}
          label="Available balance"
          value={`$${balance.toFixed(2)}`}
          loading={isLoading}
          highlight
        />
        <PageMetricCard
          icon={Clock}
          label="Pending / hold"
          value={`$${(dashboard?.pendingBalance ?? 0).toFixed(2)}`}
          sub="20-day hold on new commissions"
          loading={isLoading}
        />
        <PageMetricCard
          icon={Users}
          label="Active referrals"
          value={dashboard?.activeReferrals ?? 0}
          loading={isLoading}
        />
      </div>

      <div className="p-5 surface-card flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Withdrawal</div>
          <div className="text-xs text-muted-foreground">
            Minimum ${AFFILIATE_MIN_PAYOUT_USD} · Manual review · Paid within 7 business days
          </div>
        </div>
        <Button
          disabled={balance < AFFILIATE_MIN_PAYOUT_USD || requestPayout.isPending || profile?.isSuspended}
          onClick={() =>
            requestPayout.mutate({
              amount: balance,
              payoutMethod: "paypal",
              payoutDetails: { email: "" },
            })
          }
        >
          Request withdrawal
        </Button>
      </div>

      <AffiliateTable title="Referral history" cols={["Referred user", "Status", "Attributed"]}>
        {(referrals ?? []).map((r) => (
          <tr key={r.id} className="stripe-row">
            <td className="px-5 py-3 font-mono text-xs">{r.email}</td>
            <td className="px-5 py-3">
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-[11px] font-medium border",
                  r.isActive
                    ? "bg-success/15 text-success border-success/30"
                    : "bg-muted text-muted-foreground border-border"
                )}
              >
                {r.isActive ? "Active" : "Lost"}
              </span>
            </td>
            <td className="px-5 py-3 text-muted-foreground">
              {new Date(r.attributedAt).toLocaleDateString()}
            </td>
          </tr>
        ))}
        {!referrals?.length && (
          <tr>
            <td colSpan={3} className="px-5 py-6 text-muted-foreground text-sm">
              No referrals yet — share your link to get started.
            </td>
          </tr>
        )}
      </AffiliateTable>

      <AffiliateTable title="Recent commissions" cols={["Workspace", "Amount", "Status", "Date"]}>
        {(dashboard?.recentCommissions ?? []).map((c) => (
          <tr key={c.id} className="stripe-row">
            <td className="px-5 py-3">{c.workspace}</td>
            <td className="px-5 py-3 font-mono">${c.amount.toFixed(2)}</td>
            <td className="px-5 py-3">{c.status}</td>
            <td className="px-5 py-3 text-muted-foreground">
              {new Date(c.createdAt).toLocaleDateString()}
            </td>
          </tr>
        ))}
      </AffiliateTable>

      <AffiliateTable title="Payout history" cols={["Date", "Amount", "Method", "Status"]}>
        {(payouts ?? []).map((p) => (
          <tr key={p.id} className="stripe-row">
            <td className="px-5 py-3">{new Date(p.requestedAt).toLocaleDateString()}</td>
            <td className="px-5 py-3 font-mono">${p.amount.toFixed(2)}</td>
            <td className="px-5 py-3 text-muted-foreground">{p.method}</td>
            <td className="px-5 py-3">{p.status}</td>
          </tr>
        ))}
      </AffiliateTable>
    </div>
  );
}

function AffiliateTable({
  title,
  cols,
  children,
}: {
  title: string;
  cols: string[];
  children: React.ReactNode;
}) {
  return (
    <section className="surface-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border/40">
        <h2 className="font-semibold text-sm">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-border/40">
              {cols.map((c) => (
                <th key={c} className="px-5 py-3 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </section>
  );
}
