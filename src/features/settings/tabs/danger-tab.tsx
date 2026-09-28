import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { accountApi, type DataExport, type DeletionBlocker } from "@/lib/api/account-api";
import { useAuthState } from "@/lib/auth/auth-store";
import { useLogoutMutation } from "@/hooks/use-auth";
import { loginPathWithRedirect } from "@/lib/auth/auth-navigation";
import { getUserErrorMessage } from "@/lib/user-facing-error";
import { toast } from "@/lib/toast";
import { SettingsCard, StatusChip, shortDate, timeAgo } from "../components";

const EXPORT_STATUS: Record<
  DataExport["status"],
  { label: string; tone: "success" | "warning" | "muted" | "danger" }
> = {
  queued: { label: "Preparing", tone: "warning" },
  ready: { label: "Ready", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  expired: { label: "Expired", tone: "muted" },
};

/** Where each blocker is fixed — the blocker codes come from the server's deletion check. */
const BLOCKER_ACTION: Record<DeletionBlocker["code"], { label: string; to: string }> = {
  OWNS_WORKSPACE_WITH_MEMBERS: { label: "Manage team", to: "/settings/team" },
  ACTIVE_SUBSCRIPTION: { label: "Go to billing", to: "/settings/billing" },
  OWNS_WORKSPACE_GROUP: { label: "Open agency", to: "/agency" },
};

export function DangerTab() {
  return (
    <div className="space-y-6">
      <ExportCard />
      <DeleteCard />
    </div>
  );
}

function ExportCard() {
  const queryClient = useQueryClient();
  const exports = useQuery({
    queryKey: ["account-exports"],
    queryFn: accountApi.listExports,
    // Poll while one is being built.
    refetchInterval: (q) =>
      q.state.data?.exports.some((e) => e.status === "queued") ? 5000 : false,
  });
  const request = useMutation({
    mutationFn: accountApi.requestExport,
    onSuccess: () => {
      toast.success("Export requested. We'll email you when it's ready.");
      void queryClient.invalidateQueries({ queryKey: ["account-exports"] });
    },
    onError: (e) => toast.error(getUserErrorMessage(e)),
  });

  const list = exports.data?.exports ?? [];

  return (
    <SettingsCard
      title="Export your data"
      description="A zip of your profile, workspaces, automations, leads, posts and invoices."
      actions={
        <Button
          variant="outline"
          size="sm"
          disabled={request.isPending}
          onClick={() => request.mutate()}
        >
          {request.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Request export
        </Button>
      }
    >
      {list.length === 0 && (
        <p className="px-5 py-4 text-sm text-muted-foreground">
          One export every 24 hours. We'll email you when it's ready.
        </p>
      )}
      {list.map((e) => {
        const status = EXPORT_STATUS[e.status];
        const filename = `liffio-export-${e.createdAt.slice(0, 10)}.zip`;
        return (
          <div key={e.id} className="flex items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                {filename} <StatusChip tone={status.tone}>{status.label}</StatusChip>
              </div>
              <p className="text-xs text-muted-foreground">
                Requested {timeAgo(e.createdAt)}
                {e.status === "ready" && e.expiresAt
                  ? ` · link expires ${shortDate(e.expiresAt)}`
                  : ""}
              </p>
            </div>
            {e.status === "ready" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  accountApi
                    .downloadExport(e.id, filename)
                    .catch((err) => toast.error(getUserErrorMessage(err)))
                }
              >
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            )}
          </div>
        );
      })}
    </SettingsCard>
  );
}

function DeleteCard() {
  const email = useAuthState((s) => s.user?.email ?? "");
  const logout = useLogoutMutation();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const check = useQuery({
    queryKey: ["account-deletion-check"],
    queryFn: accountApi.deletionCheck,
  });

  const remove = useMutation({
    mutationFn: () => accountApi.deleteAccount(typed),
    onSuccess: () => {
      toast.success(
        "Your account is scheduled for deletion. Log in any time before then to cancel.",
      );
      logout.mutate(undefined, {
        onSettled: () => window.location.replace(loginPathWithRedirect("/")),
      });
    },
    onError: (e) => toast.error(getUserErrorMessage(e)),
  });

  const blockers = check.data?.blockers ?? [];
  const graceDays = check.data?.graceDays;

  return (
    <SettingsCard
      tone="danger"
      title="Delete account"
      description={
        graceDays
          ? `We keep it for ${graceDays} days in case you change your mind. After that your workspaces, automations and photo are gone. Invoices stay, because tax law says so.`
          : "Permanently delete your account."
      }
    >
      <div className="space-y-3 px-5 py-4">
        {check.isLoading && (
          <p className="text-sm text-muted-foreground">Checking what's left to sort out…</p>
        )}
        {check.error && (
          <p className="text-sm text-destructive">{getUserErrorMessage(check.error)}</p>
        )}
        {blockers.length > 0 && (
          <>
            <p className="text-sm font-medium">Before you can delete</p>
            {blockers.map((b, i) => {
              const action = BLOCKER_ACTION[b.code];
              return (
                <div
                  key={`${b.code}-${i}`}
                  className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/5 p-3"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <p className="flex-1 text-sm">{b.message}</p>
                  {action && (
                    <Link
                      to={action.to}
                      className="shrink-0 text-sm font-medium text-primary hover:underline"
                    >
                      {action.label}
                    </Link>
                  )}
                </div>
              );
            })}
          </>
        )}
        {check.data && blockers.length === 0 && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-success" /> Nothing blocking deletion.
          </p>
        )}
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-xs text-muted-foreground">
            {blockers.length > 0
              ? `${blockers.length} thing${blockers.length === 1 ? "" : "s"} left to sort out`
              : ""}
          </span>
          <Button
            variant="destructive"
            disabled={!check.data?.canDelete}
            onClick={() => setOpen(true)}
          >
            Delete my account
          </Button>
        </div>
      </div>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setTyped("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              You'll be signed out everywhere and your automations will pause. Type{" "}
              <strong>{email}</strong> to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-delete-email">Your email</Label>
            <Input
              id="confirm-delete-email"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={remove.isPending}>
              Keep my account
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending || typed.trim().toLowerCase() !== email.toLowerCase()}
              onClick={() => remove.mutate()}
            >
              {remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsCard>
  );
}
