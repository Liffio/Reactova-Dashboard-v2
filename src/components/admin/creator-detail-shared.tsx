/**
 * Shared UI for the two "creator detail" surfaces — Phase 4's narrow
 * override panel (admin.creators.$profileId) and Phase 6's fuller
 * management detail page (admin.creator-management.$profileId).
 *
 * Deliberately NOT defined inside either route file: TanStack Router's
 * route-based code splitting treats each route file's non-`Route` exports
 * as belonging to that route's own lazy chunk, so importing them from a
 * sibling route file is fragile. Shared, reusable pieces belong here.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  clearAdminCreatorOverride,
  setAdminCreatorOverride,
  type AdminCreatorDetail,
} from "@/lib/api/admin-creator-eligibility-api";

export const stateStyles: Record<string, string> = {
  NotEligible: "border-border bg-muted text-muted-foreground",
  Eligible: "border-primary/30 bg-primary/10 text-primary",
  Active: "border-success/30 bg-success/10 text-success",
  NeedsAttention: "border-warning/30 bg-warning/10 text-warning",
  Paused: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}

export function MetricsPanel({ detail }: { detail: AdminCreatorDetail }) {
  const m = detail.metrics;
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-soft">
      <h2 className="font-display text-lg font-semibold mb-4">Metrics snapshot</h2>
      <div className="grid gap-4 text-sm sm:grid-cols-3">
        <Metric label="Account type" value={m.igAccountType} />
        <Metric label="Connected" value={m.isConnected ? "Yes" : "No"} />
        <Metric label="Private" value={m.isPrivate ? "Yes" : "No"} />
        <Metric label="Followers" value={m.followerCount.toLocaleString()} />
        <Metric label="Posts" value={m.postCount.toLocaleString()} />
        <Metric
          label="Last post"
          value={m.lastPostAt ? new Date(m.lastPostAt).toLocaleDateString() : "—"}
        />
        <Metric
          label="Engagement rate"
          value={m.engagementRate === null ? "Not available yet" : `${m.engagementRate}%`}
        />
        <Metric label="DMs this period" value={m.dmCountCurrentPeriod.toLocaleString()} />
        <Metric label="Active automations" value={String(m.activeAutomationCount)} />
        <Metric label="Last sync" value={new Date(m.syncedAt).toLocaleString()} />
        <Metric label="Last sync succeeded" value={m.lastSyncSucceeded ? "Yes" : "No"} />
        <Metric label="Consecutive sync failures" value={String(m.consecutiveSyncFailures)} />
      </div>
    </div>
  );
}

export function OverridePanel({
  profileId,
  override,
  isSuperAdmin,
  onChanged,
}: {
  profileId: string;
  override: AdminCreatorDetail["override"];
  isSuperAdmin: boolean;
  onChanged: () => void;
}) {
  const [until, setUntil] = useState("");
  const [reason, setReason] = useState("");

  const setMutation = useMutation({
    mutationFn: () =>
      setAdminCreatorOverride(profileId, { until: new Date(until).toISOString(), reason }),
    onSuccess: () => {
      toast.success("Override set — Health Engine will skip this creator until it expires");
      setUntil("");
      setReason("");
      onChanged();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const clearMutation = useMutation({
    mutationFn: () => clearAdminCreatorOverride(profileId),
    onSuccess: () => {
      toast.success("Override cleared");
      onChanged();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Health Engine override</h2>
        {override.active && (
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
            Override active until{" "}
            {override.until ? new Date(override.until).toLocaleDateString() : "—"}
          </Badge>
        )}
      </div>

      {!isSuperAdmin ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Only Super Admins can set or clear a Health Engine override.
        </p>
      ) : (
        <>
          {override.active && (
            <div className="mt-3 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p>Reason: {override.reason || "—"}</p>
              <p>Set by: {override.by || "—"}</p>
            </div>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Override until</Label>
              <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Reason (required, audit-logged)</Label>
              <Textarea
                rows={2}
                placeholder="Creator on vacation, confirmed via support ticket #1234"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              className="gap-1.5"
              disabled={!until || !reason.trim() || setMutation.isPending}
              onClick={() => setMutation.mutate()}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {setMutation.isPending ? "Setting…" : "Set override"}
            </Button>
            {override.active && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-destructive"
                disabled={clearMutation.isPending}
                onClick={() => clearMutation.mutate()}
              >
                <ShieldOff className="h-3.5 w-3.5" />
                {clearMutation.isPending ? "Clearing…" : "Clear override"}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
