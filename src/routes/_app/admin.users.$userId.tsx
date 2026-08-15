import type { ReactNode } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, ShieldOff } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformPermissionRoute } from "@/components/auth/guards";
import { PageErrorBoundary } from "@/components/error-boundary";
import { CopyableKey } from "@/components/admin/form-page";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/http";
import { formatDate, formatDateTime } from "@/lib/format";
import { getAdminUser, type AdminUserDetail } from "@/lib/api/admin-users-api";

/**
 * Detail shell (Task 8) — left rail identity card + tab nav + `<Outlet/>`. Every tab is a
 * separate route file (`admin.users.$userId.{index,workspaces,sessions,activity}.tsx`) so each
 * is deep-linkable and lazily loaded, per spec §7.2. Only the four tabs that exist today are
 * wired up — Access/Billing/AI & API/Impersonation arrive in later phases; no stubs for them
 * here. No action bar: user-level mutations (ban, force-password-reset, impersonate, …) are
 * Phase 5+, so there is nothing yet for a "danger zone" to do.
 */

const USER_MANAGE = "platform:user_manage";

export const Route = createFileRoute("/_app/admin/users/$userId")({
  head: () => ({ meta: [{ title: "User — Admin" }] }),
  component: AdminUserDetailRoute,
});

function AdminUserDetailRoute() {
  return (
    <PlatformPermissionRoute permission={USER_MANAGE}>
      <PageErrorBoundary label="admin-user-detail">
        <AdminUserDetailPage />
      </PageErrorBoundary>
    </PlatformPermissionRoute>
  );
}

/** Duplicated from `admin.users.tsx` (list route) rather than imported — both files own a tiny,
 *  self-contained formatting helper, matching this codebase's existing convention of per-file
 *  small helpers over a shared util for things this small (e.g. status-badge maps in
 *  `agency.tsx`/`billings.tsx`/`admin.users.tsx` are each local, not centralised). */
function initialsFor(name: string | null, email: string): string {
  const source = (name ?? email).trim();
  const initials = source
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return initials || "?";
}

function AdminUserDetailPage() {
  const { userId } = Route.useParams();

  const detailQuery = useQuery({
    queryKey: ["admin-user", userId],
    queryFn: () => getAdminUser(userId),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Platform admin"
        title={detailQuery.data?.name || detailQuery.data?.email || "User"}
        description={detailQuery.data?.email}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <Link to="/admin/users">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to users
            </Link>
          </Button>
        }
      />

      <div className="p-4 sm:p-6 md:p-10">
        {detailQuery.isLoading ? (
          <DetailSkeleton />
        ) : detailQuery.isError ? (
          <DetailError error={detailQuery.error} onRetry={() => void detailQuery.refetch()} />
        ) : detailQuery.data ? (
          <div className="grid gap-6 md:grid-cols-[280px_1fr]">
            <IdentityRail user={detailQuery.data} />
            <div className="min-w-0 space-y-4">
              <TabNav userId={userId} />
              <Outlet />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-[280px_1fr]">
      <Skeleton className="h-96 rounded-2xl" />
      <div className="min-w-0 space-y-4">
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}

/** 404/error state for an unknown or unreadable user id — the request id (when present) is
 *  shown so the failure can be traced in Sentry/logs, matching the list page's `ErrorPanel`. */
function DetailError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  const code = error instanceof ApiError ? error.code : undefined;
  const notFound = error instanceof ApiError && error.status === 404;
  const message = notFound
    ? "No user found with that id."
    : error instanceof Error
      ? error.message
      : "Couldn't load this user.";

  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-8 text-center">
      <AlertCircle className="mx-auto mb-2 h-6 w-6 text-destructive" />
      <p className="text-sm font-medium text-destructive">{message}</p>
      {code && (
        <p className="mt-1 text-xs text-muted-foreground">
          Code: <span className="font-mono">{code}</span>
        </p>
      )}
      {requestId && (
        <p className="mt-2 text-xs text-muted-foreground">
          Request ID: <span className="font-mono">{requestId}</span> — quote this when reporting.
        </p>
      )}
      {!notFound && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

function IdentityRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
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
  return (
    <Badge
      variant="outline"
      className="border-muted-foreground/30 text-[10px] text-muted-foreground"
    >
      None
    </Badge>
  );
}

function IdentityRail({ user }: { user: AdminUserDetail }) {
  return (
    <aside className="min-w-0">
      <div className="rounded-2xl border bg-card p-5 shadow-soft">
        {user.ban.isBanned && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
              <ShieldOff className="h-3.5 w-3.5" /> Banned
            </p>
            {user.ban.reason && (
              <p className="mt-1 text-xs text-destructive/90">{user.ban.reason}</p>
            )}
            {user.ban.bannedAt && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Since {formatDateTime(user.ban.bannedAt)}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col items-center text-center">
          <Avatar className="h-16 w-16">
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
            <AvatarFallback className="bg-brand-gradient text-lg font-semibold text-primary-foreground">
              {initialsFor(user.name, user.email)}
            </AvatarFallback>
          </Avatar>
          <p className="mt-3 truncate text-sm font-semibold">{user.name || "—"}</p>
          <CopyableKey value={user.email} className="mt-1.5 max-w-full" />
          <CopyableKey value={user.id} className="mt-1.5 max-w-full" />
        </div>

        <dl className="mt-5 space-y-3 text-xs">
          <IdentityRow label="Joined">{formatDate(user.createdAt)}</IdentityRow>
          <IdentityRow label="Last active">
            {user.lastActiveAt ? formatDateTime(user.lastActiveAt) : "Never"}
          </IdentityRow>
          <IdentityRow label="Auth methods">
            {user.authMethods.length === 0 ? (
              "—"
            ) : (
              <span className="flex flex-wrap justify-end gap-1">
                {user.authMethods.map((m) => (
                  <Badge key={m} variant="outline" className="text-[10px] capitalize">
                    {m}
                  </Badge>
                ))}
              </span>
            )}
          </IdentityRow>
          <IdentityRow label="MFA">
            {user.mfa.enabled ? (
              <Badge
                variant="outline"
                className="border-success/30 bg-success/10 text-[10px] text-success"
              >
                Enabled · {user.mfa.methods.length}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-muted-foreground/30 text-[10px] text-muted-foreground"
              >
                Disabled
              </Badge>
            )}
          </IdentityRow>
          <IdentityRow label="Platform authority">
            <PlatformAuthorityBadge platform={user.platform} />
          </IdentityRow>
        </dl>
      </div>
    </aside>
  );
}

type TabTo =
  | "/admin/users/$userId"
  | "/admin/users/$userId/workspaces"
  | "/admin/users/$userId/sessions"
  | "/admin/users/$userId/activity";

function TabLink({
  to,
  userId,
  active,
  children,
}: {
  to: TabTo;
  userId: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      params={{ userId }}
      className={cn(
        "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

/** Nav links, not the shadcn `Tabs` primitive — each tab is a real route (deep-linkable,
 *  lazily loaded per spec §7.2), so content comes from `<Outlet/>`, not local tab state. */
function TabNav({ userId }: { userId: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const base = `/admin/users/${userId}`;

  return (
    <nav className="flex flex-wrap gap-1 overflow-x-auto border-b" aria-label="User detail tabs">
      <TabLink to="/admin/users/$userId" userId={userId} active={pathname === base}>
        Overview
      </TabLink>
      <TabLink
        to="/admin/users/$userId/workspaces"
        userId={userId}
        active={pathname === `${base}/workspaces`}
      >
        Workspaces
      </TabLink>
      <TabLink
        to="/admin/users/$userId/sessions"
        userId={userId}
        active={pathname === `${base}/sessions`}
      >
        Sessions & Security
      </TabLink>
      <TabLink
        to="/admin/users/$userId/activity"
        userId={userId}
        active={pathname === `${base}/activity`}
      >
        Activity
      </TabLink>
    </nav>
  );
}
