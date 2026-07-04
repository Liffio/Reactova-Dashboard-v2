import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Mail, ShieldAlert, XCircle } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/page-header";
import { ProtectedRoute } from "@/components/auth/guards";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  approveAdminCreatorApplication,
  listAdminCreatorApplications,
  listAdminCreatorMembers,
  rejectAdminCreatorApplication,
  removeAdminCreatorMember,
  sendAdminCreatorRemovalNotice,
  type AdminCreatorApplication,
} from "@/lib/api/admin-creator-program-api";

export const Route = createFileRoute("/_app/admin/creators")({
  head: () => ({ meta: [{ title: "Creator Program — Admin" }] }),
  component: AdminCreatorsRoute,
});

function AdminCreatorsRoute() {
  return (
    <ProtectedRoute module="creatorProgram">
      <AdminCreatorsPage />
    </ProtectedRoute>
  );
}

const memberStatusStyles: Record<string, string> = {
  ACTIVE: "border-success/30 bg-success/10 text-success",
  WARNED: "border-warning/30 bg-warning/10 text-warning",
  FLAGGED_FOR_OUTREACH: "border-warning/30 bg-warning/10 text-warning",
  NOTICE_SENT: "border-destructive/30 bg-destructive/10 text-destructive",
  REMOVED: "border-border bg-muted text-muted-foreground",
};

function AdminCreatorsPage() {
  const queryClient = useQueryClient();

  const applicationsQuery = useQuery({
    queryKey: ["admin-creator-applications"],
    queryFn: () => listAdminCreatorApplications("PENDING"),
  });
  const membersQuery = useQuery({
    queryKey: ["admin-creator-members"],
    queryFn: () => listAdminCreatorMembers(),
  });

  const invalidateApplications = () =>
    void queryClient.invalidateQueries({ queryKey: ["admin-creator-applications"] });
  const invalidateMembers = () => void queryClient.invalidateQueries({ queryKey: ["admin-creator-members"] });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveAdminCreatorApplication(id),
    onSuccess: () => {
      toast.success("Application approved");
      invalidateApplications();
      invalidateMembers();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const [rejecting, setRejecting] = useState<AdminCreatorApplication | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectAdminCreatorApplication(id, rejectNote || undefined),
    onSuccess: () => {
      toast.success("Application rejected");
      setRejecting(null);
      setRejectNote("");
      invalidateApplications();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const sendNoticeMutation = useMutation({
    mutationFn: (id: string) => sendAdminCreatorRemovalNotice(id),
    onSuccess: () => {
      toast.success("Removal notice sent");
      invalidateMembers();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeAdminCreatorMember(id),
    onSuccess: () => {
      toast.success("Member removed — alumni discount issued");
      invalidateMembers();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const activeMembers = (membersQuery.data ?? []).filter((m) => m.status !== "REMOVED");
  const atRiskCount = activeMembers.filter((m) => m.status !== "ACTIVE").length;

  return (
    <div>
      <PageHeader
        eyebrow="Platform admin"
        title="Creator Program"
        description="Review applications and monitor member compliance."
      />

      <div className="space-y-6 p-4 sm:p-6 md:p-10">
        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Pending applications" value={String(applicationsQuery.data?.length ?? 0)} />
          <StatCard label="Active members" value={String(activeMembers.length)} />
          <StatCard label="Members at risk" value={String(atRiskCount)} icon={ShieldAlert} />
        </section>

        <Tabs defaultValue="applications">
          <TabsList className="mb-4">
            <TabsTrigger value="applications">Applications</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
          </TabsList>

          <TabsContent value="applications">
            <div className="rounded-2xl border bg-card shadow-soft">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-6 py-3 font-medium">Applicant</th>
                      <th className="px-4 py-3 font-medium">Instagram</th>
                      <th className="px-4 py-3 font-medium">Followers</th>
                      <th className="px-4 py-3 font-medium">Niche</th>
                      <th className="px-4 py-3 font-medium hidden lg:table-cell">Why join</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(applicationsQuery.data ?? []).map((a) => (
                      <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30 align-top">
                        <td className="px-6 py-3.5">
                          <div className="font-medium">{a.name}</div>
                          <div className="text-xs text-muted-foreground">{a.email}</div>
                          <div className="text-xs text-muted-foreground">{a.country}</div>
                        </td>
                        <td className="px-4 py-3.5 text-xs">@{a.instagramUsername}</td>
                        <td className="px-4 py-3.5 text-xs">{a.followerRange.replace(/_/g, " ")}</td>
                        <td className="px-4 py-3.5 text-xs">
                          {a.niche === "OTHER" ? a.otherNiche ?? "Other" : a.niche.toLowerCase()}
                          {a.asksForComments && (
                            <div className="mt-1 text-[11px] text-success">Asks for comments</div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 hidden lg:table-cell text-xs text-muted-foreground max-w-xs">
                          {a.whyJoin ?? "—"}
                        </td>
                        <td className="px-6 py-3.5">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 border-success/30 text-success hover:bg-success/10"
                              disabled={approveMutation.isPending}
                              onClick={() => approveMutation.mutate(a.id)}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                              onClick={() => setRejecting(a)}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(applicationsQuery.data ?? []).length === 0 && !applicationsQuery.isLoading && (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-sm text-muted-foreground">
                          No pending applications.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="members">
            <div className="rounded-2xl border bg-card shadow-soft">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-6 py-3 font-medium">Member</th>
                      <th className="px-4 py-3 font-medium">DMs</th>
                      <th className="px-4 py-3 font-medium">Campaigns</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium hidden lg:table-cell">Notice sent</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(membersQuery.data ?? []).map((m) => (
                      <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-6 py-3.5 font-medium">{m.user?.email ?? m.userId}</td>
                        <td className="px-4 py-3.5 tabular-nums text-xs">
                          {m.dmCount}/{m.dmTarget}
                        </td>
                        <td className="px-4 py-3.5 tabular-nums text-xs">
                          {m.campaignCount}/{m.campaignTarget}
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge variant="outline" className={memberStatusStyles[m.status] ?? ""}>
                            {m.status.replace(/_/g, " ").toLowerCase()}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 hidden lg:table-cell text-xs text-muted-foreground">
                          {m.removalNoticeSentAt ? new Date(m.removalNoticeSentAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-6 py-3.5">
                          {m.status !== "REMOVED" && (
                            <div className="flex justify-end gap-2">
                              {(m.status === "FLAGGED_FOR_OUTREACH" || m.status === "WARNED") && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1"
                                  disabled={sendNoticeMutation.isPending}
                                  onClick={() => sendNoticeMutation.mutate(m.id)}
                                >
                                  <Mail className="h-3.5 w-3.5" />
                                  Send notice
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive"
                                disabled={removeMutation.isPending}
                                onClick={() => removeMutation.mutate(m.id)}
                              >
                                Remove
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {(membersQuery.data ?? []).length === 0 && !membersQuery.isLoading && (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-sm text-muted-foreground">
                          No members yet.
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

      <RejectDialog
        application={rejecting}
        note={rejectNote}
        onNoteChange={setRejectNote}
        onOpenChange={(v) => !v && setRejecting(null)}
        onConfirm={() => rejecting && rejectMutation.mutate(rejecting.id)}
        pending={rejectMutation.isPending}
      />
    </div>
  );
}

function RejectDialog({
  application,
  note,
  onNoteChange,
  onOpenChange,
  onConfirm,
  pending,
}: {
  application: AdminCreatorApplication | null;
  note: string;
  onNoteChange: (v: string) => void;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <Dialog open={!!application} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reject application</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {application?.name} won't see a reason for this decision. They can reapply after the cooldown
          period.
        </p>
        <div className="space-y-2">
          <Label>Internal note (optional, admin-only)</Label>
          <Textarea
            rows={3}
            placeholder="Not eligible: low engagement rate"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending ? "Rejecting…" : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
