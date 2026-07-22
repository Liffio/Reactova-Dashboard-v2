import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  ShieldCheck,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformAdminRoute } from "@/components/auth/guards";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { API_BASE } from "@/lib/api/http";
import { authStore } from "@/lib/auth/auth-store";
import {
  approveAdminKyc,
  approveAdminPayout,
  approveAdminReferral,
  getAdminAffiliateOverview,
  listAdminAffiliatePayouts,
  listAdminAffiliates,
  listAdminFlaggedAffiliates,
  listAdminKycQueue,
  markAdminPayoutPaid,
  rejectAdminKyc,
  rejectAdminPayout,
  suspendAdminAffiliate,
  unsuspendAdminAffiliate,
  type AdminKycSubmission,
} from "@/lib/api/admin-affiliate-api";

export const Route = createFileRoute("/_app/admin/affiliates")({
  head: () => ({ meta: [{ title: "Creators Program — Admin" }] }),
  component: AdminAffiliatesRoute,
});

function AdminAffiliatesRoute() {
  return (
    <PlatformAdminRoute>
      <AdminAffiliatesPage />
    </PlatformAdminRoute>
  );
}

async function openKycDocument(fileUrl: string) {
  const token = authStore.getState().accessToken;
  try {
    const res = await fetch(`${API_BASE}${fileUrl}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to load document");
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), "_blank", "noopener,noreferrer");
  } catch {
    toast.error("Could not open document");
  }
}

function AdminAffiliatesPage() {
  const queryClient = useQueryClient();

  const overviewQuery = useQuery({
    queryKey: ["admin-affiliate-overview"],
    queryFn: getAdminAffiliateOverview,
  });
  const listQuery = useQuery({
    queryKey: ["admin-affiliate-list"],
    queryFn: () => listAdminAffiliates(),
  });
  const payoutsQuery = useQuery({
    queryKey: ["admin-affiliate-payouts"],
    queryFn: listAdminAffiliatePayouts,
  });
  const flaggedQuery = useQuery({
    queryKey: ["admin-affiliate-flagged"],
    queryFn: listAdminFlaggedAffiliates,
  });
  const kycQueueQuery = useQuery({
    queryKey: ["admin-affiliate-kyc-queue"],
    queryFn: () => listAdminKycQueue("PENDING_REVIEW"),
  });

  const overview = overviewQuery.data;

  const invalidatePayouts = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-affiliate-payouts"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-affiliate-overview"] });
  };
  const invalidateList = () =>
    void queryClient.invalidateQueries({ queryKey: ["admin-affiliate-list"] });
  const invalidateFlagged = () =>
    void queryClient.invalidateQueries({ queryKey: ["admin-affiliate-flagged"] });
  const invalidateKyc = () =>
    void queryClient.invalidateQueries({ queryKey: ["admin-affiliate-kyc-queue"] });

  const approvePayoutMutation = useMutation({
    mutationFn: (id: string) => approveAdminPayout(id),
    onSuccess: () => {
      toast.success("Payout approved");
      invalidatePayouts();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const rejectPayoutMutation = useMutation({
    mutationFn: (id: string) => rejectAdminPayout(id, "Rejected by admin"),
    onSuccess: () => {
      toast.success("Payout rejected");
      invalidatePayouts();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => markAdminPayoutPaid(id),
    onSuccess: () => {
      toast.success("Payout marked as paid");
      invalidatePayouts();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const suspendMutation = useMutation({
    mutationFn: (id: string) => suspendAdminAffiliate(id, "Suspended by admin"),
    onSuccess: () => {
      toast.success("Affiliate suspended");
      invalidateList();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const unsuspendMutation = useMutation({
    mutationFn: (id: string) => unsuspendAdminAffiliate(id),
    onSuccess: () => {
      toast.success("Affiliate unsuspended");
      invalidateList();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const approveReferralMutation = useMutation({
    mutationFn: (id: string) => approveAdminReferral(id),
    onSuccess: () => {
      toast.success("Referral cleared");
      invalidateFlagged();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const approveKycMutation = useMutation({
    mutationFn: (id: string) => approveAdminKyc(id),
    onSuccess: () => {
      toast.success("KYC approved");
      invalidateKyc();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const [rejectingKyc, setRejectingKyc] = useState<AdminKycSubmission | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const rejectKycMutation = useMutation({
    mutationFn: () => rejectAdminKyc(rejectingKyc!.id, rejectReason),
    onSuccess: () => {
      toast.success("KYC rejected");
      setRejectingKyc(null);
      setRejectReason("");
      invalidateKyc();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Platform admin"
        title="Creators Program"
        description="Manage affiliates, payouts, fraud reviews and KYC approvals."
      />

      <div className="space-y-6 p-4 sm:p-6 md:p-10">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {overviewQuery.isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))
          ) : (
            <>
              <StatCard
                label="Total affiliates"
                value={String(overview?.totalAffiliates ?? 0)}
                icon={Users}
              />
              <StatCard
                label="Total paid out"
                value={`$${Number(overview?.totalPaidOut ?? 0).toFixed(2)}`}
                icon={DollarSign}
              />
              <StatCard
                label="Pending payouts"
                value={String(overview?.pendingPayouts ?? 0)}
                icon={Wallet}
              />
              <StatCard
                label="Flagged referrals"
                value={String(overview?.flaggedReferrals ?? 0)}
                icon={AlertTriangle}
              />
            </>
          )}
        </section>

        <Tabs defaultValue="kyc">
          <TabsList className="mb-4">
            <TabsTrigger value="kyc" className="gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              KYC queue
              {(kycQueueQuery.data?.length ?? 0) > 0 && (
                <Badge
                  variant="outline"
                  className="ml-1 border-warning/30 bg-warning/10 text-warning"
                >
                  {kycQueueQuery.data?.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="payouts">Payouts</TabsTrigger>
            <TabsTrigger value="affiliates">Affiliates</TabsTrigger>
            <TabsTrigger value="fraud">Fraud</TabsTrigger>
          </TabsList>

          <TabsContent value="kyc">
            <div className="rounded-2xl border bg-card shadow-soft">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-6 py-3 font-medium">Affiliate</th>
                      <th className="px-4 py-3 font-medium">Tier</th>
                      <th className="px-4 py-3 font-medium">Documents</th>
                      <th className="px-4 py-3 font-medium">Submitted</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(kycQueueQuery.data ?? []).map((s) => (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-6 py-3.5 font-medium">
                          {s.affiliate?.user?.email ?? s.affiliateProfileId}
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge variant="outline">{s.tier}</Badge>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1.5">
                            {s.documents.map((d, i) => (
                              <button
                                key={i}
                                className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                                onClick={() => void openKycDocument(d.fileUrl)}
                              >
                                {d.type}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground">
                          {new Date(s.submittedAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-3.5">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 border-success/30 text-success hover:bg-success/10"
                              disabled={approveKycMutation.isPending}
                              onClick={() => approveKycMutation.mutate(s.id)}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                              onClick={() => setRejectingKyc(s)}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(kycQueueQuery.data ?? []).length === 0 && !kycQueueQuery.isLoading && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-8 text-center text-sm text-muted-foreground"
                        >
                          No pending KYC submissions.
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
                      <th className="px-4 py-3 font-medium">Requested</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(payoutsQuery.data?.payouts ?? []).map((p) => (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-6 py-3.5 font-medium tabular-nums">
                          ${p.amount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground">{p.method}</td>
                        <td className="px-4 py-3.5">
                          <Badge variant="outline">{p.status}</Badge>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground">
                          {new Date(p.requestedAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-3.5">
                          <div className="flex justify-end gap-2">
                            {p.status === "REQUESTED" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => approvePayoutMutation.mutate(p.id)}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive"
                                  onClick={() => rejectPayoutMutation.mutate(p.id)}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                            {p.status === "APPROVED" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => markPaidMutation.mutate(p.id)}
                              >
                                Mark paid
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(payoutsQuery.data?.payouts ?? []).length === 0 && !payoutsQuery.isLoading && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-8 text-center text-sm text-muted-foreground"
                        >
                          No payouts to review.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="affiliates">
            <div className="rounded-2xl border bg-card shadow-soft">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-6 py-3 font-medium">Affiliate</th>
                      <th className="px-4 py-3 font-medium">Referrals</th>
                      <th className="px-4 py-3 font-medium">Total earned</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(listQuery.data?.affiliates ?? []).map((a) => (
                      <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-6 py-3.5 font-medium">{a.email ?? a.id}</td>
                        <td className="px-4 py-3.5">{a.totalReferrals ?? 0}</td>
                        <td className="px-4 py-3.5 tabular-nums">
                          ${Number(a.totalEarned ?? 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge
                            variant="outline"
                            className={
                              a.isSuspended
                                ? "border-destructive/30 bg-destructive/10 text-destructive"
                                : "border-success/30 bg-success/10 text-success"
                            }
                          >
                            {a.isSuspended ? "Suspended" : "Active"}
                          </Badge>
                        </td>
                        <td className="px-6 py-3.5">
                          <div className="flex justify-end">
                            {a.isSuspended ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => unsuspendMutation.mutate(a.id)}
                              >
                                Unsuspend
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive"
                                onClick={() => suspendMutation.mutate(a.id)}
                              >
                                Suspend
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(listQuery.data?.affiliates ?? []).length === 0 && !listQuery.isLoading && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-8 text-center text-sm text-muted-foreground"
                        >
                          No affiliates yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="fraud">
            <div className="rounded-2xl border bg-card shadow-soft">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-6 py-3 font-medium">Affiliate</th>
                      <th className="px-4 py-3 font-medium">Referred user</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(flaggedQuery.data?.flagged ?? []).map((f) => (
                      <tr key={f.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-6 py-3.5 font-medium">{f.email ?? f.id}</td>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground">
                          {String(
                            (f as { referredUser?: { email?: string } }).referredUser?.email ?? "—",
                          )}
                        </td>
                        <td className="px-6 py-3.5">
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => approveReferralMutation.mutate(f.id)}
                            >
                              Clear flag
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(flaggedQuery.data?.flagged ?? []).length === 0 && !flaggedQuery.isLoading && (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-6 py-8 text-center text-sm text-muted-foreground"
                        >
                          No flagged referrals.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!rejectingKyc} onOpenChange={(v) => !v && setRejectingKyc(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject KYC submission</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Document unreadable"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingKyc(null)}>
              Cancel
            </Button>
            <Button
              disabled={!rejectReason.trim() || rejectKycMutation.isPending}
              onClick={() => rejectKycMutation.mutate()}
            >
              {rejectKycMutation.isPending ? "Rejecting…" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
