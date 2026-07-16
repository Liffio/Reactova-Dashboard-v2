import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformAdminRoute } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthState } from "@/lib/auth/auth-store";
import {
  getAdminCreatorDetail,
  type AdminCreatorDetail,
} from "@/lib/api/admin-creator-eligibility-api";
import { reasonLabel } from "@/lib/creator-eligibility-copy";
import { MetricsPanel, OverridePanel, stateStyles } from "@/components/admin/creator-detail-shared";

export const Route = createFileRoute("/_app/admin/creators/$profileId")({
  head: () => ({ meta: [{ title: "Creator detail — Admin" }] }),
  component: AdminCreatorDetailRoute,
});

function AdminCreatorDetailRoute() {
  return (
    <PlatformAdminRoute>
      <AdminCreatorDetailPage />
    </PlatformAdminRoute>
  );
}

function AdminCreatorDetailPage() {
  const { profileId } = Route.useParams();
  const queryClient = useQueryClient();
  const isSuperAdmin = useAuthState((s) => s.isPlatformSuperAdmin);

  const detailQuery = useQuery({
    queryKey: ["admin-creator-detail", profileId],
    queryFn: () => getAdminCreatorDetail(profileId),
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["admin-creator-detail", profileId] });

  return (
    <div>
      <PageHeader
        eyebrow="Platform admin"
        title={detailQuery.data?.userName || detailQuery.data?.userEmail || "Creator detail"}
        description={detailQuery.data?.userEmail}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <Link to="/admin/creators">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to queue
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
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {(detailQuery.error as Error)?.message || "Creator not found."}
            </p>
          </div>
        )}

        {detailQuery.data && (
          <>
            <StatusPanel detail={detailQuery.data} />
            <MetricsPanel detail={detailQuery.data} />
            <div className="rounded-2xl border bg-muted/30 p-4 text-xs text-muted-foreground">
              Resolved-condition history and the creator event timeline aren't exposed by the
              current API contract (ENDPOINT-CONTRACT.md §5) — only the currently unresolved
              conditions above are available today.
            </div>
            <OverridePanel
              profileId={profileId}
              override={detailQuery.data.override}
              isSuperAdmin={isSuperAdmin}
              onChanged={invalidate}
            />
          </>
        )}
      </div>
    </div>
  );
}

function StatusPanel({ detail }: { detail: AdminCreatorDetail }) {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-soft">
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
        <div className="mt-4 flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
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

      <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <div>Eligibility algorithm: {detail.eligibilityAlgorithmVersion}</div>
        <div>Health algorithm: {detail.healthAlgorithmVersion}</div>
      </div>
    </div>
  );
}
