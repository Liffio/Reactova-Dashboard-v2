import { useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { CheckCircle, XCircle, Loader2, Users } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useAppSelector } from "@/store/hooks";
import { useInvitePreviewQuery, useAcceptInviteMutation } from "@/hooks/useTeamAccess";
import { toast } from "@/components/ui/sonner";

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const isLoggedIn = useAppSelector((s) => Boolean(s.auth.accessToken));

  const previewQuery = useInvitePreviewQuery(isLoggedIn ? token : null);
  const acceptMutation = useAcceptInviteMutation();

  // Redirect to login if not authenticated, preserving the return URL
  useEffect(() => {
    if (!isLoggedIn && token) {
      navigate(`/login?redirect=/accept-invite?token=${encodeURIComponent(token)}`, { replace: true });
    }
  }, [isLoggedIn, token, navigate]);

  const onAccept = async () => {
    if (!token) return;
    try {
      await acceptMutation.mutateAsync(token);
      toast.success("You've joined the workspace!");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error((err as Error).message ?? "Failed to accept invite");
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <Logo className="h-8 mb-8" />
        <div className="flex flex-col items-center gap-3 text-center max-w-sm">
          <XCircle className="h-12 w-12 text-destructive" />
          <h1 className="text-xl font-semibold">Invalid invite link</h1>
          <p className="text-sm text-muted-foreground">This invite link appears to be missing or malformed.</p>
          <Button asChild variant="outline" className="mt-2">
            <Link to="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return null;
  }

  if (previewQuery.isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <Logo className="h-8 mb-8" />
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (previewQuery.isError || !previewQuery.data) {
    const errorMsg = (previewQuery.error as Error)?.message ?? "Invite not found";
    const isExpired = errorMsg.toLowerCase().includes("expired");
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <Logo className="h-8 mb-8" />
        <div className="flex flex-col items-center gap-3 text-center max-w-sm">
          <XCircle className="h-12 w-12 text-destructive" />
          <h1 className="text-xl font-semibold">{isExpired ? "Invite expired" : "Invite not available"}</h1>
          <p className="text-sm text-muted-foreground">
            {isExpired
              ? "This invite link has expired. Ask the workspace owner to send a new invitation."
              : "This invite link is no longer valid — it may have already been used or revoked."}
          </p>
          <Button asChild variant="outline" className="mt-2">
            <Link to="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { workspaceName, inviterName, roleName, expiresAt } = previewQuery.data;
  const expiresDate = new Date(expiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <Logo className="h-8 mb-8" />
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">You've been invited</h1>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-medium text-foreground">{inviterName}</span> invited you to join
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-background/50 p-4 space-y-3 text-sm">
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
            <CheckCircle className="h-8 w-8 text-green-500" />
            <p className="text-sm font-medium">You've joined {workspaceName}!</p>
            <Button asChild className="mt-1 w-full">
              <Link to="/dashboard">Go to dashboard</Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Button
              className="w-full"
              onClick={onAccept}
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
          <p className="text-sm text-destructive text-center -mt-2">
            {(acceptMutation.error as Error).message}
          </p>
        )}
      </div>
    </div>
  );
}
