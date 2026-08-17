import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, MonitorSmartphone, ShieldX } from "lucide-react";

import { EmptyState, FormSection } from "@/components/admin/form-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import { formatDateTime } from "@/lib/format";
import { toast } from "@/lib/toast";
import { ApiError } from "@/lib/api/http";
import { usePlatformCan } from "@/hooks/use-platform-authz";
import {
  getAdminUser,
  getAdminUserSessions,
  revokeAdminUserSessions,
  type AdminUserSession,
} from "@/lib/api/admin-users-api";

const USER_MANAGE = "platform:user_manage";

/**
 * Sessions & Security tab — active refresh-token sessions plus an MFA methods summary. The MFA
 * summary reuses the shell's own `["admin-user", userId]` query (same key = same cache entry)
 * since it lives on the detail payload, not a dedicated endpoint — no second round trip for data
 * the shell already fetched.
 *
 * Revocation (Task 15) — per-row Revoke + a "Revoke all" bulk action, both confirm-gated
 * (`POST /admin/users/:id/revoke-sessions`, task-14-report.md §3: omit `sessionId` to revoke
 * everything). Hidden without `platform:user_manage`, per the brief's "hidden, not
 * disabled-broken" rule.
 */
export const Route = createFileRoute("/_app/admin/users/$userId/sessions")({
  head: () => ({ meta: [{ title: "Sessions & Security — User — Admin" }] }),
  component: SessionsTab,
});

const USER_AGENT_TRUNCATE = 44;

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function ErrorNote({ error }: { error: unknown }) {
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-center">
      <AlertCircle className="mx-auto mb-1.5 h-5 w-5 text-destructive" />
      <p className="text-sm text-destructive">Couldn't load sessions.</p>
      {requestId && (
        <p className="mt-1 text-xs text-muted-foreground">
          Request ID: <span className="font-mono">{requestId}</span>
        </p>
      )}
    </div>
  );
}

function SessionsTab() {
  const { userId } = Route.useParams();
  const canManage = usePlatformCan(USER_MANAGE);
  const [revokeTarget, setRevokeTarget] = useState<AdminUserSession | null>(null);
  const [revokeAllOpen, setRevokeAllOpen] = useState(false);

  const sessionsQuery = useQuery({
    queryKey: ["admin-user", userId, "sessions"],
    queryFn: () => getAdminUserSessions(userId),
  });

  const detailQuery = useQuery({
    queryKey: ["admin-user", userId],
    queryFn: () => getAdminUser(userId),
  });

  const sessions = sessionsQuery.data?.items ?? [];

  return (
    <div className="space-y-4">
      <FormSection
        title="MFA methods"
        description="Read-only — resetting MFA is in the user detail action bar's kebab menu."
      >
        {detailQuery.isLoading ? (
          <Skeleton className="h-8 w-48" />
        ) : detailQuery.data ? (
          detailQuery.data.mfa.enabled && detailQuery.data.mfa.methods.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {detailQuery.data.mfa.methods.map((m) => (
                <Badge key={m.id} variant="outline" className="gap-1.5 text-xs capitalize">
                  {m.type.toLowerCase()}
                  <span className="text-muted-foreground">· {formatDateTime(m.createdAt)}</span>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">MFA is not enabled for this account.</p>
          )
        ) : (
          <p className="text-sm text-muted-foreground">Couldn't load MFA state.</p>
        )}
      </FormSection>

      <FormSection
        title="Active sessions"
        actions={
          canManage && sessions.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() => setRevokeAllOpen(true)}
            >
              <ShieldX className="h-3.5 w-3.5" /> Revoke all
            </Button>
          ) : undefined
        }
      >
        {sessionsQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : sessionsQuery.isError ? (
          <ErrorNote error={sessionsQuery.error} />
        ) : sessions.length === 0 ? (
          <EmptyState icon={MonitorSmartphone} title="No active sessions">
            This user has no live refresh-token sessions.
          </EmptyState>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>User agent</TableHead>
                  <TableHead>IP address</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(s.createdAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(s.expiresAt)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {s.userAgent ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-default">
                              {truncate(s.userAgent, USER_AGENT_TRUNCATE)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs break-words">
                            {s.userAgent}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {s.ipAddress ?? "—"}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                          onClick={() => setRevokeTarget(s)}
                        >
                          <ShieldX className="h-3.5 w-3.5" /> Revoke
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </FormSection>

      <RevokeSessionDialog
        userId={userId}
        session={revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
      />
      <RevokeAllSessionsDialog
        userId={userId}
        open={revokeAllOpen}
        onOpenChange={setRevokeAllOpen}
      />
    </div>
  );
}

/** Per-row revoke — `sessionId` targeted, refuses (404 `SESSION_NOT_FOUND`/409
 *  `SESSION_ALREADY_REVOKED`) if the row was revoked/removed since this tab last rendered it. */
function RevokeSessionDialog({
  userId,
  session,
  onOpenChange,
}: {
  userId: string;
  session: AdminUserSession | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => revokeAdminUserSessions(userId, session!.id),
    onSuccess: () => {
      toast.success("Session revoked.");
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: ["admin-user", userId] });
    },
    onError: (err) => {
      const requestId = err instanceof ApiError ? err.requestId : undefined;
      toast.error(err instanceof Error ? err.message : "Failed to revoke session.", {
        description: requestId ? `Request ID: ${requestId}` : undefined,
      });
      onOpenChange(false);
    },
  });

  return (
    <AlertDialog
      open={!!session}
      onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke this session?</AlertDialogTitle>
          <AlertDialogDescription>
            The device or browser behind this session is signed out immediately and must sign in
            again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            {mutation.isPending ? "Revoking…" : "Revoke session"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Bulk revoke — omits `sessionId`, revoking every one of this user's sessions in one call. */
function RevokeAllSessionsDialog({
  userId,
  open,
  onOpenChange,
}: {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => revokeAdminUserSessions(userId),
    onSuccess: (res) => {
      toast.success(
        res.revokedCount === 1 ? "1 session revoked." : `${res.revokedCount} sessions revoked.`,
      );
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: ["admin-user", userId] });
    },
    onError: (err) => {
      const requestId = err instanceof ApiError ? err.requestId : undefined;
      toast.error(err instanceof Error ? err.message : "Failed to revoke sessions.", {
        description: requestId ? `Request ID: ${requestId}` : undefined,
      });
      onOpenChange(false);
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke every active session?</AlertDialogTitle>
          <AlertDialogDescription>
            Every device or browser this user is currently signed in on is signed out immediately.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            {mutation.isPending ? "Revoking…" : "Revoke all"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
