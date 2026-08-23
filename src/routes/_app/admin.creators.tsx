import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Gauge,
  Pencil,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { toast } from "@/lib/toast";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformAdminRoute } from "@/components/auth/guards";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  approveAdminCreatorApplication,
  getAdminAuditLog,
  getAdminCreatorApplication,
  getAdminCreatorOverview,
  getAdminCreatorSettings,
  listAdminCreatorApplications,
  listAdminWaitlist,
  rejectAdminCreatorApplication,
  updateAdminCreatorSettings,
  type AdminApplicationDetail,
  type AdminApplicationListItem,
  type AdminCreatorSettings,
  type AuditLogEntry,
} from "@/lib/api/admin-creator-eligibility-api";
import { reasonLabel } from "@/lib/creator-eligibility-copy";
import { formatHandle } from "@/lib/format";

export const Route = createFileRoute("/_app/admin/creators")({
  head: () => ({ meta: [{ title: "Creator Program — Admin" }] }),
  component: AdminCreatorsRoute,
});

function AdminCreatorsRoute() {
  return (
    <PlatformAdminRoute>
      <AdminCreatorsPage />
    </PlatformAdminRoute>
  );
}

function AdminCreatorsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Platform admin"
        title="Creator Program"
        description="Review applications, monitor capacity, and manage creator health overrides."
      />
      <div className="space-y-6 p-4 sm:p-6 md:p-10">
        <Tabs defaultValue="queue">
          <TabsList className="mb-4">
            <TabsTrigger value="queue">Review queue</TabsTrigger>
            <TabsTrigger value="capacity">Capacity &amp; waitlist</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="audit">Audit log</TabsTrigger>
          </TabsList>

          <TabsContent value="queue">
            <ReviewQueueTab />
          </TabsContent>
          <TabsContent value="capacity">
            <CapacityTab />
          </TabsContent>
          <TabsContent value="settings">
            <SettingsTab />
          </TabsContent>
          <TabsContent value="audit">
            <AuditLogTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

const QUEUE_KEY = ["admin-creator-review-queue"];

function ReviewQueueTab() {
  const queryClient = useQueryClient();
  const [initialTotal, setInitialTotal] = useState<number | null>(null);
  const [lookupId, setLookupId] = useState("");

  const listQuery = useQuery({
    queryKey: QUEUE_KEY,
    queryFn: () => listAdminCreatorApplications({ limit: 100, state: "PendingReview" }),
  });

  useEffect(() => {
    if (listQuery.data && initialTotal === null) {
      setInitialTotal(listQuery.data.total);
    }
  }, [listQuery.data, initialTotal]);

  const current: AdminApplicationListItem | undefined = listQuery.data?.items[0];
  const position =
    initialTotal !== null && listQuery.data ? initialTotal - listQuery.data.total + 1 : null;

  const detailQuery = useQuery({
    queryKey: ["admin-creator-application-detail", current?.id],
    queryFn: () => getAdminCreatorApplication(current!.id),
    enabled: Boolean(current),
  });

  const invalidateQueue = () => {
    void queryClient.invalidateQueries({ queryKey: QUEUE_KEY });
    void queryClient.invalidateQueries({ queryKey: ["admin-creator-overview"] });
  };

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveAdminCreatorApplication(id),
    onSuccess: () => {
      toast.success("Approved — the creator has been notified");
      invalidateQueue();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectAdminCreatorApplication(id),
    onSuccess: () => {
      toast.success("Rejected");
      invalidateQueue();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const resetQueue = () => {
    setInitialTotal(null);
    invalidateQueue();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {position !== null && listQuery.data
            ? `${position} of ${initialTotal} pending`
            : listQuery.isLoading
              ? "Loading queue…"
              : "Queue up to date"}
        </p>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Look up creator by profile ID…"
            className="h-8 w-56 text-xs"
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-8 text-xs"
            asChild
            disabled={!lookupId.trim()}
          >
            <Link to="/admin/creators/$profileId" params={{ profileId: lookupId.trim() }}>
              <ExternalLink className="h-3.5 w-3.5" /> Open
            </Link>
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={resetQueue}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {listQuery.isLoading && <Skeleton className="h-72 w-full rounded-2xl" />}

      {listQuery.isError && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center text-sm text-muted-foreground">
          {(listQuery.error as Error)?.message || "Couldn't load the review queue."}
        </div>
      )}

      {listQuery.data && !current && (
        <div className="rounded-2xl border bg-card p-10 text-center shadow-soft">
          <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
          <p className="mt-3 text-sm text-muted-foreground">
            Queue is empty — nothing pending review.
          </p>
        </div>
      )}

      {current && (
        <div className="rounded-2xl border bg-card p-6 shadow-soft">
          {detailQuery.isLoading || !detailQuery.data ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <ReviewCard
              application={detailQuery.data}
              onApprove={() => approveMutation.mutate(current.id)}
              onReject={() => rejectMutation.mutate(current.id)}
              pending={approveMutation.isPending || rejectMutation.isPending}
            />
          )}
        </div>
      )}
    </div>
  );
}

function daysAgo(iso: string | null): string {
  if (!iso) return "never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function ReviewCard({
  application,
  onApprove,
  onReject,
  pending,
}: {
  application: AdminApplicationDetail;
  onApprove: () => void;
  onReject: () => void;
  pending: boolean;
}) {
  const m = application.metricsSnapshot;
  const s = application.scoreBreakdown;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">
            Creator Review —{" "}
            {application.creatorProfile.userName || application.creatorProfile.userEmail}
          </h2>
          <p className="text-xs text-muted-foreground">
            Submitted {new Date(application.submittedAt).toLocaleDateString()}
          </p>
        </div>
        <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
          Score {application.score}
        </Badge>
      </div>

      <div className="grid gap-3 text-sm sm:grid-cols-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Followers</p>
          <p className="mt-0.5 font-medium">{m.followerCount.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Posts</p>
          <p className="mt-0.5 font-medium">{m.postCount.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Account</p>
          <p className="mt-0.5 font-medium">{m.igAccountType}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Last post</p>
          <p className="mt-0.5 font-medium">{daysAgo(m.lastPostAt)}</p>
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
          Score breakdown{s.normalized ? "" : " (raw points)"}
        </p>
        <div className="grid gap-3 sm:grid-cols-4">
          <ScoreBar label="Account quality" value={s.accountQuality} max={30} />
          <ScoreBar label="Audience" value={s.audience} max={20} />
          <ScoreBar label="Engagement" value={s.engagement} max={30} />
          <ScoreBar label="Consistency" value={s.consistency} max={20} />
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
        <span className="font-medium">Reason: </span>
        {reasonLabel(application.reason)}
      </div>

      <div className="flex justify-end gap-2">
        <Button
          className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
          variant="outline"
          disabled={pending}
          onClick={onReject}
        >
          <XCircle className="h-4 w-4" /> Reject
        </Button>
        <Button
          className="gap-1.5 border-success/30 text-success hover:bg-success/10"
          variant="outline"
          disabled={pending}
          onClick={onApprove}
        >
          <CheckCircle2 className="h-4 w-4" /> Approve
        </Button>
      </div>
    </div>
  );
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">
          {value}/{max}
        </span>
      </div>
      <Progress value={Math.min(100, (value / max) * 100)} />
    </div>
  );
}

function CapacityTab() {
  const overviewQuery = useQuery({
    queryKey: ["admin-creator-overview"],
    queryFn: getAdminCreatorOverview,
    refetchInterval: 60_000,
  });

  if (overviewQuery.isLoading) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }
  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center text-sm text-muted-foreground">
        {(overviewQuery.error as Error)?.message || "Couldn't load overview."}
      </div>
    );
  }

  const o = overviewQuery.data;
  const capacityPct = o.capacity.maxActiveCreators
    ? Math.min(100, (o.capacity.activeCreatorCount / o.capacity.maxActiveCreators) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        Stats as of {new Date(o.generatedAt).toLocaleString()} (cached, refreshes automatically)
      </p>

      <div className="rounded-2xl border bg-card p-6 shadow-soft">
        <div className="flex items-center gap-2">
          <Gauge className="h-4.5 w-4.5 text-primary" />
          <h2 className="font-display text-lg font-semibold">Program capacity</h2>
        </div>
        <p className="mt-3 text-2xl font-semibold tabular-nums">
          {o.capacity.activeCreatorCount} / {o.capacity.maxActiveCreators}
        </p>
        <Progress className="mt-2" value={capacityPct} />
      </div>

      <section className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Object.entries(o.profilesByState).map(([state, count]) => (
          <StatCard key={state} label={state} value={String(count)} />
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Pending review"
          value={String(o.pendingReviewCount)}
          icon={ClipboardCheck}
        />
        <StatCard
          label="Waitlisted (capacity)"
          value={String(o.waitlistedCount)}
          icon={AlertTriangle}
        />
      </section>

      <WaitlistTable />
    </div>
  );
}

function WaitlistTable() {
  const listQuery = useInfiniteQuery({
    queryKey: ["admin-creator-waitlist"],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      listAdminWaitlist({ limit: 25, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const rows = useMemo(
    () => listQuery.data?.pages.flatMap((p) => p.applications) ?? [],
    [listQuery.data],
  );
  const total = listQuery.data?.pages[0]?.total ?? 0;

  return (
    <div className="rounded-2xl border bg-card shadow-soft">
      <div className="p-6 pb-0">
        <h3 className="font-display font-semibold">Waitlist (read-only)</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {total} application{total === 1 ? "" : "s"} waitlisted for capacity, sorted oldest-first
          (FIFO promotion order). These resolve automatically — no approve/reject controls here.
        </p>
      </div>
      <div className="overflow-x-auto p-6 pt-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Position</th>
              <th className="py-2 pr-4 font-medium">Instagram username</th>
              <th className="py-2 pr-4 font-medium">Followers</th>
              <th className="py-2 pr-4 font-medium">Score</th>
              <th className="py-2 font-medium">Applied</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.applicationId} className="border-b last:border-0">
                <td className="py-2.5 pr-4 tabular-nums">#{r.position}</td>
                <td className="py-2.5 pr-4">{formatHandle(r.instagramUsername) ?? "—"}</td>
                <td className="py-2.5 pr-4 tabular-nums">{r.followerCount.toLocaleString()}</td>
                <td className="py-2.5 pr-4 tabular-nums">{r.score}</td>
                <td className="py-2.5 text-xs text-muted-foreground">
                  {new Date(r.submittedAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {rows.length === 0 && !listQuery.isLoading && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  No one is currently waitlisted.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {listQuery.isLoading && <Skeleton className="h-32 w-full" />}
        {listQuery.isError && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {(listQuery.error as Error)?.message || "Couldn't load the waitlist."}
          </p>
        )}
      </div>
      {listQuery.hasNextPage && (
        <div className="flex justify-center border-t p-4">
          <Button
            size="sm"
            variant="outline"
            disabled={listQuery.isFetchingNextPage}
            onClick={() => void listQuery.fetchNextPage()}
          >
            {listQuery.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}

type EditableSettingKey = Exclude<keyof AdminCreatorSettings, "active_creator_count">;

const EDITABLE_FIELDS: Array<{ key: EditableSettingKey; label: string; note?: string }> = [
  { key: "auto_approve_threshold", label: "Auto-approve threshold" },
  { key: "manual_review_threshold", label: "Manual review threshold" },
  { key: "min_posts", label: "Minimum posts" },
  { key: "max_days_since_last_post", label: "Max days since last post" },
  { key: "min_monthly_dms", label: "Minimum monthly DMs" },
  { key: "min_active_automations", label: "Minimum active automations" },
  { key: "cooldown_days", label: "Cooldown (days)" },
  {
    key: "max_active_creators",
    label: "Max active creators",
    note: "Raising this may immediately auto-promote waitlisted applications up to the new cap.",
  },
  { key: "max_consecutive_sync_failures", label: "Max consecutive sync failures" },
];

function SettingsTab() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ["admin-creator-settings"],
    queryFn: getAdminCreatorSettings,
  });

  const [edited, setEdited] = useState<Partial<Record<EditableSettingKey, number>>>({});

  const saveMutation = useMutation({
    mutationFn: (entries: Array<{ key: string; value: number }>) =>
      updateAdminCreatorSettings(entries),
    onSuccess: () => {
      toast.success("Settings updated");
      setEdited({});
      void queryClient.invalidateQueries({ queryKey: ["admin-creator-settings"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (settingsQuery.isLoading) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }
  if (settingsQuery.isError || !settingsQuery.data) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center text-sm text-muted-foreground">
        {(settingsQuery.error as Error)?.message || "Couldn't load settings."}
      </div>
    );
  }

  const s = settingsQuery.data;
  const effective = (key: EditableSettingKey) => edited[key] ?? s[key];
  const dirtyKeys = (Object.keys(edited) as EditableSettingKey[]).filter(
    (k) => edited[k] !== undefined && edited[k] !== s[k],
  );

  const pairInvalid = effective("manual_review_threshold") >= effective("auto_approve_threshold");

  const handleSave = () => {
    if (pairInvalid) {
      toast.error("Manual review threshold must be lower than the auto-approve threshold.");
      return;
    }
    if (dirtyKeys.length === 0) return;
    saveMutation.mutate(dirtyKeys.map((key) => ({ key, value: edited[key]! })));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm">
        <Pencil className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          Editing these thresholds changes who gets auto-approved going forward — changes save
          immediately and atomically once you hit Save.
        </p>
      </div>

      {pairInvalid && (
        <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Manual review threshold must be lower than the auto-approve threshold.</p>
        </div>
      )}

      <div className="rounded-2xl border bg-card p-6 shadow-soft">
        <div className="grid gap-4 sm:grid-cols-2">
          {EDITABLE_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {f.label}
              </Label>
              <Input
                type="number"
                value={effective(f.key)}
                onChange={(e) =>
                  setEdited((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))
                }
                className="text-lg font-semibold tabular-nums"
              />
              {f.note && <p className="text-xs text-muted-foreground">{f.note}</p>}
            </div>
          ))}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Active creator count
            </Label>
            <Input
              type="number"
              value={s.active_creator_count}
              disabled
              className="text-lg font-semibold tabular-nums"
            />
            <p className="text-xs text-muted-foreground">System-maintained, not editable.</p>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3 border-t pt-4">
          <Button
            size="sm"
            disabled={dirtyKeys.length === 0 || pairInvalid || saveMutation.isPending}
            onClick={handleSave}
          >
            {saveMutation.isPending ? "Saving…" : "Save changes"}
          </Button>
          {dirtyKeys.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              disabled={saveMutation.isPending}
              onClick={() => setEdited({})}
            >
              Discard changes
            </Button>
          )}
          {dirtyKeys.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {dirtyKeys.length} unsaved change{dirtyKeys.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

const DECISION_TYPES = [
  "AutoApproved",
  "AutoRejected",
  "ManualApproved",
  "ManualRejected",
  "ManualReviewQueued",
  "Waitlisted",
  "WaitlistPromoted",
  "CreatorRemoved",
  "PlanChanged",
];

function AuditLogTab() {
  const [decisionType, setDecisionType] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);

  const filters = {
    decisionType: decisionType === "all" ? undefined : decisionType,
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(to).toISOString() : undefined,
  };

  const listQuery = useInfiniteQuery({
    queryKey: ["admin-audit-log", filters.decisionType, filters.from, filters.to],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      getAdminAuditLog({ ...filters, limit: 25, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const rows = useMemo(
    () => listQuery.data?.pages.flatMap((p) => p.entries) ?? [],
    [listQuery.data],
  );
  const total = listQuery.data?.pages[0]?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={decisionType} onValueChange={setDecisionType}>
          <SelectTrigger className="h-8 w-52 text-xs">
            <SelectValue placeholder="All decision types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All decision types</SelectItem>
            {DECISION_TYPES.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          className="h-8 w-36 text-xs"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          aria-label="From date"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <Input
          type="date"
          className="h-8 w-36 text-xs"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          aria-label="To date"
        />
        {(decisionType !== "all" || from || to) && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            onClick={() => {
              setDecisionType("all");
              setFrom("");
              setTo("");
            }}
          >
            Clear filters
          </Button>
        )}
        {decisionType !== "all" && (
          <p className="w-full text-xs text-muted-foreground">
            Filtering by decision type shows only decision rows (approvals/rejections) — event rows
            (metrics syncs, health checks, etc.) have no decision type and are excluded while this
            filter is set.
          </p>
        )}
      </div>

      <div className="rounded-2xl border bg-card shadow-soft">
        <div className="p-4 pb-0 text-xs text-muted-foreground">{total} matching entries</div>
        <div className="overflow-x-auto p-6 pt-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-4 font-medium">When</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 font-medium">Decision / Event</th>
                <th className="py-2 pr-4 font-medium">Actor</th>
                <th className="py-2 font-medium text-right">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2.5 pr-4">
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {e.type}
                    </Badge>
                  </td>
                  <td className="py-2.5 pr-4">{e.decision ?? e.eventType ?? "—"}</td>
                  <td className="py-2.5 pr-4 text-xs text-muted-foreground">{e.actor}</td>
                  <td className="py-2.5 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setSelected(e)}
                    >
                      View
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !listQuery.isLoading && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    No entries match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {listQuery.isLoading && <Skeleton className="h-40 w-full" />}
          {listQuery.isError && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {(listQuery.error as Error)?.message || "Couldn't load the audit log."}
            </p>
          )}
        </div>
        {listQuery.hasNextPage && (
          <div className="flex justify-center border-t p-4">
            <Button
              size="sm"
              variant="outline"
              disabled={listQuery.isFetchingNextPage}
              onClick={() => void listQuery.fetchNextPage()}
            >
              {listQuery.isFetchingNextPage ? "Loading…" : "Load more"}
            </Button>
          </div>
        )}
      </div>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.decision ?? selected?.eventType ?? "Entry detail"}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>Type: {selected.type}</div>
                <div>Actor: {selected.actor}</div>
                <div>When: {new Date(selected.createdAt).toLocaleString()}</div>
              </div>
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                  Full payload
                </p>
                <pre className="max-h-96 overflow-auto rounded-lg border bg-muted/30 p-3 text-xs">
                  {JSON.stringify(selected.payload, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
