import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Loader2, Users, XCircle } from "lucide-react";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth/auth-shell";
import { useMounted } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { acceptInviteByToken, getInvitePreview } from "@/lib/api/auth-api";
import { useAuthState } from "@/lib/auth/auth-store";

type AcceptInviteSearch = {
  token?: string;
};

export const Route = createFileRoute("/accept-invite")({
  validateSearch: (search: Record<string, unknown>): AcceptInviteSearch => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  head: () => ({ meta: [{ title: "Accept invite — Liffio" }] }),
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const token = search.token ?? null;
  const mounted = useMounted();
  const queryClient = useQueryClient();
  const isLoggedIn = useAuthState((s) => Boolean(s.accessToken));

  const previewQuery = useQuery({
    queryKey: ["invite-preview", token],
    queryFn: () => getInvitePreview(token!),
    enabled: Boolean(token) && isLoggedIn,
    retry: false,
  });

  const acceptMutation = useMutation({
    mutationFn: acceptInviteByToken,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      void queryClient.invalidateQueries({ queryKey: ["inbox"] });
    },
  });

  useEffect(() => {
    if (mounted && !isLoggedIn && token) {
      void navigate({
        to: "/login",
        search: { redirect: `/accept-invite?token=${encodeURIComponent(token)}` },
        replace: true,
      });
    }
  }, [mounted, isLoggedIn, token, navigate]);

  const onAccept = async () => {
    if (!token) return;
    try {
      await acceptMutation.mutateAsync(token);
      toast.success("You've joined the workspace!");
      void navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error((err as Error).message ?? "Failed to accept invite");
    }
  };

  if (!mounted) return null;

  if (!token) {
    return (
      <AuthShell maxWidth="sm" aside={null}>
        <div className="flex flex-col items-center gap-3 text-center">
          <XCircle className="h-12 w-12 text-destructive" />
          <h1 className="font-display text-xl font-semibold">Invalid invite link</h1>
          <p className="text-sm text-muted-foreground">
            This invite link appears to be missing or malformed.
          </p>
          <Button asChild variant="outline" className="mt-2 w-full">
            <Link to="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  if (!isLoggedIn) {
    return null;
  }

  if (previewQuery.isLoading) {
    return (
      <AuthShell maxWidth="sm" aside={null}>
        <div className="flex flex-col items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AuthShell>
    );
  }

  if (previewQuery.isError || !previewQuery.data) {
    const errorMsg = (previewQuery.error as Error | null)?.message ?? "Invite not found";
    const isExpired = errorMsg.toLowerCase().includes("expired");
    return (
      <AuthShell maxWidth="sm" aside={null}>
        <div className="flex flex-col items-center gap-3 text-center">
          <XCircle className="h-12 w-12 text-destructive" />
          <h1 className="font-display text-xl font-semibold">
            {isExpired ? "Invite expired" : "Invite not available"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isExpired
              ? "This invite link has expired. Ask the workspace owner to send a new invitation."
              : "This invite link is no longer valid — it may have already been used or revoked."}
          </p>
          <Button asChild variant="outline" className="mt-2 w-full">
            <Link to="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  const { workspaceName, inviterName, roleName, expiresAt } = previewQuery.data;
  const expiresDate = new Date(expiresAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <AuthShell maxWidth="sm" aside={null}>
      <div className="space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-accent">
            <Users className="h-7 w-7 text-accent-foreground" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold">You've been invited</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{inviterName}</span> invited you to
              join
            </p>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border bg-muted/40 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Workspace</span>
            <span className="font-medium">{workspaceName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Role</span>
            <span className="font-medium capitalize">{roleName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Expires</span>
            <span className="text-muted-foreground">{expiresDate}</span>
          </div>
        </div>

        {acceptMutation.isSuccess ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <CheckCircle className="h-8 w-8 text-success" />
            <p className="text-sm font-medium">You've joined {workspaceName}!</p>
            <Button asChild className="mt-1 w-full">
              <Link to="/dashboard">Go to dashboard</Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Button
              className="w-full"
              onClick={() => void onAccept()}
              disabled={acceptMutation.isPending}
            >
              {acceptMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Accept invitation
            </Button>
            <Button variant="ghost" asChild className="w-full">
              <Link to="/dashboard">Decline</Link>
            </Button>
          </div>
        )}

        {acceptMutation.isError && (
          <p className="text-center text-sm text-destructive">
            {(acceptMutation.error as Error).message}
          </p>
        )}
      </div>
    </AuthShell>
  );
}
