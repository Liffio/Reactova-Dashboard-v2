import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CheckCircle2, Clock, KeyRound, ShieldCheck, XCircle } from "lucide-react";

import { CopyableKey, FormSection } from "@/components/admin/form-page";
import { CountryLabel } from "@/components/country-flag";
import {
  AccountFactsSection,
  NetworkSection,
  SignupSourceSection,
} from "@/features/admin-users/user-insights";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { timeAgo } from "@/features/settings/components";
import { formatDate, formatDateTime } from "@/lib/format";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/http";
import { usePlatformCan } from "@/hooks/use-platform-authz";
import { getAdminUser, setAdminUserNotes, type AdminUserDetail } from "@/lib/api/admin-users-api";

const USER_MANAGE = "platform:user_manage";

/**
 * Overview tab — a stats strip; location & network (every IP, geolocated to a country with its
 * flag); identity and email verification; the rest of the account record; signup source; ban
 * details and admin notes — with a details column (ids, auth methods, MFA, platform authority) on
 * the right, the layout of Clerk's user profile page. The shell's header already shows name,
 * status and last activity, so this tab carries everything else. Per spec §7.2 /
 * task-8-brief.md requirement 3. The network/account/attribution sections come from
 * `GET /admin/users/:id/insights` (`features/admin-users/user-insights.tsx`).
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
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-4">
        <StatsStrip user={user} />

        <NetworkSection userId={user.id} profileCountry={user.country} />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormSection title="Identity">
            <dl className="space-y-2.5 text-sm">
              <OverviewRow label="Country">
                <CountryLabel code={user.country} showCode fallback="—" />
              </OverviewRow>
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

        <AccountFactsSection userId={user.id} />
        <SignupSourceSection userId={user.id} />

        {user.ban.isBanned && (
          <FormSection title="Ban details">
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
          </FormSection>
        )}

        <AdminNotesSection userId={user.id} notes={user.adminNotes} />
      </div>

      <DetailsColumn user={user} />
    </div>
  );
}

/** The four numbers an operator reads first — the Sweatpals member-page stats row. */
function StatsStrip({ user }: { user: AdminUserDetail }) {
  const stats: Array<{ icon: typeof Clock; label: string; value: ReactNode; hint?: string }> = [
    {
      icon: Building2,
      label: "Workspaces",
      value: user.counts.workspaces.toLocaleString(),
    },
    {
      icon: Clock,
      label: "Last active",
      value: user.lastActiveAt ? timeAgo(user.lastActiveAt) : "Never",
      hint: user.lastActiveAt ? formatDateTime(user.lastActiveAt) : undefined,
    },
    {
      icon: ShieldCheck,
      label: "MFA",
      value: user.mfa.enabled
        ? `${user.mfa.methods.length} method${user.mfa.methods.length === 1 ? "" : "s"}`
        : "Off",
    },
    {
      icon: KeyRound,
      label: "Sign-in",
      value: user.authMethods.length === 0 ? "—" : user.authMethods.join(", "),
    },
  ];

  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-2xl border bg-card shadow-soft md:grid-cols-4">
      {stats.map(({ icon: Icon, label, value, hint }, i) => (
        <div
          key={label}
          title={hint}
          className={cn(
            "min-w-0 p-4",
            i % 2 === 1 && "border-l",
            i >= 2 && "border-t md:border-t-0",
            i === 2 && "md:border-l",
          )}
        >
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon className="h-3.5 w-3.5" />
            {label}
          </p>
          <p className="mt-1.5 truncate text-lg font-semibold capitalize tabular-nums">{value}</p>
        </div>
      ))}
    </div>
  );
}

function PlatformAuthorityBadge({ platform }: { platform: AdminUserDetail["platform"] }) {
  if (platform.isSuperAdmin) {
    return (
      <Badge variant="outline" className="border-chart-3/30 bg-chart-3/10 text-[10px] text-chart-3">
        Super admin
      </Badge>
    );
  }
  if (platform.isPlatformAdmin) {
    return (
      <Badge variant="outline" className="border-primary/30 bg-primary/10 text-[10px] text-primary">
        Scoped{platform.source ? ` · ${platform.source}` : ""}
      </Badge>
    );
  }
  return <span className="text-muted-foreground">None</span>;
}

function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1 py-3 first:pt-0 last:pb-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm font-medium">{children}</dd>
    </div>
  );
}

/** Reference data, stacked label-over-value like Clerk's right column — ids are copyable because
 *  they get pasted into logs, SQL and support threads. */
function DetailsColumn({ user }: { user: AdminUserDetail }) {
  return (
    <aside className="min-w-0">
      <div className="rounded-2xl border bg-card p-5 shadow-soft">
        <dl className="divide-y">
          <DetailItem label="User ID">
            <CopyableKey value={user.id} className="max-w-full" />
          </DetailItem>
          <DetailItem label="Primary email">
            <CopyableKey value={user.email} className="max-w-full" />
          </DetailItem>
          <DetailItem label="User since">{formatDate(user.createdAt)}</DetailItem>
          <DetailItem label="Auth methods">
            {user.authMethods.length === 0 ? (
              "—"
            ) : (
              <span className="flex flex-wrap gap-1">
                {user.authMethods.map((m) => (
                  <Badge key={m} variant="outline" className="text-[10px] capitalize">
                    {m}
                  </Badge>
                ))}
              </span>
            )}
          </DetailItem>
          <DetailItem label="MFA methods">
            {user.mfa.enabled ? (
              <span className="flex flex-wrap gap-1">
                {user.mfa.methods.map((m) => (
                  <Badge
                    key={m.id}
                    variant="outline"
                    title={`Enrolled ${formatDate(m.createdAt)}`}
                    className="border-success/30 bg-success/10 text-[10px] capitalize text-success"
                  >
                    {m.type.toLowerCase().replace(/_/g, " ")}
                  </Badge>
                ))}
              </span>
            ) : (
              <span className="text-muted-foreground">Disabled</span>
            )}
          </DetailItem>
          <DetailItem label="Platform authority">
            <PlatformAuthorityBadge platform={user.platform} />
          </DetailItem>
          <DetailItem label="Profile updated">{formatDateTime(user.updatedAt)}</DetailItem>
        </dl>
      </div>
    </aside>
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
