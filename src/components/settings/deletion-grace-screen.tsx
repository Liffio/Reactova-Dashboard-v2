import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { accountApi } from "@/lib/api/account-api";
import { useLogoutMutation } from "@/hooks/use-auth";
import { loginPathWithRedirect } from "@/lib/auth/auth-navigation";
import { getUserErrorMessage } from "@/lib/user-facing-error";
import { toast } from "@/lib/toast";

/**
 * Full-screen stop during the account-deletion grace period (plan/settings-revamp.md). The server
 * already closes the workspace API (`ACCOUNT_DELETION_SCHEDULED`); this is the only thing a
 * scheduled account can see: cancel the deletion, or log out.
 */
export function DeletionGraceScreen({ scheduledFor }: { scheduledFor: string }) {
  const queryClient = useQueryClient();
  const logout = useLogoutMutation();
  const [busy, setBusy] = useState(false);
  const when = new Date(scheduledFor).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const cancel = async () => {
    setBusy(true);
    try {
      await accountApi.cancelDeletion();
      toast.success(
        "Deletion cancelled. Your automations stay paused until you turn them back on.",
      );
      await queryClient.invalidateQueries({ queryKey: ["auth-me"] });
    } catch (e) {
      toast.error(getUserErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-soft">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-destructive/10">
          <Trash2 className="h-6 w-6 text-destructive" />
        </div>
        <h1 className="font-display text-xl font-semibold">Scheduled for deletion on {when}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account and the workspaces you own will be permanently deleted on that date. Cancel
          now to keep everything.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={() => void cancel()} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Cancel deletion
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              logout.mutate(undefined, {
                onSettled: () => window.location.replace(loginPathWithRedirect("/")),
              })
            }
          >
            Log out
          </Button>
        </div>
      </div>
    </div>
  );
}
