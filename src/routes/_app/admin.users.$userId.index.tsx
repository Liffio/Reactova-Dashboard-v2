import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";

import { FormSection } from "@/components/admin/form-page";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { getAdminUser } from "@/lib/api/admin-users-api";

/**
 * Overview tab — identity summary (fields not already on the rail), counts, admin notes
 * (read-only; editing is a later phase), ban details, email-verification state. Per spec §7.2 /
 * task-8-brief.md requirement 3.
 */
export const Route = createFileRoute("/_app/admin/users/$userId/")({
  head: () => ({ meta: [{ title: "Overview — User — Admin" }] }),
  component: OverviewTab,
});

function OverviewTab() {
  const { userId } = Route.useParams();

  const detailQuery = useQuery({
    queryKey: ["admin-user", userId],
    queryFn: () => getAdminUser(userId),
  });

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    // The shell already surfaces the definitive error/404 state for this user (it fetches the
    // same query key first) — this only fires if this tab's own fetch races independently, so a
    // small inline note is enough rather than duplicating the shell's full ErrorPanel.
    return (
      <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Couldn't load the overview. Reload the page to try again.
      </div>
    );
  }

  const user = detailQuery.data;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormSection title="Identity">
          <dl className="space-y-2.5 text-sm">
            <OverviewRow label="Country">{user.country || "—"}</OverviewRow>
            <OverviewRow label="Phone number">{user.phoneNumber || "—"}</OverviewRow>
            <OverviewRow label="Status">
              <Badge
                variant="outline"
                className={
                  user.isActive
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-border bg-muted text-muted-foreground"
                }
              >
                {user.isActive ? "Active" : "Inactive"}
              </Badge>
            </OverviewRow>
          </dl>
        </FormSection>

        <FormSection title="Email verification">
          <dl className="space-y-2.5 text-sm">
            <OverviewRow label="Verified">
              {user.emailVerified ? (
                <span className="inline-flex items-center gap-1.5 text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-warning">
                  <XCircle className="h-3.5 w-3.5" /> Unverified
                </span>
              )}
            </OverviewRow>
            <OverviewRow label="Verified at">
              {user.emailVerifiedAt ? formatDateTime(user.emailVerifiedAt) : "—"}
            </OverviewRow>
          </dl>
        </FormSection>
      </div>

      <FormSection title="Counts">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums">{user.counts.workspaces}</span>
          <span className="text-sm text-muted-foreground">
            workspace{user.counts.workspaces === 1 ? "" : "s"}
          </span>
        </div>
      </FormSection>

      <FormSection
        title="Ban details"
        description={user.ban.isBanned ? undefined : "This account is not banned."}
      >
        {user.ban.isBanned ? (
          <dl className="space-y-2.5 text-sm">
            <OverviewRow label="Reason">{user.ban.reason || "—"}</OverviewRow>
            <OverviewRow label="Banned at">
              {user.ban.bannedAt ? formatDateTime(user.ban.bannedAt) : "—"}
            </OverviewRow>
            <OverviewRow label="Banned by">
              {user.ban.bannedByUserId ? (
                <span className="font-mono text-xs">{user.ban.bannedByUserId}</span>
              ) : (
                "—"
              )}
            </OverviewRow>
          </dl>
        ) : null}
      </FormSection>

      <FormSection title="Admin notes" description="Read-only — editing arrives in a later phase.">
        {user.adminNotes ? (
          <p className="whitespace-pre-wrap text-sm">{user.adminNotes}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No notes on file.</p>
        )}
      </FormSection>
    </div>
  );
}

function OverviewRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
