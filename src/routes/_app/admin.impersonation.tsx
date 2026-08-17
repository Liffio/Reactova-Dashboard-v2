import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Ban, ShieldAlert, UserCog } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformPermissionRoute } from "@/components/auth/guards";
import { PageErrorBoundary } from "@/components/error-boundary";
import { EmptyState } from "@/components/admin/form-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { formatDateTime } from "@/lib/format";
import { ApiError } from "@/lib/api/http";
import { useAuthState } from "@/lib/auth/auth-store";
import { usePlatformCan } from "@/hooks/use-platform-authz";
import {
  escalateImpersonation,
  listActiveImpersonationSessions,
  revokeImpersonationSession,
  type ActiveImpersonationSession,
} from "@/lib/api/admin-impersonation-api";

/**
 * Live impersonation sessions console (Task 18 requirement 4, spec §5.7/§6.10). Every currently
 * live session across the platform, refreshed on a poll, with a per-row force-revoke and — for a
 * session's OWN admin — an escalate-to-write action (the only place escalation can actually run;
 * see the file-level note on `EscalateDialog` below).
 */
export const Route = createFileRoute("/_app/admin/impersonation")({
  head: () => ({ meta: [{ title: "Impersonation — Admin" }] }),
  component: AdminImpersonationRoute,
});

const IMPERSONATE = "platform:impersonate";
const IMPERSONATE_WRITE = "platform:impersonate_write";
const QUERY_KEY = ["admin-impersonation-active"] as const;

/** React Query poller period — named constant per the brief, not a magic number at the call
 *  site. React Query owns the interval's lifecycle (clears it on unmount / when the query is
 *  disabled), so there's no manual `setInterval` here to leak. */
const LIVE_SESSIONS_POLL_MS = 30_000;

/** The countdown's own tick, separate from the data poll above: a single `setInterval(1000)`
 *  shared by every row (not one timer per row), cleared on unmount — the leak candidate the
 *  brief calls out by name. It never fetches anything; it only forces the countdown cells to
 *  recompute `expiresAt - Date.now()` on each tick. */
function useSecondTicker(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  return tick;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Expired";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function AdminImpersonationRoute() {
  return (
    <PlatformPermissionRoute permission={IMPERSONATE}>
      <PageErrorBoundary label="admin-impersonation">
        <AdminImpersonationPage />
      </PageErrorBoundary>
    </PlatformPermissionRoute>
  );
}

function AdminImpersonationPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Platform admin"
        title="Impersonation"
        description="Every live impersonation session on the platform right now."
      />
      <div className="space-y-4 p-4 sm:p-6 md:p-10">
        <LiveSessionsTable />
      </div>
    </div>
  );
}

function ModeBadge({ mode }: { mode: "VIEW_ONLY" | "WRITE" }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px]",
        mode === "WRITE"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-warning/30 bg-warning/10 text-warning",
      )}
    >
      {mode === "WRITE" ? "WRITE" : "VIEW ONLY"}
    </Badge>
  );
}

function IdentityCell({ name, email }: { name: string | null; email: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-medium">{name || "—"}</p>
      <p className="truncate text-xs text-muted-foreground">{email}</p>
    </div>
  );
}

/** Opens the SAME `/dashboard#liffio_imp=<token>` handoff the start dialog uses (R20) — the only
 *  way to hand a freshly escalated token to the impersonated tab without writing storage from
 *  this (the admin's) tab. Task 19's `consumeImpersonationHandoff()` is idempotent and doesn't
 *  care whether the token behind the fragment is a first mint or an escalation rotation. */
function openImpersonatedTab(token: string) {
  window.open(`/dashboard#liffio_imp=${encodeURIComponent(token)}`, "_blank");
}

/**
 * Escalate-to-write (task-16-report §5(2)): structurally, this is the ONLY place a live session
 * can ever be escalated. It's an `/admin` route, so it 403s under an impersonation token (§8.1);
 * and the TOTP step-up verifies the CALLER's own enrollment, which under an impersonation token
 * would be the target's, not the admin's — there's no correct way to run it from the impersonated
 * tab. Task 19's banner instead shows an `EscalateHintDialog` that tells the operator to come
 * here. Consequently this dialog is only ever reachable for a session belonging to the CURRENT
 * admin (server also enforces this: 404 `SESSION_NOT_FOUND` for someone else's session) — the row
 * action that opens it is hidden entirely for other admins' rows rather than shown disabled, per
 * the "hide unauthorized actions" rule.
 */
function EscalateDialog({
  session,
  open,
  onOpenChange,
  onEscalated,
}: {
  session: ActiveImpersonationSession;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEscalated: () => void;
}) {
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [notEnrolled, setNotEnrolled] = useState(false);
  const operatorHasTotp = useAuthState((s) => s.mfaEnabled);

  const reset = () => {
    setReason("");
    setCode("");
    setNotEnrolled(false);
  };

  const mutation = useMutation({
    mutationFn: () =>
      escalateImpersonation(session.id, { reason: reason.trim(), confirmCode: code }),
    onSuccess: (res) => {
      onOpenChange(false);
      reset();
      onEscalated();
      toast.success(`Escalated ${session.targetEmail} to WRITE`, {
        description: `Same expiry as before — ends at ${formatDateTime(res.expiresAt)}.`,
        duration: 15000,
        action: {
          label: "Open impersonated tab",
          onClick: () => openImpersonatedTab(res.token),
        },
      });
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
      if (
        err instanceof ApiError &&
        (err.code === "SESSION_NOT_LIVE" || err.code === "SESSION_NOT_FOUND")
      ) {
        onOpenChange(false);
        reset();
        onEscalated();
        toast.error("That session is no longer live.");
        return;
      }
      if (err instanceof ApiError && err.code === "SESSION_ALREADY_WRITE") {
        onOpenChange(false);
        reset();
        onEscalated();
        toast.info("Already escalated to WRITE.");
        return;
      }
      const requestId = err instanceof ApiError ? err.requestId : undefined;
      toast.error(err instanceof Error ? err.message : "Failed to escalate.", {
        description: requestId ? `Request ID: ${requestId}` : undefined,
      });
    },
  });

  const reasonValid = reason.trim().length >= 10 && reason.trim().length <= 1000;
  const codeValid = code.length === 6 && !notEnrolled;

  const handleClose = () => {
    if (mutation.isPending) return;
    onOpenChange(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" /> Escalate to WRITE
          </DialogTitle>
          <DialogDescription>
            Confirm with your own authenticator code to let {session.targetEmail}
            &apos;s session perform write actions. The impersonated tab picks this up once you open
            it with the new link below.
          </DialogDescription>
        </DialogHeader>

        {notEnrolled ? (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
            Your account has no authenticator app enrolled. Set one up under Settings → Security,
            then retry.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5 text-left">
              <Label htmlFor="escalate-reason">
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="escalate-reason"
                value={reason}
                maxLength={1000}
                placeholder="Why does this session need write access?"
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
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
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          {!notEnrolled && (
            <Button
              disabled={!reasonValid || !codeValid || !operatorHasTotp || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "Escalating…" : "Escalate"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RevokeDialog({
  session,
  open,
  onOpenChange,
  onRevoked,
}: {
  session: ActiveImpersonationSession;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRevoked: () => void;
}) {
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: () => revokeImpersonationSession(session.id, reason.trim() || undefined),
    onSuccess: () => {
      onOpenChange(false);
      setReason("");
      onRevoked();
      toast.success(`Ended the session on ${session.targetEmail}'s account.`);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "SESSION_NOT_FOUND") {
        onOpenChange(false);
        setReason("");
        onRevoked();
        toast.info("That session already ended.");
        return;
      }
      const requestId = err instanceof ApiError ? err.requestId : undefined;
      toast.error(err instanceof Error ? err.message : "Failed to revoke.", {
        description: requestId ? `Request ID: ${requestId}` : undefined,
      });
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Force-revoke this session?</AlertDialogTitle>
          <AlertDialogDescription>
            Immediately ends {session.adminEmail}&apos;s impersonation of {session.targetEmail}.
            Their open tab, if any, is signed out of it on its next request.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5 text-left">
          <Label htmlFor="revoke-reason">Reason (optional)</Label>
          <Textarea
            id="revoke-reason"
            value={reason}
            maxLength={1000}
            placeholder="Recorded on the audit row. Defaults to a standard message if left blank."
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            onClick={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {mutation.isPending ? "Revoking…" : "Force-revoke"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SessionRow({
  session,
  now,
  canWrite,
  isOwnSession,
}: {
  session: ActiveImpersonationSession;
  now: number;
  canWrite: boolean;
  isOwnSession: boolean;
}) {
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const queryClient = useQueryClient();
  const refetchActive = () => void queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const remainingMs = new Date(session.expiresAt).getTime() - now;
  const canEscalate = canWrite && isOwnSession && session.mode === "VIEW_ONLY";

  return (
    <TableRow>
      <TableCell>
        <IdentityCell name={session.adminName} email={session.adminEmail} />
      </TableCell>
      <TableCell>
        <IdentityCell name={session.targetName} email={session.targetEmail} />
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {session.workspaceName ?? "All workspaces"}
      </TableCell>
      <TableCell>
        <ModeBadge mode={session.mode} />
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
        {formatDateTime(session.startedAt)}
      </TableCell>
      <TableCell
        className={cn(
          "whitespace-nowrap text-xs tabular-nums",
          remainingMs <= 2 * 60 * 1000 ? "font-medium text-warning" : "text-muted-foreground",
        )}
      >
        {formatRemaining(remainingMs)}
      </TableCell>
      <TableCell className="text-right tabular-nums">{session.actionsCount}</TableCell>
      <TableCell className="text-xs text-muted-foreground">{session.ticketRef ?? "—"}</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1.5">
          {canEscalate && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs"
              onClick={() => setEscalateOpen(true)}
            >
              <ShieldAlert className="h-3 w-3" /> Escalate
            </Button>
          )}
          {canWrite && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 border-destructive/40 text-xs text-destructive hover:bg-destructive/10"
              onClick={() => setRevokeOpen(true)}
            >
              <Ban className="h-3 w-3" /> Revoke
            </Button>
          )}
        </div>
      </TableCell>
      {canEscalate && (
        <EscalateDialog
          session={session}
          open={escalateOpen}
          onOpenChange={setEscalateOpen}
          onEscalated={refetchActive}
        />
      )}
      {canWrite && (
        <RevokeDialog
          session={session}
          open={revokeOpen}
          onOpenChange={setRevokeOpen}
          onRevoked={refetchActive}
        />
      )}
    </TableRow>
  );
}

function LiveSessionsTable() {
  const currentUserId = useAuthState((s) => s.user?.id);
  const canWrite = usePlatformCan(IMPERSONATE_WRITE);
  // Forces a re-render every second so every row's countdown recomputes from `now` below — a
  // single shared timer, not one per row, cleared on unmount inside the hook itself.
  useSecondTicker();
  const now = Date.now();

  const sessionsQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: ({ signal }) => listActiveImpersonationSessions({ signal }),
    refetchInterval: LIVE_SESSIONS_POLL_MS,
  });

  const items = sessionsQuery.data?.items ?? [];

  if (sessionsQuery.isLoading) {
    return (
      <div className="space-y-2 rounded-2xl border bg-card p-4 shadow-soft">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (sessionsQuery.isError) {
    const requestId =
      sessionsQuery.error instanceof ApiError ? sessionsQuery.error.requestId : undefined;
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-8 text-center">
        <AlertCircle className="mx-auto mb-2 h-6 w-6 text-destructive" />
        <p className="text-sm font-medium text-destructive">Couldn't load live sessions.</p>
        {requestId && (
          <p className="mt-2 text-xs text-muted-foreground">
            Request ID: <span className="font-mono">{requestId}</span>
          </p>
        )}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState icon={UserCog} title="No live impersonation sessions">
        Start one from a user's profile page.
      </EmptyState>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Admin</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Workspace</TableHead>
            <TableHead>Mode</TableHead>
            <TableHead>Started</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead className="text-right">Actions</TableHead>
            <TableHead>Ticket</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              now={now}
              canWrite={canWrite}
              isOwnSession={session.adminUserId === currentUserId}
            />
          ))}
        </TableBody>
      </Table>
      <div className="border-t p-3 text-center text-xs text-muted-foreground">
        <Link to="/admin/users" className="underline underline-offset-2 hover:text-foreground">
          Back to Users
        </Link>
      </div>
    </div>
  );
}
