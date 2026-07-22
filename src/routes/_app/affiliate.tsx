import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, DollarSign, TrendingUp, Users, Wallet } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/page-header";
import { ProtectedRoute } from "@/components/auth/guards";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AffiliateOnboarding } from "@/components/affiliate/affiliate-onboarding";
import { AffiliateConsentDialog } from "@/components/affiliate/affiliate-consent-dialog";
import { AffiliateKycPanel } from "@/components/affiliate/affiliate-kyc-panel";
import {
  getAffiliateDashboard,
  getAffiliateLinks,
  getAffiliateProfile,
  listAffiliatePayouts,
  listAffiliateReferrals,
  requestAffiliatePayout,
  setCustomAffiliateCode,
} from "@/lib/api/affiliate-api";
import { LIMITS } from "@/lib/validation";

export const Route = createFileRoute("/_app/affiliate")({
  head: () => ({ meta: [{ title: "Affiliate Program — Liffio" }] }),
  component: AffiliateRoute,
});

function AffiliateRoute() {
  return (
    <ProtectedRoute module="affiliate">
      <AffiliatePage />
    </ProtectedRoute>
  );
}

const commissionStatusStyles: Record<string, string> = {
  PENDING: "border-warning/30 bg-warning/10 text-warning",
  AVAILABLE: "border-success/30 bg-success/10 text-success",
  PAID: "border-border bg-muted text-muted-foreground",
  REJECTED: "border-destructive/30 bg-destructive/10 text-destructive",
  CLAWED_BACK: "border-destructive/30 bg-destructive/10 text-destructive",
};

function AffiliatePage() {
  const queryClient = useQueryClient();
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [customCodeOpen, setCustomCodeOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["affiliate-profile"],
    queryFn: getAffiliateProfile,
  });

  const dashboardQuery = useQuery({
    queryKey: ["affiliate-dashboard"],
    queryFn: getAffiliateDashboard,
    enabled: profileQuery.data?.hasProgramConsent === true,
  });

  const linksQuery = useQuery({
    queryKey: ["affiliate-links"],
    queryFn: getAffiliateLinks,
    enabled: profileQuery.data?.hasProgramConsent === true,
  });

  const referralsQuery = useQuery({
    queryKey: ["affiliate-referrals"],
    queryFn: listAffiliateReferrals,
    enabled: profileQuery.data?.hasProgramConsent === true,
  });

  const payoutsQuery = useQuery({
    queryKey: ["affiliate-payouts"],
    queryFn: listAffiliatePayouts,
    enabled: profileQuery.data?.hasProgramConsent === true,
  });

  const profile = profileQuery.data;
  const dash = dashboardQuery.data;
  const links = linksQuery.data;
  const hasConsent = profile?.hasProgramConsent;

  if (profileQuery.isLoading) {
    return (
      <div className="p-10 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (!hasConsent) {
    return (
      <div>
        <PageHeader
          eyebrow="Account"
          title="Affiliate Program"
          description="Earn 50% recurring commission for every customer you refer."
        />
        <div className="p-4 sm:p-6 md:p-10">
          <AffiliateOnboarding onGetStarted={() => setConsentOpen(true)} />
        </div>
        <AffiliateConsentDialog
          open={consentOpen}
          onOpenChange={setConsentOpen}
          onAccepted={() => void queryClient.invalidateQueries({ queryKey: ["affiliate-profile"] })}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="Affiliate Program"
        description="Track your referrals, commissions and payouts."
        actions={
          <Button
            size="sm"
            className="gap-1.5 bg-brand-gradient text-primary-foreground shadow-glow hover:opacity-95"
            disabled={(dash?.availableBalance ?? 0) === 0}
            onClick={() => setPayoutOpen(true)}
          >
            <Wallet className="h-4 w-4" />
            Request payout
          </Button>
        }
      />

      <div className="space-y-6 p-4 sm:p-6 md:p-10">
        {/* Stats */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {dashboardQuery.isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))
          ) : (
            <>
              <StatCard
                label="Total earned"
                value={`$${(dash?.totalEarned ?? 0).toFixed(2)}`}
                icon={DollarSign}
              />
              <StatCard
                label="Available balance"
                value={`$${(dash?.availableBalance ?? 0).toFixed(2)}`}
                icon={Wallet}
                hint={`$${(dash?.pendingBalance ?? 0).toFixed(2)} pending`}
              />
              <StatCard
                label="Total referrals"
                value={String(dash?.totalReferrals ?? 0)}
                icon={Users}
                hint={`${dash?.activeReferrals ?? 0} active`}
              />
              <StatCard
                label="Lifetime paid"
                value={`$${(dash?.lifetimePaid ?? 0).toFixed(2)}`}
                icon={TrendingUp}
              />
            </>
          )}
        </section>

        {/* Referral links */}
        <div className="rounded-2xl border bg-card p-6 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold">Your referral links</h2>
            <Button size="sm" variant="outline" onClick={() => setCustomCodeOpen(true)}>
              Custom code
            </Button>
          </div>
          {linksQuery.isLoading ? (
            <Skeleton className="h-20" />
          ) : (
            <div className="space-y-3">
              {[
                { label: "Referral link", url: links?.randomLink },
                ...(links?.customLink ? [{ label: "Custom link", url: links.customLink }] : []),
              ].map(({ label, url }) =>
                url ? (
                  <div key={label} className="flex items-center gap-2">
                    <div className="flex-1 rounded-lg border bg-muted/50 px-3 py-2 font-mono text-xs truncate">
                      {url}
                    </div>
                    <button
                      className="rounded-md border p-2 hover:bg-muted"
                      title="Copy"
                      onClick={() => {
                        void navigator.clipboard.writeText(url);
                        toast.success(`${label} copied!`);
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null,
              )}
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Code:{" "}
            <span className="font-mono font-medium">
              {profile?.customCode ?? profile?.randomCode}
            </span>
          </p>
        </div>

        {/* Tabs: referrals / commissions / payouts */}
        <Tabs defaultValue="referrals">
          <TabsList className="mb-4">
            <TabsTrigger value="referrals">Referrals</TabsTrigger>
            <TabsTrigger value="commissions">Commissions</TabsTrigger>
            <TabsTrigger value="payouts">Payouts</TabsTrigger>
            <TabsTrigger value="verification">Verification</TabsTrigger>
          </TabsList>

          <TabsContent value="referrals">
            <div className="rounded-2xl border bg-card shadow-soft">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-6 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium hidden md:table-cell">Plan</th>
                      <th className="px-6 py-3 font-medium">Referred</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(referralsQuery.data ?? []).map((r) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-6 py-3.5 font-medium">{r.email}</td>
                        <td className="px-4 py-3.5">
                          <Badge
                            variant="outline"
                            className={
                              r.isActive
                                ? "border-success/30 bg-success/10 text-success"
                                : "border-border bg-muted text-muted-foreground"
                            }
                          >
                            {r.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 hidden md:table-cell text-xs text-muted-foreground">
                          {r.workspaces.map((w) => w.plan).join(", ") || "—"}
                        </td>
                        <td className="px-6 py-3.5 text-xs text-muted-foreground">
                          {new Date(r.attributedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                    {(referralsQuery.data ?? []).length === 0 && !referralsQuery.isLoading && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-6 py-8 text-center text-sm text-muted-foreground"
                        >
                          No referrals yet. Share your link to start earning.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="commissions">
            <div className="rounded-2xl border bg-card shadow-soft">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-6 py-3 font-medium">Workspace</th>
                      <th className="px-4 py-3 font-medium">Plan</th>
                      <th className="px-4 py-3 font-medium">Amount</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dash?.recentCommissions ?? []).map((c) => (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-6 py-3.5 text-muted-foreground">{c.workspace}</td>
                        <td className="px-4 py-3.5 capitalize text-xs">{c.plan.toLowerCase()}</td>
                        <td className="px-4 py-3.5 tabular-nums font-medium">
                          ${c.amount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge
                            variant="outline"
                            className={commissionStatusStyles[c.status] ?? ""}
                          >
                            {c.status.toLowerCase()}
                          </Badge>
                        </td>
                        <td className="px-6 py-3.5 text-xs text-muted-foreground">
                          {new Date(c.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                    {(dash?.recentCommissions ?? []).length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-8 text-center text-sm text-muted-foreground"
                        >
                          No commissions yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="payouts">
            <div className="rounded-2xl border bg-card shadow-soft">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-6 py-3 font-medium">Amount</th>
                      <th className="px-4 py-3 font-medium">Method</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">Requested</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(payoutsQuery.data ?? []).map((p) => (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-6 py-3.5 font-medium tabular-nums">
                          ${p.amount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3.5 capitalize text-xs text-muted-foreground">
                          {p.method.replace(/_/g, " ").toLowerCase()}
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge
                            variant="outline"
                            className={commissionStatusStyles[p.status] ?? ""}
                          >
                            {p.status.toLowerCase()}
                          </Badge>
                        </td>
                        <td className="px-6 py-3.5 text-xs text-muted-foreground">
                          {new Date(p.requestedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                    {(payoutsQuery.data ?? []).length === 0 && !payoutsQuery.isLoading && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-6 py-8 text-center text-sm text-muted-foreground"
                        >
                          No payouts yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="verification">
            <AffiliateKycPanel />
          </TabsContent>
        </Tabs>
      </div>

      <PayoutDialog
        open={payoutOpen}
        onOpenChange={setPayoutOpen}
        availableBalance={dash?.availableBalance ?? 0}
        onSuccess={() => {
          void queryClient.invalidateQueries({ queryKey: ["affiliate-dashboard"] });
          void queryClient.invalidateQueries({ queryKey: ["affiliate-payouts"] });
        }}
      />

      <CustomCodeDialog
        open={customCodeOpen}
        onOpenChange={setCustomCodeOpen}
        currentCode={profile?.customCode ?? ""}
        onSuccess={() => {
          void queryClient.invalidateQueries({ queryKey: ["affiliate-profile"] });
          void queryClient.invalidateQueries({ queryKey: ["affiliate-links"] });
        }}
      />
    </div>
  );
}

function PayoutDialog({
  open,
  onOpenChange,
  availableBalance,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  availableBalance: number;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState(String(Math.floor(availableBalance)));
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [details, setDetails] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      requestAffiliatePayout({
        amount: parseFloat(amount),
        payoutMethod: method,
        payoutDetails: { details },
      }),
    onSuccess: () => {
      toast.success("Payout requested");
      onSuccess();
      onOpenChange(false);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request payout</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Amount (USD)</Label>
            <Input
              type="number"
              min="50"
              max={availableBalance}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Available: ${availableBalance.toFixed(2)} · Minimum payout: $50
            </p>
          </div>
          <div className="space-y-2">
            <Label>Payout method</Label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="PAYPAL">PayPal</option>
              <option value="WISE">Wise</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Payment details</Label>
            <Input
              placeholder="Account number, email, etc."
              value={details}
              onChange={(e) => setDetails(e.target.value.slice(0, LIMITS.genericNote.max))}
              maxLength={LIMITS.genericNote.max}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={mutation.isPending || parseFloat(amount) < 50 || !details}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Requesting…" : "Request payout"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CustomCodeDialog({
  open,
  onOpenChange,
  currentCode,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentCode: string;
  onSuccess: () => void;
}) {
  const [code, setCode] = useState(currentCode);

  const mutation = useMutation({
    mutationFn: () => setCustomAffiliateCode(code),
    onSuccess: () => {
      toast.success("Custom code updated");
      onSuccess();
      onOpenChange(false);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Custom referral code</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Code (3–20 chars, letters + numbers)</Label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            placeholder="my-brand"
            maxLength={20}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={mutation.isPending || code.length < 3}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
