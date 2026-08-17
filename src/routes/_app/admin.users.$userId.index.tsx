import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";

import { FormSection } from "@/components/admin/form-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/lib/toast";
import { ApiError } from "@/lib/api/http";
import { usePlatformCan } from "@/hooks/use-platform-authz";
import { getAdminUser, setAdminUserNotes } from "@/lib/api/admin-users-api";

const USER_MANAGE = "platform:user_manage";

/**
 * Overview tab — identity summary (fields not already on the rail), counts, admin notes, ban
 * details, email-verification state. Per spec §7.2 / task-8-brief.md requirement 3.
 *
 * Admin notes (Task 15) — editable textarea + save via `PATCH /admin/users/:id/notes`
 * (task-14-report.md §1: a legacy carry-over route, not one of Task 14's eleven). Plain
 * save+refetch, no optimistic update (per the brief — this is a low-frequency, low-risk edit).
 * Hidden behind `platform:user_manage`, falling back to the prior read-only rendering otherwise.
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

      <AdminNotesSection userId={user.id} notes={user.adminNotes} />
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

function AdminNotesSection({ userId, notes }: { userId: string; notes: string | null }) {
  const canManage = usePlatformCan(USER_MANAGE);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(notes ?? "");

  // The detail query can refetch out from under an untouched textarea (e.g. another mutation's
  // invalidation) — keep the draft in sync with the server value whenever it changes and the
  // operator hasn't started editing away from it.
  useEffect(() => {
    setDraft(notes ?? "");
  }, [notes]);

  const dirty = draft !== (notes ?? "");

  const mutation = useMutation({
    mutationFn: () => setAdminUserNotes(userId, draft),
    onSuccess: () => {
      toast.success("Notes saved.");
      void queryClient.invalidateQueries({ queryKey: ["admin-user", userId] });
    },
    onError: (err) => {
      const requestId = err instanceof ApiError ? err.requestId : undefined;
      toast.error(err instanceof Error ? err.message : "Failed to save notes.", {
        description: requestId ? `Request ID: ${requestId}` : undefined,
      });
    },
  });

  if (!canManage) {
    return (
      <FormSection title="Admin notes">
        {notes ? (
          <p className="whitespace-pre-wrap text-sm">{notes}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No notes on file.</p>
        )}
      </FormSection>
    );
  }

  return (
    <FormSection
      title="Admin notes"
      description="Visible only to platform admins — never shown to the user."
      actions={
        dirty ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={mutation.isPending}
              onClick={() => setDraft(notes ?? "")}
            >
              Cancel
            </Button>
            <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? "Saving…" : "Save notes"}
            </Button>
          </div>
        ) : undefined
      }
    >
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Add a note for other admins…"
        className="min-h-24"
        disabled={mutation.isPending}
      />
    </FormSection>
  );
}
