import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Activity as ActivityIcon,
  Building2,
  Coins,
  KeyRound,
  Loader2,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";

import { EmptyState, FormSection } from "@/components/admin/form-page";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { ApiError } from "@/lib/api/http";
import { formatDate, formatDateTime, formatNum } from "@/lib/format";
import { usePlatformCan } from "@/hooks/use-platform-authz";
import {
  getAdminUserWorkspaces,
  type AdminUserWorkspaceMembership,
} from "@/lib/api/admin-users-api";
import { grantAiTokens } from "@/lib/api/ai-tokens-api";
import {
  adjustWorkspaceAiTokens,
  getWorkspaceAiTokenLedger,
  getWorkspaceAiTokenSummary,
  getWorkspaceApiUsage,
  listWorkspaceApiCredentials,
  resetWorkspaceAiTokenPeriod,
  revokeWorkspaceApiCredential,
  updateWorkspaceApiCredential,
  type AdminApiCredential,
  type AdminApiCredentialStatus,
  type AdminWorkspaceLedgerEntry,
  type AdminWorkspaceLedgerEntryType,
  type AdminWorkspaceTokenSummary,
} from "@/lib/api/admin-workspaces-api";

/**
 * "AI & API" tab (Task 21) — spec §6.6–§6.8. Workspace-scoped (a user can belong to more than one
 * workspace, and every underlying route is `/admin/workspaces/:wsId/...`), so this tab adds a
 * workspace selector above three read/write panels, reusing the exact same
 * `["admin-user", userId, "workspaces"]` query the Workspaces tab and `ImpersonateDialog` already
 * use (free cache hit). Query keys for the panels themselves are namespaced
 * `["admin-workspace", workspaceId, ...]`, not `["admin-user", userId, ...]` — this data belongs
 * to the workspace, not the user, and namespacing it that way lets the cache be shared across any
 * other admin surface that looks at the same workspace.
 */
export const Route = createFileRoute("/_app/admin/users/$userId/ai-api")({
  head: () => ({ meta: [{ title: "AI & API — User — Admin" }] }),
  component: AiApiTab,
});

const AI_TOKENS_MANAGE = "platform:ai_tokens_manage";
const WORKSPACE_MANAGE = "platform:workspace_manage";

/** `"MANUAL_GRANT"` → `"Manual Grant"`. Duplicated per this codebase's existing convention of
 *  small per-file formatting helpers (see `admin.users.$userId.workspaces.tsx`'s own copy). */
function humanizeEnum(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

function errorToast(err: unknown, fallback: string) {
  const requestId = err instanceof ApiError ? err.requestId : undefined;
  toast.error(err instanceof Error ? err.message : fallback, {
    description: requestId ? `Request ID: ${requestId}` : undefined,
  });
}

function ErrorNote({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-center text-sm">
      <AlertCircle className="mx-auto mb-1.5 h-5 w-5 text-destructive" />
      <p className="font-medium text-destructive">{message}</p>
      {requestId && (
        <p className="mt-1 text-xs text-muted-foreground">
          Request ID: <span className="font-mono">{requestId}</span>
        </p>
      )}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

/** No dead panel: hidden section replaced with an explicit "why" rather than a blank gap or a
 *  disabled control, matching this codebase's "hide unauthorized actions" convention extended to
 *  whole read sections that themselves require the permission server-side (task-20-report.md §4 —
 *  every route under each of these panels, reads included, shares one gate). */
function RestrictedPanel({ title, permission }: { title: string; permission: string }) {
  return (
    <FormSection title={title}>
      <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        You don't have <span className="font-mono text-xs">{permission}</span> — this section is
        hidden.
      </div>
    </FormSection>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function useInvalidateWorkspace(workspaceId: string, section: "ai-tokens" | "api-credentials") {
  const queryClient = useQueryClient();
  return () =>
    void queryClient.invalidateQueries({ queryKey: ["admin-workspace", workspaceId, section] });
}

function WorkspaceSelect({
  workspaces,
  value,
  onChange,
}: {
  workspaces: AdminUserWorkspaceMembership[];
  value: string;
  onChange: (id: string) => void;
}) {
  if (workspaces.length <= 1) return null;
  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-full max-w-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {workspaces.map((w) => (
            <SelectItem key={w.workspaceId} value={w.workspaceId}>
              {w.workspaceName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function AiApiTab() {
  const { userId } = Route.useParams();

  const workspacesQuery = useQuery({
    queryKey: ["admin-user", userId, "workspaces"],
    queryFn: () => getAdminUserWorkspaces(userId),
  });

  if (workspacesQuery.isLoading) {
    return (
      <div className="space-y-2 rounded-2xl border bg-card p-4 shadow-soft">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (workspacesQuery.isError) {
    return (
      <ErrorNote error={workspacesQuery.error} onRetry={() => void workspacesQuery.refetch()} />
    );
  }

  const workspaces = workspacesQuery.data?.items ?? [];

  if (workspaces.length === 0) {
    return (
      <EmptyState icon={Building2} title="No workspace memberships">
        This user doesn't belong to any workspace, so there's nothing AI/API-scoped to show.
      </EmptyState>
    );
  }

  // Keyed by userId so navigating between two different users' AI & API tabs resets the local
  // workspace selection instead of carrying over a stale, possibly-invalid workspace id.
  return <AiApiTabContent key={userId} workspaces={workspaces} />;
}

function AiApiTabContent({ workspaces }: { workspaces: AdminUserWorkspaceMembership[] }) {
  const [selectedWs, setSelectedWs] = useState<string | undefined>(undefined);
  const activeWsId = selectedWs ?? workspaces[0].workspaceId;

  return (
    <div className="space-y-4">
      <WorkspaceSelect workspaces={workspaces} value={activeWsId} onChange={setSelectedWs} />
      <AiTokensPanel key={`tokens-${activeWsId}`} workspaceId={activeWsId} />
      <ApiCredentialsPanel key={`creds-${activeWsId}`} workspaceId={activeWsId} />
      <ApiUsagePanel key={`usage-${activeWsId}`} workspaceId={activeWsId} />
    </div>
  );
}

/* -------------------------------------------------------------------------
 * AI tokens panel — balance card + keyset-paginated ledger + Grant/Adjust/Reset-period.
 * ---------------------------------------------------------------------- */

const LEDGER_PAGE_SIZE = 25;

const ENTRY_TYPE_STYLES: Record<AdminWorkspaceLedgerEntryType, string> = {
  CONSUMPTION: "border-muted-foreground/30 text-muted-foreground",
  MANUAL_GRANT: "border-success/30 bg-success/10 text-success",
  ADJUSTMENT: "border-warning/30 bg-warning/10 text-warning",
  PERIOD_RESET: "border-chart-3/30 bg-chart-3/10 text-chart-3",
  REFUND: "border-primary/30 bg-primary/10 text-primary",
};

function BalanceCard({ summary }: { summary: AdminWorkspaceTokenSummary }) {
  const { balance } = summary;
  return (
    <div className="grid grid-cols-2 gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-4">
      <StatBlock label="Plan" value={summary.planKeySnapshot} />
      <StatBlock
        label="Allocated"
        value={balance.unlimited ? "Unlimited" : formatNum(balance.allocated)}
      />
      <StatBlock label="Consumed" value={formatNum(balance.consumed)} />
      <StatBlock label="Bonus" value={formatNum(balance.bonus)} />
      <StatBlock
        label="Remaining"
        value={balance.unlimited ? "Unlimited" : formatNum(balance.remaining)}
      />
      <StatBlock
        label="Period"
        value={`${formatDate(summary.periodStart)} – ${formatDate(summary.periodEnd)}`}
      />
      <StatBlock label="Last reset" value={formatDateTime(summary.lastResetAt)} />
    </div>
  );
}

function LedgerRow({ entry }: { entry: AdminWorkspaceLedgerEntry }) {
  const positive = entry.tokensDelta > 0;
  const negative = entry.tokensDelta < 0;
  return (
    <TableRow>
      <TableCell>
        <Badge variant="outline" className={cn("text-[10px]", ENTRY_TYPE_STYLES[entry.entryType])}>
          {humanizeEnum(entry.entryType)}
        </Badge>
      </TableCell>
      <TableCell
        className={cn(
          "font-mono text-xs",
          positive ? "text-success" : negative ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {positive ? "+" : ""}
        {entry.tokensDelta.toLocaleString()}
      </TableCell>
      <TableCell className="font-mono text-xs">{entry.balanceAfter.toLocaleString()}</TableCell>
      <TableCell
        className="max-w-[220px] truncate text-xs text-muted-foreground"
        title={entry.note ?? undefined}
      >
        {entry.note ?? "—"}
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
        {formatDateTime(entry.createdAt)}
      </TableCell>
    </TableRow>
  );
}

function GrantTokensDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [tokens, setTokens] = useState("");
  const [note, setNote] = useState("");
  const invalidate = useInvalidateWorkspace(workspaceId, "ai-tokens");

  const reset = () => {
    setTokens("");
    setNote("");
  };

  const mutation = useMutation({
    mutationFn: () => grantAiTokens(workspaceId, { tokens: Number(tokens), note: note.trim() }),
    onSuccess: () => {
      toast.success("Tokens granted.");
      setOpen(false);
      reset();
      invalidate();
    },
    onError: (err) => errorToast(err, "Failed to grant tokens."),
  });

  const tokensNum = Number(tokens);
  const valid =
    tokens.trim() !== "" && Number.isInteger(tokensNum) && tokensNum > 0 && note.trim().length > 0;

  // Every close affordance (Escape, overlay click, the DialogContent's own X, and the Cancel
  // button below) must route through this — a plain Cancel `<Button onClick>` doesn't go through
  // Radix's `onOpenChange` at all, so calling `setOpen(false)` from it directly would leave
  // `tokens`/`note` populated for the next time this dialog opens (the exact leak task-15-report's
  // fix round 1 found and fixed in `SetPasswordDialog`).
  const handleClose = () => {
    setOpen(false);
    reset();
  };

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
        <Coins className="h-3.5 w-3.5" /> Grant
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (mutation.isPending) return;
          if (next) {
            setOpen(next);
          } else {
            handleClose();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Grant bonus tokens</DialogTitle>
            <DialogDescription>
              Adds to this workspace's bonus balance immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="grant-tokens">Tokens</Label>
              <Input
                id="grant-tokens"
                type="number"
                min={1}
                value={tokens}
                onChange={(e) => setTokens(e.target.value)}
                placeholder="e.g. 500"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="grant-note">Note</Label>
              <Textarea
                id="grant-note"
                value={note}
                maxLength={1000}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Why is this grant being made?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? "Granting…" : "Grant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AdjustTokensDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");
  const invalidate = useInvalidateWorkspace(workspaceId, "ai-tokens");

  const reset = () => {
    setDelta("");
    setNote("");
  };

  const mutation = useMutation({
    mutationFn: () =>
      adjustWorkspaceAiTokens(workspaceId, { tokensDelta: Number(delta), note: note.trim() }),
    onSuccess: () => {
      toast.success("Balance adjusted.");
      setOpen(false);
      reset();
      invalidate();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "ZERO_ADJUSTMENT") {
        toast.error("Enter a non-zero amount.");
        return;
      }
      errorToast(err, "Failed to adjust balance.");
    },
  });

  const deltaNum = Number(delta);
  const valid =
    delta.trim() !== "" && Number.isInteger(deltaNum) && deltaNum !== 0 && note.trim().length > 0;

  // See `GrantTokensDialog`'s `handleClose` doc comment — same leak, same fix.
  const handleClose = () => {
    setOpen(false);
    reset();
  };

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
        <SlidersHorizontal className="h-3.5 w-3.5" /> Adjust
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (mutation.isPending) return;
          if (next) {
            setOpen(next);
          } else {
            handleClose();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust balance</DialogTitle>
            <DialogDescription>
              Positive adds, negative subtracts from the bonus balance — the correction lever for
              mistakes, not clamped at zero.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="adjust-delta">Amount</Label>
              <Input
                id="adjust-delta"
                type="number"
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                placeholder="e.g. -200 or 200"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adjust-note">Note</Label>
              <Textarea
                id="adjust-note"
                value={note}
                maxLength={1000}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Why is this correction being made?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? "Adjusting…" : "Adjust"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ResetPeriodDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const invalidate = useInvalidateWorkspace(workspaceId, "ai-tokens");

  const mutation = useMutation({
    mutationFn: () => resetWorkspaceAiTokenPeriod(workspaceId),
    onSuccess: () => {
      toast.success("Token period reset.");
      setOpen(false);
      invalidate();
    },
    onError: (err) => errorToast(err, "Failed to reset the token period."),
  });

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
        <RotateCcw className="h-3.5 w-3.5" /> Reset period
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => !mutation.isPending && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset this workspace's token period now?</AlertDialogTitle>
            <AlertDialogDescription>
              Recomputes the allocation for a fresh period immediately, ahead of its normal
              schedule. Nothing is lost — the reset itself is written to the ledger.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                mutation.mutate();
              }}
            >
              {mutation.isPending ? "Resetting…" : "Reset period"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function AiTokensPanel({ workspaceId }: { workspaceId: string }) {
  const canManage = usePlatformCan(AI_TOKENS_MANAGE);

  const summaryQuery = useQuery({
    queryKey: ["admin-workspace", workspaceId, "ai-tokens", "summary"],
    queryFn: () => getWorkspaceAiTokenSummary(workspaceId),
    enabled: canManage,
  });

  const ledgerQuery = useInfiniteQuery({
    queryKey: ["admin-workspace", workspaceId, "ai-tokens", "ledger"],
    queryFn: ({ pageParam, signal }: { pageParam: string | undefined; signal: AbortSignal }) =>
      getWorkspaceAiTokenLedger(
        workspaceId,
        { cursor: pageParam, limit: LEDGER_PAGE_SIZE },
        { signal },
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: canManage,
  });

  if (!canManage) {
    return <RestrictedPanel title="AI tokens" permission={AI_TOKENS_MANAGE} />;
  }

  const entries = ledgerQuery.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <FormSection
      title="AI tokens"
      description="Current-period balance and manual ledger entries for this workspace."
      actions={
        <>
          <GrantTokensDialog workspaceId={workspaceId} />
          <AdjustTokensDialog workspaceId={workspaceId} />
          <ResetPeriodDialog workspaceId={workspaceId} />
        </>
      }
    >
      {summaryQuery.isLoading ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : summaryQuery.isError ? (
        <ErrorNote error={summaryQuery.error} onRetry={() => void summaryQuery.refetch()} />
      ) : summaryQuery.data ? (
        <BalanceCard summary={summaryQuery.data} />
      ) : null}

      <div className="mt-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Ledger
        </h3>
        {ledgerQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : ledgerQuery.isError ? (
          <ErrorNote error={ledgerQuery.error} onRetry={() => void ledgerQuery.refetch()} />
        ) : entries.length === 0 ? (
          <EmptyState icon={Coins} title="No ledger entries yet" />
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Delta</TableHead>
                    <TableHead>Balance after</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <LedgerRow key={entry.id} entry={entry} />
                  ))}
                </TableBody>
              </Table>
            </div>
            {ledgerQuery.hasNextPage && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void ledgerQuery.fetchNextPage()}
                  disabled={ledgerQuery.isFetchingNextPage}
                >
                  {ledgerQuery.isFetchingNextPage ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    "Load more"
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </FormSection>
  );
}

/* -------------------------------------------------------------------------
 * API credentials panel — table + Revoke + Edit scopes/expiry.
 * ---------------------------------------------------------------------- */

const CREDENTIAL_STATUS_STYLES: Record<AdminApiCredentialStatus, string> = {
  active: "border-success/30 bg-success/10 text-success",
  expired: "border-warning/30 bg-warning/10 text-warning",
  revoked: "border-destructive/30 bg-destructive/10 text-destructive",
};

function RevokeCredentialDialog({
  workspaceId,
  credential,
  onOpenChange,
}: {
  workspaceId: string;
  credential: AdminApiCredential | null;
  onOpenChange: (open: boolean) => void;
}) {
  const invalidate = useInvalidateWorkspace(workspaceId, "api-credentials");

  const mutation = useMutation({
    mutationFn: () => revokeWorkspaceApiCredential(workspaceId, credential!.id),
    onSuccess: () => {
      toast.success("Credential revoked.");
      onOpenChange(false);
      invalidate();
    },
    onError: (err) => errorToast(err, "Failed to revoke credential."),
  });

  return (
    <AlertDialog
      open={credential !== null}
      onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke this API credential?</AlertDialogTitle>
          <AlertDialogDescription>
            {credential && `"${credential.name}" (${credential.keyPrefix}…) `}
            immediately stops authenticating any request signed with it. This can't be undone.
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
            {mutation.isPending ? "Revoking…" : "Revoke"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Always sends both `scopes`/`expiresAt` on save (server requires at least one) — simpler than a
 *  partial-field "only send what changed" form for a two-field dialog. Scopes are free text
 *  (comma-separated): no catalogue exists anywhere in the codebase to validate membership against
 *  (task-20-report.md §1/§5 finding 2), so this doesn't invent one either. */
function EditCredentialDialog({
  workspaceId,
  credential,
  onOpenChange,
}: {
  workspaceId: string;
  credential: AdminApiCredential | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [scopesText, setScopesText] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [noExpiry, setNoExpiry] = useState(false);
  const invalidate = useInvalidateWorkspace(workspaceId, "api-credentials");

  // Re-seed the form fresh every time a different credential opens.
  useEffect(() => {
    if (credential) {
      setScopesText(credential.scopes.join(", "));
      setExpiresAt(credential.expiresAt ? credential.expiresAt.slice(0, 10) : "");
      setNoExpiry(!credential.expiresAt);
    }
  }, [credential]);

  const mutation = useMutation({
    mutationFn: () => {
      const scopes = scopesText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 50);
      return updateWorkspaceApiCredential(workspaceId, credential!.id, {
        scopes,
        expiresAt: noExpiry ? null : expiresAt ? new Date(expiresAt).toISOString() : null,
      });
    },
    onSuccess: () => {
      toast.success("Credential updated.");
      onOpenChange(false);
      invalidate();
    },
    onError: (err) => errorToast(err, "Failed to update credential."),
  });

  return (
    <Dialog
      open={credential !== null}
      onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {credential ? `"${credential.name}"` : "credential"}</DialogTitle>
          <DialogDescription>
            No scope catalogue exists yet — scopes are free text, stored as-is.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-cred-scopes">Scopes (comma-separated)</Label>
            <Textarea
              id="edit-cred-scopes"
              value={scopesText}
              onChange={(e) => setScopesText(e.target.value)}
              placeholder="e.g. read:leads, write:automations"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-cred-expiry">Expires</Label>
            <Input
              id="edit-cred-expiry"
              type="date"
              value={expiresAt}
              disabled={noExpiry}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox checked={noExpiry} onCheckedChange={(v) => setNoExpiry(v === true)} />
              No expiry
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApiCredentialsPanel({ workspaceId }: { workspaceId: string }) {
  const canManage = usePlatformCan(WORKSPACE_MANAGE);
  const credsQuery = useQuery({
    queryKey: ["admin-workspace", workspaceId, "api-credentials"],
    queryFn: () => listWorkspaceApiCredentials(workspaceId),
    enabled: canManage,
  });
  const [revokeTarget, setRevokeTarget] = useState<AdminApiCredential | null>(null);
  const [editTarget, setEditTarget] = useState<AdminApiCredential | null>(null);

  if (!canManage) {
    return <RestrictedPanel title="API credentials" permission={WORKSPACE_MANAGE} />;
  }

  const creds = credsQuery.data?.credentials ?? [];

  return (
    <FormSection title="API credentials" description="Every API key issued inside this workspace.">
      {credsQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : credsQuery.isError ? (
        <ErrorNote error={credsQuery.error} onRetry={() => void credsQuery.refetch()} />
      ) : creds.length === 0 ? (
        <EmptyState icon={KeyRound} title="No API credentials">
          No keys have been issued in this workspace.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creds.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-sm">{c.name}</TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">{c.keyPrefix}…</span>
                  </TableCell>
                  <TableCell>
                    {c.scopes.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {c.scopes.slice(0, 3).map((s) => (
                          <Badge key={s} variant="outline" className="text-[10px]">
                            {s}
                          </Badge>
                        ))}
                        {c.scopes.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{c.scopes.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] capitalize", CREDENTIAL_STATUS_STYLES[c.status])}
                    >
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDate(c.createdAt)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {c.lastUsedAt ? formatDateTime(c.lastUsedAt) : "Never"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {c.expiresAt ? formatDate(c.expiresAt) : "No expiry"}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditTarget(c)}>
                        Edit
                      </Button>
                      {c.status !== "revoked" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setRevokeTarget(c)}
                        >
                          Revoke
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <RevokeCredentialDialog
        workspaceId={workspaceId}
        credential={revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
      />
      <EditCredentialDialog
        workspaceId={workspaceId}
        credential={editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
      />
    </FormSection>
  );
}

/* -------------------------------------------------------------------------
 * API usage panel — totals + a plain daily table for the selected window.
 * ---------------------------------------------------------------------- */

const USAGE_WINDOW_OPTIONS = [7, 30, 90] as const;

function ApiUsagePanel({ workspaceId }: { workspaceId: string }) {
  const canManage = usePlatformCan(WORKSPACE_MANAGE);
  const [days, setDays] = useState<number>(30);
  const usageQuery = useQuery({
    queryKey: ["admin-workspace", workspaceId, "api-usage", days],
    queryFn: () => getWorkspaceApiUsage(workspaceId, days),
    enabled: canManage,
  });

  if (!canManage) {
    return <RestrictedPanel title="API usage" permission={WORKSPACE_MANAGE} />;
  }

  return (
    <FormSection
      title="API usage"
      description="Daily scheduler/automation/API-request volume for this workspace."
      actions={
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="h-8 w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {USAGE_WINDOW_OPTIONS.map((d) => (
              <SelectItem key={d} value={String(d)}>
                {d}d
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      {usageQuery.isLoading ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : usageQuery.isError ? (
        <ErrorNote error={usageQuery.error} onRetry={() => void usageQuery.refetch()} />
      ) : usageQuery.data ? (
        <>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <StatBlock
              label="Scheduler posts"
              value={formatNum(usageQuery.data.totals.schedulerPosts)}
            />
            <StatBlock label="Automations" value={formatNum(usageQuery.data.totals.automations)} />
            <StatBlock label="API requests" value={formatNum(usageQuery.data.totals.apiRequests)} />
          </div>
          {usageQuery.data.series.length === 0 ? (
            <EmptyState icon={ActivityIcon} title="No usage recorded">
              Nothing logged for this window.
            </EmptyState>
          ) : (
            <div className="max-h-64 overflow-y-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Scheduler posts</TableHead>
                    <TableHead>Automations</TableHead>
                    <TableHead>API requests</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usageQuery.data.series.map((row) => (
                    <TableRow key={row.usageDate}>
                      <TableCell className="text-xs">{formatDate(row.usageDate)}</TableCell>
                      <TableCell className="text-xs">
                        {row.schedulerPosts.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">{row.automations.toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{row.apiRequests.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      ) : null}
    </FormSection>
  );
}
