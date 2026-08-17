import { useState, type ReactNode } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Ban,
  KeyRound,
  Mail,
  MailCheck,
  MoreHorizontal,
  Send,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Unlink,
  UserCheck,
  UserCog,
  UserX,
} from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformPermissionRoute } from "@/components/auth/guards";
import { PageErrorBoundary } from "@/components/error-boundary";
import { CopyableKey } from "@/components/admin/form-page";
import { ImpersonateDialog } from "@/components/admin/impersonate-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { ApiError } from "@/lib/api/http";
import { formatDate, formatDateTime } from "@/lib/format";
import { useAuthState } from "@/lib/auth/auth-store";
import { usePlatformCan } from "@/hooks/use-platform-authz";
import {
  activateAdminUser,
  banAdminUser,
  changeAdminUserEmail,
  deactivateAdminUser,
  forceAdminUserPasswordReset,
  getAdminUser,
  resendAdminUserVerification,
  resetAdminUserMfa,
  setAdminUserPassword,
  unbanAdminUser,
  unlinkAdminUserGoogle,
  verifyAdminUserEmail,
  type AdminUserDetail,
} from "@/lib/api/admin-users-api";

/**
 * Detail shell (Task 8) — left rail identity card + tab nav + `<Outlet/>`. Every tab is a
 * separate route file (`admin.users.$userId.{index,workspaces,sessions,activity}.tsx`) so each
 * is deep-linkable and lazily loaded, per spec §7.2. Only the four tabs that exist today are
 * wired up — Access/Billing/AI & API/Impersonation arrive in later phases; no stubs for them
 * here.
 *
 * Action bar + danger zone (Task 15) — every mutation dialog lives in this file rather than a
 * shared `src/components/admin/` module: they're specific to this one page, and the codebase's
 * own convention (Task 8/10's shell/drill-down files) is a page owns its dialogs locally rather
 * than centralising page-specific furniture. `Impersonate` (Task 18, Phase 6) is the one
 * exception: `ImpersonateDialog` lives in `src/components/admin/impersonate-dialog.tsx` instead,
 * because it's reused verbatim from the user LIST page's kebab/`i`-shortcut, which has no
 * `AdminUserDetail` to read a target label from — a shared component with `{targetUserId,
 * targetLabel}` props is the natural fit, not a duplicate implementation per page.
 */

const USER_MANAGE = "platform:user_manage";
/** Separate axis from `USER_MANAGE` — Task 18. Gates the Impersonate action specifically, so a
 *  `platform:user_manage`-only operator (who can see and edit this page) doesn't get an
 *  impersonate button they'd 403 on. */
const IMPERSONATE = "platform:impersonate";

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
          <div className="flex flex-wrap items-center gap-2">
            {detailQuery.data && <UserActionBar userId={userId} user={detailQuery.data} />}
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <Link to="/admin/users">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to users
              </Link>
            </Button>
          </div>
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

/* -------------------------------------------------------------------------
 * Action bar + danger zone (Task 15) — spec §7.2 (action bar) + §6.4 (password handling UX).
 * Every mutation below hits an endpoint frozen by task-14-report.md (or, for ban/unban/notes,
 * the legacy carry-over routes documented in that report's §1). All query invalidation goes
 * through `useInvalidateUser`: a single prefix invalidation of `["admin-user", userId]` refreshes
 * the shell's own detail query plus the Sessions/Workspaces/Activity tabs' queries in one call
 * (React Query's `invalidateQueries` does prefix matching), which is simpler and safer than
 * hand-picking which sub-key each of the eleven-plus mutations happens to touch.
 * ---------------------------------------------------------------------- */

function useInvalidateUser(userId: string): () => void {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ["admin-user", userId] });
}

/** Shared error toast — server messages on typed errors (`ApiError`) are already the
 *  human-readable string a `BaseError` subclass was thrown with, so this just forwards it plus
 *  the request id for support to trace. Matches the exact pattern already used by the Task 10
 *  drill-down (`admin.users.$userId.workspaces_.$wsId.tsx`). */
function errorToast(err: unknown, fallback: string) {
  const requestId = err instanceof ApiError ? err.requestId : undefined;
  toast.error(err instanceof Error ? err.message : fallback, {
    description: requestId ? `Request ID: ${requestId}` : undefined,
  });
}

function isReasonValid(reason: string): boolean {
  const trimmed = reason.trim();
  return trimmed.length >= 1 && trimmed.length <= 1000;
}

/** The reason field every mutation but `force-password-reset`/`resend-verification`/`unban`
 *  requires (task-14-report.md's `reasonSchema`: 1-1000 chars). */
function ReasonField({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5 text-left">
      <label className="text-sm font-medium" htmlFor={id}>
        Reason <span className="text-destructive">*</span>
      </label>
      <Textarea
        id={id}
        value={value}
        maxLength={1000}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/** Generic confirm shell (AlertDialog) shared by every reason-gated mutation below — the exact
 *  header/footer boilerplate `admin.users.$userId.workspaces_.$wsId.tsx`'s role-change/unassign
 *  dialogs already established, factored out once here since Task 15 needs it ~9 times.
 *  `destructive` drives the same `bg-destructive text-destructive-foreground hover:bg-destructive/90`
 *  action-button override that file uses for its own destructive confirms. */
function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  destructive,
  confirmLabel,
  pendingLabel,
  pending,
  disabled,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  destructive?: boolean;
  confirmLabel: string;
  pendingLabel?: string;
  pending: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {children && <div className="space-y-3">{children}</div>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={disabled || pending}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            className={
              destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
          >
            {pending ? (pendingLabel ?? "Working…") : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Top of the action bar: `Force password reset` (prominent, always visible) + the state-swapped
 *  `Ban`/`Unban` button + the kebab. Renders nothing without `platform:user_manage` — the route
 *  itself already gates the whole page on this same permission, but the brief calls for the bar
 *  itself to also self-gate (requirement 9), so this is belt-and-suspenders against the page ever
 *  being reachable some other way in the future. */
function UserActionBar({ userId, user }: { userId: string; user: AdminUserDetail }) {
  const canManage = usePlatformCan(USER_MANAGE);
  if (!canManage) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ImpersonateAction userId={userId} user={user} />
      <ForcePasswordResetAction userId={userId} />
      {user.ban.isBanned ? <UnbanAction userId={userId} /> : <BanAction userId={userId} />}
      <UserKebabMenu userId={userId} user={user} />
    </div>
  );
}

/** Primary "Impersonate" button (brief requirement 2) — self-gated on `platform:impersonate`
 *  independently of `UserActionBar`'s own `platform:user_manage` gate above, per the brief's
 *  "hide otherwise". */
function ImpersonateAction({ userId, user }: { userId: string; user: AdminUserDetail }) {
  const canImpersonate = usePlatformCan(IMPERSONATE);
  const [open, setOpen] = useState(false);
  if (!canImpersonate) return null;

  return (
    <>
      <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <UserCog className="h-3.5 w-3.5" /> Impersonate
      </Button>
      <ImpersonateDialog
        targetUserId={userId}
        targetLabel={user.name || user.email}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

/** Dialog is a plain `Dialog`, not an `AlertDialog` — it carries a checkbox, not just a
 *  confirm/cancel pair, matching this codebase's convention of reserving `AlertDialog` for
 *  reason-only confirms. Copy is R14 verbatim: sessions revoked now, the user is not emailed a
 *  "reset link" — if notified, they're told to use "Forgot password" themselves. No `reason`
 *  field: `force-password-reset`'s contract (`{ notify: boolean }`) doesn't have one. */
function ForcePasswordResetAction({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [notify, setNotify] = useState(true);
  const invalidate = useInvalidateUser(userId);

  const mutation = useMutation({
    mutationFn: () => forceAdminUserPasswordReset(userId, notify),
    onSuccess: () => {
      toast.success("Sessions revoked.", {
        description: notify
          ? 'The user has been emailed to sign back in with "Forgot password".'
          : undefined,
      });
      setOpen(false);
      invalidate();
    },
    onError: (err) => errorToast(err, "Failed to force a password reset."),
  });

  return (
    <>
      <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <KeyRound className="h-3.5 w-3.5" /> Force password reset
      </Button>
      <Dialog open={open} onOpenChange={(next) => !mutation.isPending && setOpen(next)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Force a password reset?</DialogTitle>
            <DialogDescription>
              This immediately signs the user out of every active session. It does{" "}
              <strong>not</strong> change their password — they still have to set a new one
              themselves, via "Forgot password", the next time they try to sign in.
            </DialogDescription>
          </DialogHeader>
          <label className="flex items-start gap-2.5 rounded-lg border p-3 text-sm">
            <Checkbox
              checked={notify}
              onCheckedChange={(v) => setNotify(v === true)}
              className="mt-0.5"
            />
            <span>
              Email the user now to let them know their sessions were revoked and they should use
              "Forgot password" to sign back in.
            </span>
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? "Revoking…" : "Force password reset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function BanAction({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const invalidate = useInvalidateUser(userId);

  const mutation = useMutation({
    mutationFn: () => banAdminUser(userId, reason.trim()),
    onSuccess: () => {
      toast.success("User banned.");
      setOpen(false);
      setReason("");
      invalidate();
    },
    onError: (err) => errorToast(err, "Failed to ban user."),
  });

  return (
    <>
      <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Ban className="h-3.5 w-3.5" /> Ban
      </Button>
      <ConfirmActionDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setReason("");
        }}
        title="Ban this user?"
        description="Every further request from this account is blocked immediately, including on sessions that are already signed in. This does not delete the account or its data."
        destructive
        confirmLabel="Ban user"
        pendingLabel="Banning…"
        pending={mutation.isPending}
        disabled={!isReasonValid(reason)}
        onConfirm={() => mutation.mutate()}
      >
        <ReasonField
          id="ban-reason"
          value={reason}
          onChange={setReason}
          placeholder="Why is this account being banned?"
        />
      </ConfirmActionDialog>
    </>
  );
}

function UnbanAction({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const invalidate = useInvalidateUser(userId);

  const mutation = useMutation({
    mutationFn: () => unbanAdminUser(userId),
    onSuccess: () => {
      toast.success("User unbanned.");
      setOpen(false);
      invalidate();
    },
    onError: (err) => errorToast(err, "Failed to unban user."),
  });

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <ShieldCheck className="h-3.5 w-3.5" /> Unban
      </Button>
      <ConfirmActionDialog
        open={open}
        onOpenChange={setOpen}
        title="Unban this user?"
        description="Restores this account's access immediately."
        confirmLabel="Unban user"
        pendingLabel="Unbanning…"
        pending={mutation.isPending}
        onConfirm={() => mutation.mutate()}
      />
    </>
  );
}

/**
 * Kebab menu — Deactivate/Activate (state-swapped, mirroring Ban/Unban), Verify email + Resend
 * verification (both hidden once the account is already verified — a force-verify or a fresh OTP
 * send are no-ops at that point, and the codebase's own "hidden, not disabled-broken" ethos for
 * pointless actions extends naturally from permission-gating to state-gating here), Change email
 * (always available), Unlink Google (hidden unless `google` is actually one of the user's
 * `authMethods` — the server 400s `NO_GOOGLE_LINK` otherwise, so hiding avoids a guaranteed
 * error), Reset MFA (always available — task-14-report.md §7 documents the server treating a
 * reset against a target with nothing enabled as a legitimate, still-audited action, not a
 * no-op to prevent), then a "Danger zone" separator with `Set password` — buried per spec §6.4,
 * disabled with an explanatory tooltip when the OPERATOR (not the target) has no TOTP enrolled.
 * `mfaEnabled` on the auth store is exactly that signal (`src/api/routes/auth.ts`:
 * `mfaEnabled: user.mfaTotpEnabled`, the same flag `requireTotpConfirm` checks server-side) — this
 * proactively disables the item rather than only reacting to a 403 after the fact; the dialog
 * itself still handles a stale-cache 403 `TOTP_REQUIRED` as a fallback.
 */
function UserKebabMenu({ userId, user }: { userId: string; user: AdminUserDetail }) {
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [resendOpen, setResendOpen] = useState(false);
  const [changeEmailOpen, setChangeEmailOpen] = useState(false);
  const [unlinkGoogleOpen, setUnlinkGoogleOpen] = useState(false);
  const [resetMfaOpen, setResetMfaOpen] = useState(false);
  const [setPasswordOpen, setSetPasswordOpen] = useState(false);

  const hasGoogle = user.authMethods.includes("google");
  const operatorHasTotp = useAuthState((s) => s.mfaEnabled);
  const setPasswordDisabledReason = !operatorHasTotp
    ? "Enrol an authenticator app under Settings → Security to use this."
    : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label="More actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {user.isActive ? (
            <DropdownMenuItem
              onClick={() => setDeactivateOpen(true)}
              className="text-destructive focus:text-destructive"
            >
              <UserX className="mr-2 h-4 w-4" /> Deactivate
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => setActivateOpen(true)}>
              <UserCheck className="mr-2 h-4 w-4" /> Activate
            </DropdownMenuItem>
          )}
          {!user.emailVerified && (
            <DropdownMenuItem onClick={() => setVerifyOpen(true)}>
              <MailCheck className="mr-2 h-4 w-4" /> Verify email
            </DropdownMenuItem>
          )}
          {!user.emailVerified && (
            <DropdownMenuItem onClick={() => setResendOpen(true)}>
              <Send className="mr-2 h-4 w-4" /> Resend verification
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setChangeEmailOpen(true)}>
            <Mail className="mr-2 h-4 w-4" /> Change email
          </DropdownMenuItem>
          {hasGoogle && (
            <DropdownMenuItem
              onClick={() => setUnlinkGoogleOpen(true)}
              className="text-destructive focus:text-destructive"
            >
              <Unlink className="mr-2 h-4 w-4" /> Unlink Google
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => setResetMfaOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <ShieldAlert className="mr-2 h-4 w-4" /> Reset MFA
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Danger zone
          </DropdownMenuLabel>
          {setPasswordDisabledReason ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block cursor-not-allowed">
                  <DropdownMenuItem
                    disabled
                    className="text-destructive"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <KeyRound className="mr-2 h-4 w-4" /> Set password
                  </DropdownMenuItem>
                </span>
              </TooltipTrigger>
              <TooltipContent>{setPasswordDisabledReason}</TooltipContent>
            </Tooltip>
          ) : (
            <DropdownMenuItem
              onClick={() => setSetPasswordOpen(true)}
              className="text-destructive focus:text-destructive"
            >
              <KeyRound className="mr-2 h-4 w-4" /> Set password
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DeactivateDialog userId={userId} open={deactivateOpen} onOpenChange={setDeactivateOpen} />
      <ActivateDialog userId={userId} open={activateOpen} onOpenChange={setActivateOpen} />
      <VerifyEmailDialog userId={userId} open={verifyOpen} onOpenChange={setVerifyOpen} />
      <ResendVerificationDialog userId={userId} open={resendOpen} onOpenChange={setResendOpen} />
      <ChangeEmailDialog userId={userId} open={changeEmailOpen} onOpenChange={setChangeEmailOpen} />
      <UnlinkGoogleDialog
        userId={userId}
        open={unlinkGoogleOpen}
        onOpenChange={setUnlinkGoogleOpen}
      />
      <ResetMfaDialog userId={userId} open={resetMfaOpen} onOpenChange={setResetMfaOpen} />
      <SetPasswordDialog userId={userId} open={setPasswordOpen} onOpenChange={setSetPasswordOpen} />
    </>
  );
}

type KebabDialogProps = { userId: string; open: boolean; onOpenChange: (open: boolean) => void };

function DeactivateDialog({ userId, open, onOpenChange }: KebabDialogProps) {
  const [reason, setReason] = useState("");
  const invalidate = useInvalidateUser(userId);

  const mutation = useMutation({
    mutationFn: () => deactivateAdminUser(userId, reason.trim()),
    onSuccess: () => {
      toast.success("User deactivated.");
      onOpenChange(false);
      setReason("");
      invalidate();
    },
    onError: (err) => errorToast(err, "Failed to deactivate user."),
  });

  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setReason("");
      }}
      title="Deactivate this user?"
      description="Revokes every active session immediately."
      destructive
      confirmLabel="Deactivate"
      pendingLabel="Deactivating…"
      pending={mutation.isPending}
      disabled={!isReasonValid(reason)}
      onConfirm={() => mutation.mutate()}
    >
      <ReasonField
        id="deactivate-reason"
        value={reason}
        onChange={setReason}
        placeholder="Why is this account being deactivated?"
      />
    </ConfirmActionDialog>
  );
}

function ActivateDialog({ userId, open, onOpenChange }: KebabDialogProps) {
  const [reason, setReason] = useState("");
  const invalidate = useInvalidateUser(userId);

  const mutation = useMutation({
    mutationFn: () => activateAdminUser(userId, reason.trim()),
    onSuccess: () => {
      toast.success("User activated.");
      onOpenChange(false);
      setReason("");
      invalidate();
    },
    onError: (err) => errorToast(err, "Failed to activate user."),
  });

  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setReason("");
      }}
      title="Activate this user?"
      confirmLabel="Activate"
      pendingLabel="Activating…"
      pending={mutation.isPending}
      disabled={!isReasonValid(reason)}
      onConfirm={() => mutation.mutate()}
    >
      <ReasonField
        id="activate-reason"
        value={reason}
        onChange={setReason}
        placeholder="Why is this account being activated?"
      />
    </ConfirmActionDialog>
  );
}

function VerifyEmailDialog({ userId, open, onOpenChange }: KebabDialogProps) {
  const [reason, setReason] = useState("");
  const invalidate = useInvalidateUser(userId);

  const mutation = useMutation({
    mutationFn: () => verifyAdminUserEmail(userId, reason.trim()),
    onSuccess: () => {
      toast.success("Email marked verified.");
      onOpenChange(false);
      setReason("");
      invalidate();
    },
    onError: (err) => errorToast(err, "Failed to verify email."),
  });

  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setReason("");
      }}
      title="Mark this email verified?"
      description="Skips the OTP flow and marks the account verified immediately."
      confirmLabel="Verify email"
      pendingLabel="Verifying…"
      pending={mutation.isPending}
      disabled={!isReasonValid(reason)}
      onConfirm={() => mutation.mutate()}
    >
      <ReasonField
        id="verify-email-reason"
        value={reason}
        onChange={setReason}
        placeholder="Why is this being force-verified?"
      />
    </ConfirmActionDialog>
  );
}

/** No reason field — `resend-verification`'s contract takes no request body at all. Branches the
 *  success toast on `outcome` per task-14-report.md's four-value union. */
function ResendVerificationDialog({ userId, open, onOpenChange }: KebabDialogProps) {
  const mutation = useMutation({
    mutationFn: () => resendAdminUserVerification(userId),
    onSuccess: (res) => {
      onOpenChange(false);
      if (res.outcome === "sent") {
        toast.success("Verification email sent.");
      } else if (res.outcome === "already_verified") {
        toast.info("This account is already verified.");
      } else if (res.outcome === "cooldown") {
        toast.warning(
          res.retryAfterSec
            ? `Please wait ${res.retryAfterSec}s before resending.`
            : "A verification email was sent recently — please wait before resending.",
        );
      } else {
        toast.error("The verification email failed to send. Try again shortly.");
      }
    },
    onError: (err) => errorToast(err, "Failed to resend verification."),
  });

  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Resend the verification email?"
      confirmLabel="Resend"
      pendingLabel="Sending…"
      pending={mutation.isPending}
      onConfirm={() => mutation.mutate()}
    />
  );
}

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

function ChangeEmailDialog({ userId, open, onOpenChange }: KebabDialogProps) {
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const invalidate = useInvalidateUser(userId);
  const emailValid = EMAIL_PATTERN.test(email.trim());

  const reset = () => {
    setEmail("");
    setReason("");
  };

  const mutation = useMutation({
    mutationFn: () => changeAdminUserEmail(userId, email.trim(), reason.trim()),
    onSuccess: (res) => {
      toast.success(`Email changed to ${res.email}.`);
      onOpenChange(false);
      reset();
      invalidate();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "EMAIL_ALREADY_IN_USE") {
        toast.error("That email is already in use by another account.");
        return;
      }
      errorToast(err, "Failed to change email.");
    },
  });

  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
      title="Change this user's email?"
      description="Clears verification state, sends a fresh verification email to the new address, and revokes every active session."
      confirmLabel="Change email"
      pendingLabel="Changing…"
      pending={mutation.isPending}
      disabled={!emailValid || !isReasonValid(reason)}
      onConfirm={() => mutation.mutate()}
    >
      <div className="space-y-1.5 text-left">
        <Label htmlFor="change-email-value">New email</Label>
        <Input
          id="change-email-value"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
        />
      </div>
      <ReasonField
        id="change-email-reason"
        value={reason}
        onChange={setReason}
        placeholder="Why is this email changing?"
      />
    </ConfirmActionDialog>
  );
}

function UnlinkGoogleDialog({ userId, open, onOpenChange }: KebabDialogProps) {
  const [reason, setReason] = useState("");
  const invalidate = useInvalidateUser(userId);

  const mutation = useMutation({
    mutationFn: () => unlinkAdminUserGoogle(userId, reason.trim()),
    onSuccess: () => {
      toast.success("Google account unlinked.");
      onOpenChange(false);
      setReason("");
      invalidate();
    },
    onError: (err) => errorToast(err, "Failed to unlink Google."),
  });

  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setReason("");
      }}
      title="Unlink Google sign-in?"
      description="The user will need a password to sign back in — refused server-side if the account has none set."
      destructive
      confirmLabel="Unlink Google"
      pendingLabel="Unlinking…"
      pending={mutation.isPending}
      disabled={!isReasonValid(reason)}
      onConfirm={() => mutation.mutate()}
    >
      <ReasonField
        id="unlink-google-reason"
        value={reason}
        onChange={setReason}
        placeholder="Why is Google sign-in being unlinked?"
      />
    </ConfirmActionDialog>
  );
}

const MFA_METHOD_LABEL: Record<"ALL" | "TOTP" | "SMS", string> = {
  ALL: "All methods",
  TOTP: "Authenticator (TOTP)",
  SMS: "SMS",
};

function ResetMfaDialog({ userId, open, onOpenChange }: KebabDialogProps) {
  const [method, setMethod] = useState<"ALL" | "TOTP" | "SMS">("ALL");
  const [reason, setReason] = useState("");
  const invalidate = useInvalidateUser(userId);

  const mutation = useMutation({
    mutationFn: () => resetAdminUserMfa(userId, method, reason.trim()),
    onSuccess: (res) => {
      toast.success(
        res.disabledMethods.length > 0
          ? `Disabled: ${res.disabledMethods.join(", ")}.`
          : "No enabled methods matched — nothing to disable.",
      );
      onOpenChange(false);
      setReason("");
      invalidate();
    },
    onError: (err) => errorToast(err, "Failed to reset MFA."),
  });

  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setReason("");
      }}
      title="Reset MFA for this user?"
      description="Disables the selected method(s) immediately. The account's email-OTP fallback is never affected."
      destructive
      confirmLabel="Reset MFA"
      pendingLabel="Resetting…"
      pending={mutation.isPending}
      disabled={!isReasonValid(reason)}
      onConfirm={() => mutation.mutate()}
    >
      <div className="space-y-1.5 text-left">
        <Label>Method</Label>
        <Select value={method} onValueChange={(v) => setMethod(v as "ALL" | "TOTP" | "SMS")}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(MFA_METHOD_LABEL) as Array<"ALL" | "TOTP" | "SMS">).map((key) => (
              <SelectItem key={key} value={key}>
                {MFA_METHOD_LABEL[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <ReasonField
        id="reset-mfa-reason"
        value={reason}
        onChange={setReason}
        placeholder="Why is MFA being reset?"
      />
    </ConfirmActionDialog>
  );
}

/**
 * `Set password` — buried in the kebab's "Danger zone" (spec §6.4). Two steps: (1) warning +
 * required reason + new password, with the ONLY strength hint the server actually enforces
 * (`z.string().min(8)`, task-14-report.md §3 — no character-class rules exist server-side, so
 * none are invented here); (2) the operator's own 6-digit TOTP code (`InputOTP`, the exact
 * pattern `admin.plugins.tsx`'s `LifecycleDialog` already uses for its step-up), fed to the
 * server as `confirmCode`. A reactive `TOTP_REQUIRED` (stale `mfaEnabled` cache — the kebab
 * already disables the trigger proactively) swaps step 2 to an inline "not enrolled" message
 * instead of the OTP input, matching the brief's "surface the 403 TOTP_REQUIRED cleanly".
 */
function SetPasswordDialog({ userId, open, onOpenChange }: KebabDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [notEnrolled, setNotEnrolled] = useState(false);
  const invalidate = useInvalidateUser(userId);

  const reset = () => {
    setStep(1);
    setPassword("");
    setReason("");
    setCode("");
    setNotEnrolled(false);
  };

  const mutation = useMutation({
    mutationFn: () =>
      setAdminUserPassword(userId, { password, reason: reason.trim(), confirmCode: code }),
    onSuccess: () => {
      toast.success("Password set.", {
        description: "All of this user's sessions were revoked and they've been emailed.",
      });
      onOpenChange(false);
      reset();
      invalidate();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "TOTP_REQUIRED") {
        setNotEnrolled(true);
        return;
      }
      if (err instanceof ApiError && err.code === "TOTP_INVALID") {
        setCode("");
        toast.error("Invalid code — try again.");
        return;
      }
      if (err instanceof ApiError && err.code === "TARGET_IS_PLATFORM_ADMIN") {
        onOpenChange(false);
        reset();
        toast.error("Refused — this account holds platform-admin authority.", {
          description: "Platform admins can't have their password set through this action.",
        });
        return;
      }
      errorToast(err, "Failed to set password.");
    },
  });

  const step1Valid = password.length >= 8 && isReasonValid(reason);
  const step2Valid = code.length === 6 && !notEnrolled;

  // Every close affordance (Escape, overlay click, the DialogContent's own X, and the step-1
  // Cancel button below) must route through this — it's the only thing that clears the typed
  // password/reason/code. `onOpenChange`'s `next=false` branch and Cancel's `onClick` both call
  // it directly rather than relying on a shared `next` callback, since Cancel doesn't go through
  // Radix's `onOpenChange` at all (it's a plain button, not `DialogClose`).
  const handleClose = () => {
    onOpenChange(false);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (mutation.isPending) return;
        if (next) {
          onOpenChange(next);
        } else {
          handleClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set a new password</DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Sets the account's password directly and signs it out of every active session. Use this only when the user can't use \"Forgot password\" themselves."
              : "Confirm with your own authenticator code to finish."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              High-risk action — the new password takes effect immediately and the user isn't asked
              to confirm it.
            </div>
            <div className="space-y-1.5 text-left">
              <Label htmlFor="set-password-value">New password</Label>
              <Input
                id="set-password-value"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <p className="text-[11px] text-muted-foreground">At least 8 characters.</p>
            </div>
            <ReasonField
              id="set-password-reason"
              value={reason}
              onChange={setReason}
              placeholder="Why is this password being set directly?"
            />
          </div>
        ) : notEnrolled ? (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
            Your account has no authenticator app enrolled. Set one up under Settings → Security,
            then retry.
          </div>
        ) : (
          <div className="space-y-2 text-left">
            <Label>Your authenticator code</Label>
            <InputOTP maxLength={6} value={code} onChange={(v) => setCode(v.replace(/\D/g, ""))}>
              <InputOTPGroup>
                {Array.from({ length: 6 }).map((_, i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
        )}

        <DialogFooter>
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button variant="destructive" disabled={!step1Valid} onClick={() => setStep(2)}>
                Continue
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setStep(1);
                  setNotEnrolled(false);
                }}
                disabled={mutation.isPending}
              >
                Back
              </Button>
              <Button
                variant="destructive"
                disabled={!step2Valid || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? "Setting…" : "Set password"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
