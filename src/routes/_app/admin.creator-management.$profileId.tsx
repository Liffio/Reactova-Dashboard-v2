import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  ShieldAlert,
  Stethoscope,
  StickyNote,
  Trash2,
  Wallet,
  XCircle,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "@/lib/toast";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformAdminRoute } from "@/components/auth/guards";
import { PageErrorBoundary } from "@/components/error-boundary";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuthState } from "@/lib/auth/auth-store";
import {
  addAdminCreatorNote,
  approveAdminCreatorApplication,
  changeAdminCreatorPlan,
  forceEligibilityCheckAdminCreator,
  forceHealthCheckAdminCreator,
  forceMetricsSyncAdminCreator,
  getAdminCreatorDetail,
  pauseAdminCreator,
  reactivateAdminCreator,
  rejectAdminCreatorApplication,
  removeAdminCreator,
  type AdminCreatorDetail,
  type CreatorPlanTier,
} from "@/lib/api/admin-creator-eligibility-api";
import { reasonLabel } from "@/lib/creator-eligibility-copy";
import { MetricsPanel, OverridePanel, stateStyles } from "@/components/admin/creator-detail-shared";

export const Route = createFileRoute("/_app/admin/creator-management/$profileId")({
  head: () => ({ meta: [{ title: "Creator detail — Management" }] }),
  component: AdminCreatorManagementDetailRoute,
});

function AdminCreatorManagementDetailRoute() {
  return (
    <PlatformAdminRoute>
      <PageErrorBoundary label="admin-creator-management-detail">
        <AdminCreatorManagementDetailPage />
      </PageErrorBoundary>
    </PlatformAdminRoute>
  );
}

const PLAN_TIERS: CreatorPlanTier[] = ["FREE", "STARTER", "PRO", "BUSINESS", "AGENCY"];

function AdminCreatorManagementDetailPage() {
  const { profileId } = Route.useParams();
  const queryClient = useQueryClient();
  const isSuperAdmin = useAuthState((s) => s.isPlatformSuperAdmin);

  const detailQuery = useQuery({
    queryKey: ["admin-creator-management-detail", profileId],
    queryFn: () => getAdminCreatorDetail(profileId),
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({
      queryKey: ["admin-creator-management-detail", profileId],
    });

  const detail = detailQuery.data;
  const pendingApplication = detail?.applications.find((a) => a.state === "PendingReview");

  return (
    <div>
      <PageHeader
        eyebrow="Platform admin — Creator Management"
        title={detail?.userName || detail?.userEmail || "Creator detail"}
        description={detail?.userEmail}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <Link to="/admin/creator-management">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to creators
            </Link>
          </Button>
        }
      />

      <div className="space-y-6 p-4 sm:p-6 md:p-10">
        {detailQuery.isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        )}

        {detailQuery.isError && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center text-sm text-muted-foreground">
            {(detailQuery.error as Error)?.message || "Creator not found."}
          </div>
        )}

        {detail && (
          <>
            {detail.removed.removedAt && (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
                <p className="font-medium text-destructive">Removed from Creator Program</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(detail.removed.removedAt).toLocaleString()} —{" "}
                  {detail.removed.removedReason}
                </p>
              </div>
            )}

            <ActionsBar
              detail={detail}
              pendingApplicationId={pendingApplication?.id}
              isSuperAdmin={isSuperAdmin}
              onChanged={invalidate}
            />

            <StatusAndProgress detail={detail} />
            <MetricsPanel detail={detail} />
            <MetricsHistoryChart rows={detail.metricsHistory} />
            <ApplicationHistory applications={detail.applications} />
            <Timeline entries={detail.timeline} />
            <NotesPanel profileId={profileId} notes={detail.notes} onChanged={invalidate} />
            <OverridePanel
              profileId={profileId}
              override={detail.override}
              isSuperAdmin={isSuperAdmin}
              onChanged={invalidate}
            />
          </>
        )}
      </div>
    </div>
  );
}

function ActionsBar({
  detail,
  pendingApplicationId,
  isSuperAdmin,
  onChanged,
}: {
  detail: AdminCreatorDetail;
  pendingApplicationId: string | undefined;
  isSuperAdmin: boolean;
  onChanged: () => void;
}) {
  const [removeReason, setRemoveReason] = useState("");
  const [removeOpen, setRemoveOpen] = useState(false);
  const [plan, setPlan] = useState<CreatorPlanTier | "">("");

  const approveMutation = useMutation({
    mutationFn: () => approveAdminCreatorApplication(pendingApplicationId!),
    onSuccess: () => {
      toast.success("Application approved");
      onChanged();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const rejectMutation = useMutation({
    mutationFn: () => rejectAdminCreatorApplication(pendingApplicationId!),
    onSuccess: () => {
      toast.success("Application rejected");
      onChanged();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const pauseMutation = useMutation({
    mutationFn: () => pauseAdminCreator(detail.id),
    onSuccess: () => {
      toast.success("Creator paused");
      onChanged();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const reactivateMutation = useMutation({
    mutationFn: () => reactivateAdminCreator(detail.id),
    onSuccess: (res) => {
      if (res.reactivated) {
        toast.success("Creator reactivated");
      } else {
        toast.warning(`Reactivation blocked: ${reasonLabel(res.reason)}`);
      }
      onChanged();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const forceEligibilityMutation = useMutation({
    mutationFn: () => forceEligibilityCheckAdminCreator(detail.id),
    onSuccess: (res) => {
      if (res.pass) {
        toast.success(`Passes eligibility (score ${res.score})`);
      } else {
        toast.warning(`Fails eligibility: ${reasonLabel(res.reason)}`);
      }
      onChanged();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const forceHealthMutation = useMutation({
    mutationFn: () => forceHealthCheckAdminCreator(detail.id),
    onSuccess: (res) => {
      if (res.skipped) {
        toast.info("Skipped — Health Engine override is active");
      } else if (res.conditions && res.conditions.length > 0) {
        toast.warning(`Unresolved conditions: ${res.conditions.map(reasonLabel).join(", ")}`);
      } else {
        toast.success("Health check passed — no unresolved conditions");
      }
      onChanged();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const forceSyncMutation = useMutation({
    mutationFn: () => forceMetricsSyncAdminCreator(detail.id),
    onSuccess: () => {
      toast.success("Metrics sync triggered");
      onChanged();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const removeMutation = useMutation({
    mutationFn: () => removeAdminCreator(detail.id, removeReason),
    onSuccess: () => {
      toast.success("Removed from Creator Program");
      setRemoveOpen(false);
      setRemoveReason("");
      onChanged();
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const planMutation = useMutation({
    mutationFn: () => changeAdminCreatorPlan(detail.id, plan as CreatorPlanTier),
    onSuccess: (res) => {
      toast.success(`Plan changed: ${res.before} → ${res.after}`);
      setPlan("");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const canForceEligibility = detail.state === "NotEligible" || detail.state === "Eligible";
  const canForceHealth = detail.state === "Active" || detail.state === "NeedsAttention";
  const canPause = detail.state === "Active" || detail.state === "NeedsAttention";
  const canReactivate = detail.state === "Paused";
  const anyPending =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    pauseMutation.isPending ||
    reactivateMutation.isPending ||
    forceEligibilityMutation.isPending ||
    forceHealthMutation.isPending ||
    forceSyncMutation.isPending;

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
      <h2 className="font-display text-lg font-semibold">Admin actions</h2>

      {pendingApplicationId && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3">
          <span className="text-sm">This creator has a pending application.</span>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-success/30 text-success hover:bg-success/10"
            disabled={anyPending}
            onClick={() => approveMutation.mutate()}
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
            disabled={anyPending}
            onClick={() => rejectMutation.mutate()}
          >
            <XCircle className="h-3.5 w-3.5" /> Reject
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {canPause && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={anyPending}
            onClick={() => pauseMutation.mutate()}
          >
            <PauseCircle className="h-3.5 w-3.5" /> Pause
          </Button>
        )}
        {canReactivate && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={anyPending}
            onClick={() => reactivateMutation.mutate()}
          >
            <PlayCircle className="h-3.5 w-3.5" /> Reactivate
          </Button>
        )}
        {canForceEligibility && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={anyPending}
            onClick={() => forceEligibilityMutation.mutate()}
          >
            <ShieldAlert className="h-3.5 w-3.5" /> Force eligibility check
          </Button>
        )}
        {canForceHealth && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={anyPending}
            onClick={() => forceHealthMutation.mutate()}
          >
            <Stethoscope className="h-3.5 w-3.5" /> Force health check
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={anyPending}
          onClick={() => forceSyncMutation.mutate()}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Force metrics sync
        </Button>
      </div>

      {isSuperAdmin && (
        <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs">
              Change plan (Super Admin — stopgap, no billing integration)
            </Label>
            <div className="flex gap-2">
              <Select value={plan} onValueChange={(v) => setPlan(v as CreatorPlanTier)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_TIERS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 shrink-0"
                disabled={!plan || planMutation.isPending}
                onClick={() => planMutation.mutate()}
              >
                <Wallet className="h-3.5 w-3.5" /> {planMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Remove Creator Program access (Super Admin)</Label>
            <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-1.5"
                  disabled={!!detail.removed.removedAt}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove creator
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove Creator Program access?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This does <strong>not</strong> delete the user's account — only their Creator
                    Program standing. A reason is required and is permanently logged.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                  <Label className="text-xs">Reason (required)</Label>
                  <Textarea
                    rows={2}
                    value={removeReason}
                    onChange={(e) => setRemoveReason(e.target.value)}
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={!removeReason.trim() || removeMutation.isPending}
                    onClick={(e) => {
                      e.preventDefault();
                      removeMutation.mutate();
                    }}
                  >
                    {removeMutation.isPending ? "Removing…" : "Confirm removal"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
      {!isSuperAdmin && (
        <p className="border-t pt-4 text-xs text-muted-foreground">
          Change plan and Remove creator require Super Admin.
        </p>
      )}
    </div>
  );
}

function StatusAndProgress({ detail }: { detail: AdminCreatorDetail }) {
  const p = detail.progress;
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Profile status</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            State since {new Date(detail.stateSince).toLocaleDateString()}
          </p>
        </div>
        <Badge variant="outline" className={stateStyles[detail.state] ?? ""}>
          {detail.state}
        </Badge>
      </div>

      {detail.primaryReason && (
        <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <p className="font-medium">Primary: {reasonLabel(detail.primaryReason)}</p>
            {detail.secondaryReasons.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Also unresolved: {detail.secondaryReasons.map(reasonLabel).join(", ")}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <div>Eligibility algorithm: {detail.eligibilityAlgorithmVersion}</div>
        <div>Health algorithm: {detail.healthAlgorithmVersion}</div>
      </div>

      <div className="space-y-3 border-t pt-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Monthly usage</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Automated DMs</span>
            <span className="tabular-nums">
              {p.dmCount} / {p.dmTarget}
            </span>
          </div>
          <Progress value={Math.min(100, (p.dmCount / Math.max(1, p.dmTarget)) * 100)} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Active automations</span>
            <span className="tabular-nums">
              {p.automationCount} / {p.automationTarget}
            </span>
          </div>
          <Progress
            value={Math.min(100, (p.automationCount / Math.max(1, p.automationTarget)) * 100)}
          />
        </div>
      </div>
    </div>
  );
}

function readNum(row: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "number") return v;
  }
  return null;
}
function readStr(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string") return v;
  }
  return null;
}

function MetricsHistoryChart({ rows }: { rows: Array<Record<string, unknown>> }) {
  const points = rows
    .map((r) => ({
      at: readStr(
        r,
        "recordedAt",
        "recorded_at",
        "createdAt",
        "created_at",
        "syncedAt",
        "synced_at",
      ),
      followers: readNum(r, "followerCount", "follower_count"),
      engagement: readNum(r, "engagementRate", "engagement_rate"),
    }))
    .filter((p) => p.at)
    .sort((a, b) => new Date(a.at!).getTime() - new Date(b.at!).getTime())
    .map((p) => ({ ...p, label: new Date(p.at!).toLocaleDateString() }));

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-soft">
      <h2 className="font-display text-lg font-semibold mb-1">Metrics history</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Row shape isn't formally pinned down by ENDPOINT-CONTRACT.md §6.2 beyond
        "creator_metrics_history rows" — rendered defensively; missing fields are simply omitted
        from the chart.
      </p>
      {points.length === 0 ? (
        <p className="text-sm text-muted-foreground">No metrics history yet.</p>
      ) : (
        <div className="w-full aspect-[16/6] min-h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={40} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                }}
              />
              <Line
                type="monotone"
                dataKey="followers"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                name="Followers"
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="engagement"
                stroke="hsl(var(--success))"
                strokeWidth={2}
                dot={false}
                name="Engagement rate"
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function ApplicationHistory({
  applications,
}: {
  applications: AdminCreatorDetail["applications"];
}) {
  return (
    <div className="rounded-2xl border bg-card shadow-soft">
      <h2 className="font-display text-lg font-semibold p-6 pb-0">Application history</h2>
      <div className="overflow-x-auto p-6 pt-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Submitted</th>
              <th className="py-2 pr-4 font-medium">State</th>
              <th className="py-2 pr-4 font-medium">Reason</th>
              <th className="py-2 pr-4 font-medium">Score</th>
              <th className="py-2 pr-4 font-medium">Algorithm</th>
              <th className="py-2 font-medium">Reviewed</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((a) => (
              <tr key={a.id} className="border-b last:border-0">
                <td className="py-2.5 pr-4">{new Date(a.submittedAt).toLocaleDateString()}</td>
                <td className="py-2.5 pr-4">
                  <Badge variant="outline">{a.state}</Badge>
                </td>
                <td className="py-2.5 pr-4">{reasonLabel(a.reason)}</td>
                <td className="py-2.5 pr-4 tabular-nums">{a.score}</td>
                <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                  {a.scoreAlgorithmVersion}
                </td>
                <td className="py-2.5 text-xs text-muted-foreground">
                  {a.reviewedAt ? new Date(a.reviewedAt).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
            {applications.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                  No applications on file.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Timeline({ entries }: { entries: AdminCreatorDetail["timeline"] }) {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-soft">
      <h2 className="font-display text-lg font-semibold mb-4">Activity timeline</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No events yet.</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((e, i) => {
            const label =
              readStr(e.data, "type", "eventType", "decision") ??
              (e.type === "audit" ? "Audit entry" : "Event");
            return (
              <li key={i} className="flex items-start gap-3 text-sm">
                <Badge variant="outline" className="mt-0.5 shrink-0 text-[10px] uppercase">
                  {e.type}
                </Badge>
                <div>
                  <p className="font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{new Date(e.at).toLocaleString()}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function NotesPanel({
  profileId,
  notes,
  onChanged,
}: {
  profileId: string;
  notes: AdminCreatorDetail["notes"];
  onChanged: () => void;
}) {
  const [note, setNote] = useState("");
  const mutation = useMutation({
    mutationFn: () => addAdminCreatorNote(profileId, note),
    onSuccess: () => {
      setNote("");
      onChanged();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-soft">
      <div className="flex items-center gap-2 mb-4">
        <StickyNote className="h-4.5 w-4.5 text-primary" />
        <h2 className="font-display text-lg font-semibold">Internal notes</h2>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">Admin-only — never shown to the creator.</p>

      <div className="space-y-3 mb-4">
        {notes.map((n) => (
          <div key={n.id} className="rounded-lg border bg-muted/30 p-3 text-sm">
            <p>{n.note}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(n.createdAt).toLocaleString()}
            </p>
          </div>
        ))}
        {notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
      </div>

      <div className="flex gap-2">
        <Textarea
          rows={2}
          placeholder="Add an internal note…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <Button
          size="sm"
          className="shrink-0"
          disabled={!note.trim() || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Saving…" : "Add"}
        </Button>
      </div>
    </div>
  );
}
