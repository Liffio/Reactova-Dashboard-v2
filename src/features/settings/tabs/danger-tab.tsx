import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Download, FileText, Loader2, Trash2, X } from "lucide-react";

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
import {
  IconTile,
  ListRow,
  SettingsButton,
  SettingsCard,
  SettingsPanel,
  StatusChip,
  settingsButtonClass,
  shortDate,
  timeAgo,
} from "../components";

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
    <SettingsPanel>
      <ExportCard />
      <DeleteCard />
    </SettingsPanel>
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
    >
      {list.map((e) => {
        const status = EXPORT_STATUS[e.status];
        const filename = `liffio-export-${e.createdAt.slice(0, 10)}.zip`;
        return (
          <ListRow
            key={e.id}
            className="py-[18px]"
            icon={
              <IconTile>
                <FileText />
              </IconTile>
            }
            title={
              <>
                {filename}
                <StatusChip tone={status.tone} icon={e.status === "ready" ? <Check /> : undefined}>
                  {status.label}
                </StatusChip>
              </>
            }
            description={
              <>
                Requested {timeAgo(e.createdAt)}
                {e.status === "ready" && e.expiresAt
                  ? ` · link expires ${shortDate(e.expiresAt)}`
                  : ""}
              </>
            }
            actions={
              e.status === "ready" ? (
                <SettingsButton
                  onClick={() =>
                    accountApi
                      .downloadExport(e.id, filename)
                      .catch((err) => toast.error(getUserErrorMessage(err)))
                  }
                >
                  <Download />
                  <span>Download</span>
                </SettingsButton>
              ) : undefined
            }
          />
        );
      })}
      <div className="flex flex-col gap-3 border-t border-border px-5 py-4 first:border-t-0 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span className="text-[13px] text-muted-foreground">
          One export every 24 hours. We'll email you when it's ready.
        </span>
        <SettingsButton disabled={request.isPending} onClick={() => request.mutate()}>
          {request.isPending && <Loader2 className="animate-spin" />}
          <span>Request export</span>
        </SettingsButton>
      </div>
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
    <section className="overflow-hidden rounded-[16px] border border-[#F3B8C1] bg-card dark:border-destructive-edge">
      <div className="flex gap-[18px] bg-[#FDECEE] px-5 py-[22px] sm:px-6 dark:bg-destructive-wash">
        <IconTile tone="danger">
          <AlertTriangle />
        </IconTile>
        <div className="flex flex-col gap-1">
          <h2 className="m-0 font-display text-[20px] font-semibold text-[#8F0A2B] dark:text-destructive">
            Delete account
          </h2>
          <p className="m-0 text-sm leading-normal text-[#6B1422] dark:text-foreground/80">
            {graceDays
              ? `We keep it for ${graceDays} days in case you change your mind. After that your workspaces, automations and photo are gone. Invoices stay, because tax law says so.`
              : "Permanently delete your account."}
          </p>
        </div>
      </div>

      <div className="px-5 pb-1 pt-2 sm:px-6">
        {check.isLoading && (
          <p className="m-0 py-3 text-sm text-muted-foreground">
            Checking what's left to sort out…
          </p>
        )}
        {check.error && (
          <p className="m-0 py-3 text-sm text-destructive">{getUserErrorMessage(check.error)}</p>
        )}
        {check.data && (
          <div className="py-3 text-xs font-bold uppercase tracking-[0.06em] text-muted-foreground">
            Before you can delete
          </div>
        )}
        {blockers.map((b, i) => {
          const action = BLOCKER_ACTION[b.code];
          return (
            <div
              key={`${b.code}-${i}`}
              className="flex flex-wrap items-center gap-3.5 border-t border-[#F6D5DA] py-3.5 sm:flex-nowrap dark:border-destructive-edge"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#FDECEE] text-[#B0122B] dark:bg-destructive-wash dark:text-destructive">
                <X className="size-[15px]" strokeWidth={2.6} />
              </span>
              <span className="min-w-0 flex-grow text-sm font-semibold text-foreground">
                {b.message}
              </span>
              {action && (
                <Link to={action.to} className={settingsButtonClass()}>
                  <span>{action.label}</span>
                </Link>
              )}
            </div>
          );
        })}
        {check.data && blockers.length === 0 && (
          <div className="flex items-center gap-3.5 border-t border-[#F6D5DA] py-3.5 dark:border-destructive-edge">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#E6F6EC] text-[#03A14A] dark:bg-success-wash">
              <Check className="size-[15px]" strokeWidth={2.6} />
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-foreground">
                Nothing blocking deletion
              </span>
              <span className="text-[13px] text-muted-foreground">You're clear to go ahead.</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-[#F6D5DA] bg-[#FFFBFB] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-destructive-edge dark:bg-transparent">
        <span className="text-[13px] text-muted-foreground">
          {blockers.length > 0
            ? `${blockers.length} thing${blockers.length === 1 ? "" : "s"} left to sort out`
            : check.data
              ? "Nothing left to sort out"
              : ""}
        </span>
        <SettingsButton
          variant="danger"
          disabled={!check.data?.canDelete}
          onClick={() => setOpen(true)}
        >
          <Trash2 />
          <span>Delete my account</span>
        </SettingsButton>
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
    </section>
  );
}
