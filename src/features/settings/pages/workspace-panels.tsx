/**
 * Workspace settings panels carried over from the old single-page `/settings` (plan/settings-revamp.md).
 * Each is rendered by its own tab route now; the hardcoded plan→seat map that lived here is gone
 * (Team reads its limit from the server).
 */
import { useEffect, useState } from "react";
import { WorkspaceIdChip } from "@/components/workspace-id-chip";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Copy, Instagram, KeyRound, Plus, Shield, Trash2, Users } from "lucide-react";
import { toast } from "@/lib/toast";

import { PageHeader } from "@/components/dashboard/page-header";
import { SendRateCard } from "@/components/settings/send-rate-card";
import { ProtectedRoute } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateWorkspace, deleteWorkspace } from "@/lib/api/workspaces-api";
import {
  getMetaOAuthStartUrl,
  isWorkspaceInstagramConnected,
  unlinkMetaIntegration,
} from "@/lib/api/integrations-api";
import { openMetaOAuthPopup } from "@/lib/meta-oauth-popup";
import { ApiDocsContent } from "@/components/api-docs-content";
import { useApp } from "@/state/app-context";
import { useAuthState } from "@/lib/auth/auth-store";
import {
  listApiCredentials,
  createApiCredential,
  revokeApiCredential,
  type ApiCredentialItem,
} from "@/lib/api/api-credentials-api";
import { mfaSetupStart, mfaSetupVerify, mfaSetupCancel, mfaSetChannels } from "@/lib/api/auth-api";
import { apiRequest } from "@/lib/api/http";
import { apiUri } from "@/lib/api/apiUri";
import {
  getNotificationPreferences,
  updateNotificationPreference,
} from "@/lib/api/notifications-api";
import {
  listTeamInvites,
  getTeamOptions,
  createTeamInvite,
  revokeTeamInvite,
  removeTeamMember,
  updateTeamMember,
  type TeamMember,
} from "@/lib/api/team-api";
import { useServerList } from "@/hooks/use-server-list";
import { LIMITS, emailError, lengthError, duplicateAliasError } from "@/lib/validation";
import { useTouched } from "@/hooks/use-touched";
import { formatHandle } from "@/lib/format";
import { isWorkspaceReady } from "@/lib/api/active-workspace";
import { useCan } from "@/hooks/use-auth";
import { FeatureGate } from "@/components/access/feature-gate";

export function GeneralSettings() {
  const { current, workspaces, setCurrentId, refreshAuth } = useApp();
  const workspaceId = current.id;
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(current.name);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const touched = useTouched();

  useEffect(() => {
    setDisplayName(current.name);
  }, [current.name]);

  const nameError = lengthError(displayName, "Workspace name", LIMITS.workspaceName);

  const saveMutation = useMutation({
    mutationFn: () => updateWorkspace(workspaceId, { displayName: displayName.trim() }),
    onSuccess: () => {
      toast.success("Workspace name saved");
      void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      void refreshAuth();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteWorkspace(workspaceId),
    onSuccess: async () => {
      const next = workspaces.find((w) => w.id !== workspaceId);
      setCurrentId(next?.id ?? "");
      await refreshAuth();
      toast.success("Workspace deleted");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card p-6 shadow-soft">
        <h2 className="mb-4 font-display text-base font-semibold">Workspace</h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ws-name">Display name</Label>
            <Input
              id="ws-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, LIMITS.workspaceName.max))}
              onBlur={touched.onBlur("name")}
              maxLength={LIMITS.workspaceName.max}
              aria-invalid={touched.visible("name") && Boolean(nameError)}
            />
            <div className="flex items-center justify-between text-xs">
              <span className="text-destructive">
                {touched.visible("name") && nameError ? nameError : ""}
              </span>
              <span className="text-muted-foreground">
                {displayName.length}/{LIMITS.workspaceName.max}
              </span>
            </div>
          </div>
          {current.humanId && (
            <div className="space-y-1">
              <Label className="text-muted-foreground">Workspace ID</Label>
              <WorkspaceIdChip humanId={current.humanId} size="md" />
              <p className="text-[11px] text-muted-foreground">
                Use this when contacting support or calling the API. It stays the same even if you
                rename the workspace.
              </p>
            </div>
          )}
          <div className="space-y-1">
            {/* The uuid stays visible — existing integrations and support tickets reference it. */}
            <Label className="text-muted-foreground">Internal ID (UUID)</Label>
            <div className="flex items-center gap-2">
              <code className="rounded-md bg-muted px-2 py-1 font-mono text-xs">{workspaceId}</code>
              <button
                className="text-muted-foreground hover:text-foreground"
                onClick={() => {
                  void navigator.clipboard.writeText(workspaceId);
                  toast.success("Copied!");
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground">Plan</Label>
            <p className="text-sm font-medium capitalize">{current.plan.toLowerCase()}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button
            size="sm"
            disabled={saveMutation.isPending || displayName === current.name || Boolean(nameError)}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 space-y-4">
        <h2 className="font-display text-base font-semibold text-destructive">Danger zone</h2>
        <p className="text-sm text-muted-foreground">
          Permanently delete this workspace and all its automations, leads, and short links.
        </p>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.checked)}
          />
          I understand this permanently deletes this workspace and all its data.
        </label>
        <Button
          variant="destructive"
          size="sm"
          disabled={!deleteConfirm || deleteMutation.isPending || workspaces.length <= 1}
          onClick={() => deleteMutation.mutate()}
        >
          {deleteMutation.isPending ? "Deleting…" : "Delete workspace"}
        </Button>
        {workspaces.length <= 1 && (
          <p className="text-xs text-muted-foreground">
            At least one workspace must remain on your account.
          </p>
        )}
      </div>
    </div>
  );
}

export function InstagramSettings() {
  const { current, refreshAuth, setCurrentId } = useApp();
  const workspaceId = current.id;
  const queryClient = useQueryClient();
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const unlinkMutation = useMutation({
    mutationFn: () => unlinkMetaIntegration(workspaceId),
    onSuccess: () => {
      toast.success("Instagram disconnected");
      setUnlinkOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      void refreshAuth();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const handleConnect = async () => {
    if (isConnecting) return;
    const wasAlreadyConnected = current.instagramConnected;
    setIsConnecting(true);
    try {
      const result = await openMetaOAuthPopup(
        async () => {
          const { url } = await getMetaOAuthStartUrl(workspaceId, "settings");
          return url;
        },
        {
          oauthWorkspaceId: workspaceId,
          checkConnected: wasAlreadyConnected
            ? undefined
            : () => isWorkspaceInstagramConnected(workspaceId),
          verifyConnected: () => isWorkspaceInstagramConnected(workspaceId),
          // Backend may connect Instagram to a different workspace than the one
          // that initiated OAuth — use the workspace from the result for verification.
          verifyConnectedForWorkspace: (wid) => isWorkspaceInstagramConnected(wid),
        },
      );
      if (result.meta === "connected") {
        toast.success(
          result.igHandle ? `Connected as ${formatHandle(result.igHandle)}` : "Instagram connected",
        );
        // Switch to whichever workspace actually received the connection
        if (result.workspaceId && result.workspaceId !== workspaceId) {
          setCurrentId(result.workspaceId);
        }
        void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
        void refreshAuth();
      } else if (result.reason && result.reason !== "user_canceled") {
        toast.error("Instagram connect failed. Please try again.");
      }
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("Popup blocked")) {
        toast.error("Popup blocked — allow popups for this site and try again.");
      } else {
        toast.error(msg || "Instagram connect failed.");
      }
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-soft">
      <div className="flex items-center gap-3 mb-6">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
          <Instagram className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="font-display text-base font-semibold">Instagram</h2>
          <p className="text-sm text-muted-foreground">
            Connect your Instagram Professional account to enable automations.
          </p>
        </div>
      </div>

      <Separator className="mb-6" />

      {current.instagramConnected ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-success" />
            <span className="text-sm font-medium text-success">Connected</span>
            {current.igHandle && (
              <span className="text-sm text-muted-foreground">
                · {formatHandle(current.igHandle)}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Your Instagram account is connected and automations are active.
          </p>
          <div className="flex gap-3">
            <Button
              size="sm"
              variant="outline"
              disabled={isConnecting}
              onClick={() => void handleConnect()}
            >
              {isConnecting ? "Connecting…" : "Reconnect"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setUnlinkOpen(true)}
            >
              Disconnect
            </Button>
          </div>

          <Separator />

          {/* Send rate lives with the connection rather than under automations: it is a property
              of the Instagram account, and every automation on it shares the same budget. */}
          <SendRateCard />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-warning" />
            <span className="text-sm font-medium text-warning">Not connected</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Connect your Instagram Professional account to start sending automated DMs.
          </p>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            {[
              "Requires an Instagram Professional account",
              "Your account must be linked to a Facebook Page",
              "You must be the admin of the Facebook Page",
            ].map((r) => (
              <li key={r} className="flex items-start gap-1.5">
                <span className="mt-0.5 shrink-0 text-warning">•</span>
                {r}
              </li>
            ))}
          </ul>
          <Button
            size="sm"
            className="gap-1.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:opacity-90"
            disabled={isConnecting}
            onClick={() => void handleConnect()}
          >
            {isConnecting ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Instagram className="h-4 w-4" />
            )}
            {isConnecting ? "Connecting…" : "Connect Instagram"}
          </Button>
        </div>
      )}

      <AlertDialog open={unlinkOpen} onOpenChange={setUnlinkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Instagram?</AlertDialogTitle>
            <AlertDialogDescription>
              All active automations will stop sending DMs. You can reconnect at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={unlinkMutation.isPending}
              onClick={() => unlinkMutation.mutate()}
            >
              {unlinkMutation.isPending ? "Disconnecting…" : "Disconnect"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function ApiCredentialsSettings() {
  const workspaceId = useApp().current.id;
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const credsQuery = useQuery({
    queryKey: ["api-credentials", workspaceId],
    queryFn: () => listApiCredentials(workspaceId),
    enabled: isWorkspaceReady(workspaceId),
  });

  const createMutation = useMutation({
    // A key that never expires is `api:key_expiry`; without it the server issues the default TTL.
    mutationFn: (name: string) =>
      createApiCredential(workspaceId, {
        name,
        neverExpires: credsQuery.data?.capabilities?.keyExpiry ?? false,
      }),
    onSuccess: (data) => {
      toast.success(`API key created — copy your secret key now:\n${data.secretKey}`);
      setCreateOpen(false);
      setNewKeyName("");
      void queryClient.invalidateQueries({ queryKey: ["api-credentials", workspaceId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => revokeApiCredential(workspaceId, id),
    onSuccess: () => {
      toast.success("API key deleted");
      setDeletingId(null);
      void queryClient.invalidateQueries({ queryKey: ["api-credentials", workspaceId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const creds = credsQuery.data?.credentials ?? [];

  /**
   * Whether this workspace can actually create a key — the package's `api:create_keys`, as the
   * server resolved it for this user and workspace. Gated on the server's answer rather than a plan
   * name, so the button never leads to an error toast. `planMeetsMinimum` is the pre-D3 alias of the
   * same value, read only when talking to an older server.
   *
   * `undefined` while loading is treated as allowed, so the button does not flicker disabled.
   */
  const apiAvailable = credsQuery.data
    ? (credsQuery.data.capabilities?.createKeys ?? credsQuery.data.planMeetsMinimum)
    : true;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-6 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-base font-semibold">API credentials</h2>
            <p className="text-sm text-muted-foreground">
              Use API keys to integrate with external tools via our REST API.
            </p>
          </div>
          {apiAvailable ? (
            <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              New key
            </Button>
          ) : (
            // Shown locked; the tooltip names the plan that includes API access.
            <FeatureGate module="api" action="create_keys">
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                New key
              </Button>
            </FeatureGate>
          )}
        </div>

        {credsQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : creds.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <KeyRound className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">No API keys yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {creds.map((cred: ApiCredentialItem) => (
              <div
                key={cred.id}
                className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3"
              >
                <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{cred.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{cred.maskedKey}</p>
                </div>
                <span className="hidden text-xs text-muted-foreground sm:block">
                  {new Date(cred.createdAt).toLocaleDateString()}
                </span>
                <button
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setDeletingId(cred.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New API key</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Key name</Label>
            <Input
              placeholder="My integration"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value.slice(0, LIMITS.apiKeyName.max))}
              maxLength={LIMITS.apiKeyName.max}
            />
            <p className="text-xs text-muted-foreground text-right">
              {newKeyName.length}/{LIMITS.apiKeyName.max}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                createMutation.isPending ||
                Boolean(lengthError(newKeyName, "Key name", LIMITS.apiKeyName))
              }
              onClick={() => createMutation.mutate(newKeyName.trim())}
            >
              {createMutation.isPending ? "Creating…" : "Create key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deletingId)} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API key?</AlertDialogTitle>
            <AlertDialogDescription>
              Any integrations using this key will stop working immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Notifications ─────────────────────────────────────────────────────────────

type SecurityPage = "home" | "2fa" | "mfa" | "consent" | "delete";

/** Authenticator app (TOTP) + MFA channel management — surfaced inside Settings → Security. */
export function TwoFactorSettings() {
  const [page, setPage] = useState<SecurityPage>("home");

  if (page === "2fa") return <AuthenticatorPanel variant="2fa" onBack={() => setPage("home")} />;
  if (page === "mfa") return <AuthenticatorPanel variant="mfa" onBack={() => setPage("home")} />;
  if (page === "consent") return <SecurityConsent onBack={() => setPage("home")} />;
  if (page === "delete") return <DeleteAuthenticator onBack={() => setPage("home")} />;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border bg-card p-5 shadow-soft">
        <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="font-display font-semibold">Account security</h2>
          <p className="text-sm text-muted-foreground mt-1">
            <strong className="text-foreground">2FA</strong> is a second factor (OTP from your
            authenticator app). <strong className="text-foreground">MFA</strong> is the broader
            concept — authenticator app, email OTP, SMS OTP. Liffio currently supports authenticator
            app OTP.
          </p>
        </div>
      </div>

      {[
        {
          page: "2fa" as SecurityPage,
          title: "Two-factor authentication (2FA)",
          body: "Set up or manage your authenticator app OTP.",
        },
        {
          page: "mfa" as SecurityPage,
          title: "Multi-factor authentication (MFA)",
          body: "Configure MFA channels (email OTP, SMS OTP — app only currently).",
        },
        {
          page: "consent" as SecurityPage,
          title: "Security disclosure & consent",
          body: "Review your onboarding security acknowledgment.",
        },
        {
          page: "delete" as SecurityPage,
          title: "Remove authenticator",
          body: "Unlink your authenticator and turn off 2FA/MFA.",
        },
      ].map((item) => (
        <button
          key={item.page}
          onClick={() => setPage(item.page)}
          className="w-full flex items-center justify-between gap-4 rounded-xl border bg-card p-4 shadow-soft hover:border-primary/40 hover:bg-card/80 transition-colors text-left"
        >
          <div>
            <p className="font-medium text-sm">{item.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{item.body}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      ))}
    </div>
  );
}

function AuthenticatorPanel({ variant, onBack }: { variant: "2fa" | "mfa"; onBack: () => void }) {
  const { refreshAuth } = useApp();
  const mfaEnabled = useAuthState((s) => s.mfaEnabled);
  const mfaEmailOtpEnabled = useAuthState((s) => s.mfaEmailOtpEnabled);
  const mfaSmsOtpEnabled = useAuthState((s) => s.mfaSmsOtpEnabled);

  const [setup, setSetup] = useState<{ qrDataUrl: string; secretKey: string } | null>(null);
  const [otpSetup, setOtpSetup] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [disableOtp, setDisableOtp] = useState("");

  const title =
    variant === "2fa" ? "Two-factor authentication (2FA)" : "Multi-factor authentication (MFA)";
  const lead =
    variant === "2fa"
      ? "2FA adds a second factor after your password — a rotating 6-digit OTP from your authenticator app."
      : "MFA combines something you know (password) with other factors. Liffio currently supports authenticator-based OTP; email and SMS OTP can be toggled below.";

  const startMutation = useMutation({
    mutationFn: mfaSetupStart,
    onSuccess: (data) => {
      setSetup({
        qrDataUrl: (data as { qrDataUrl?: string }).qrDataUrl ?? "",
        secretKey:
          (data as { secretKey?: string; secret?: string }).secretKey ??
          (data as { secret?: string }).secret ??
          "",
      });
      setOtpSetup("");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const verifyMutation = useMutation({
    mutationFn: (code: string) => mfaSetupVerify(code),
    onSuccess: async () => {
      toast.success("Authenticator enabled");
      setSetup(null);
      await refreshAuth();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const cancelMutation = useMutation({
    mutationFn: mfaSetupCancel,
    onSuccess: () => {
      setSetup(null);
      toast.info("Setup cancelled");
    },
  });

  const disableMutation = useMutation({
    mutationFn: () =>
      apiRequest<void>(apiUri.auth.mfa.disable, {
        method: "POST",
        body: { password: disablePassword, code: disableOtp },
      }),
    onSuccess: async () => {
      toast.success("Authenticator removed — 2FA/MFA is off");
      setDisablePassword("");
      setDisableOtp("");
      await refreshAuth();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const channelMutation = useMutation({
    mutationFn: (body: { emailOtpEnabled?: boolean; smsOtpEnabled?: boolean }) =>
      mfaSetChannels(body),
    onSuccess: async () => {
      await refreshAuth();
      toast.success("MFA channels updated");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
      >
        <ChevronRight className="h-4 w-4 rotate-180" /> Security overview
      </button>

      <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
        <h2 className="font-display text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{lead}</p>

        {variant === "mfa" && (
          <div className="rounded-lg border p-3 space-y-3">
            <p className="text-xs text-muted-foreground">
              MFA OTP channels (SMS not yet supported)
            </p>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Email OTP</p>
                <p className="text-xs text-muted-foreground">
                  Receive a 6-digit code by email at login.
                </p>
              </div>
              <Switch
                checked={mfaEmailOtpEnabled}
                onCheckedChange={(v) => channelMutation.mutate({ emailOtpEnabled: v })}
                disabled={channelMutation.isPending}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">SMS OTP</p>
                <p className="text-xs text-muted-foreground">Coming soon.</p>
              </div>
              <Switch checked={mfaSmsOtpEnabled} disabled />
            </div>
          </div>
        )}

        {mfaEnabled ? (
          <div className="space-y-3 max-w-md">
            <p className="text-sm text-success">An authenticator is linked to your account.</p>
            <div className="space-y-1.5">
              <Label>Account password</Label>
              <Input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                maxLength={LIMITS.password.max}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label>6-digit authenticator code</Label>
              <InputOTP
                name="totp"
                maxLength={6}
                value={disableOtp}
                onChange={(v) => setDisableOtp(v.replace(/\D/g, ""))}
              >
                <InputOTPGroup>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button
              variant="outline"
              className="text-destructive border-destructive/40"
              disabled={
                disableMutation.isPending || disablePassword.length < 8 || disableOtp.length < 6
              }
              onClick={() => disableMutation.mutate()}
            >
              {disableMutation.isPending ? "Removing…" : "Turn off & remove authenticator"}
            </Button>
          </div>
        ) : !setup ? (
          <Button onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>
            {startMutation.isPending ? "Starting…" : "Set up authenticator app"}
          </Button>
        ) : (
          <div className="space-y-4 max-w-md">
            <p className="text-sm text-muted-foreground">
              Scan the QR code with your authenticator app, then enter the 6-digit code to confirm.
            </p>
            {setup.qrDataUrl && (
              <img
                src={setup.qrDataUrl}
                alt="Authenticator QR"
                className="rounded-lg border w-44 h-44 p-2 object-contain"
              />
            )}
            <div className="space-y-1.5">
              <Label>Setup key</Label>
              <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2">
                <span className="flex-1 text-sm font-mono break-all select-all">
                  {setup.secretKey}
                </span>
                <button
                  onClick={() => {
                    void navigator.clipboard.writeText(setup.secretKey);
                    toast.success("Copied!");
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>6-digit code</Label>
              <InputOTP
                name="totp"
                maxLength={6}
                value={otpSetup}
                onChange={(v) => setOtpSetup(v.replace(/\D/g, ""))}
              >
                <InputOTPGroup>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={verifyMutation.isPending || otpSetup.length !== 6}
                onClick={() => verifyMutation.mutate(otpSetup)}
              >
                {verifyMutation.isPending ? "Confirming…" : "Confirm and enable"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SecurityConsent({ onBack }: { onBack: () => void }) {
  const { refreshAuth } = useApp();
  const consentAt = useAuthState((s) => s.mfaOnboardingConsentAt);
  const [revokePassword, setRevokePassword] = useState("");
  const [revokeConfirm, setRevokeConfirm] = useState(false);

  const formatted = consentAt
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(consentAt),
      )
    : null;

  const revokeMutation = useMutation({
    mutationFn: () =>
      apiRequest<void>(apiUri.auth.mfa.onboardingConsentRevoke, {
        method: "POST",
        body: { password: revokePassword },
      }),
    onSuccess: async () => {
      toast.success("Consent record cleared");
      setRevokePassword("");
      setRevokeConfirm(false);
      await refreshAuth();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
      >
        <ChevronRight className="h-4 w-4 rotate-180" /> Security overview
      </button>

      <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
        <h2 className="font-display text-base font-semibold">Security disclosure & consent</h2>
        <div className="text-sm text-muted-foreground space-y-2 leading-relaxed">
          <p>
            You acknowledged that extra login protection (2FA uses OTP; MFA can include OTP via app,
            SMS, email, and similar) is optional but recommended, that you are responsible for
            backup access to your factors, and that Liffio may email you from{" "}
            <span className="font-mono text-xs">noreply@liffio.com</span> when you change security
            settings.
          </p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          {formatted ? (
            <span>Acknowledged {formatted}</span>
          ) : (
            <span className="text-muted-foreground">No acknowledgment timestamp stored yet.</span>
          )}
        </div>

        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-destructive">Delete consent record</h3>
          <p className="text-xs text-muted-foreground">
            Clears only the stored acknowledgment timestamp. Does not turn off an active
            authenticator.
          </p>
          <div className="space-y-1.5 max-w-sm">
            <Label>Account password</Label>
            <Input
              type="password"
              value={revokePassword}
              onChange={(e) => setRevokePassword(e.target.value)}
              maxLength={LIMITS.password.max}
              autoComplete="current-password"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={revokeConfirm}
              onChange={(e) => setRevokeConfirm(e.target.checked)}
            />{" "}
            I want to delete this consent record.
          </label>
          <Button
            variant="outline"
            className="text-destructive border-destructive/40"
            disabled={revokeMutation.isPending || revokePassword.length < 8 || !revokeConfirm}
            onClick={() => revokeMutation.mutate()}
          >
            {revokeMutation.isPending ? "Deleting…" : "Delete consent record"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DeleteAuthenticator({ onBack }: { onBack: () => void }) {
  const { refreshAuth } = useApp();
  const mfaEnabled = useAuthState((s) => s.mfaEnabled);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableOtp, setDisableOtp] = useState("");

  const disableMutation = useMutation({
    mutationFn: () =>
      apiRequest<void>(apiUri.auth.mfa.disable, {
        method: "POST",
        body: { password: disablePassword, code: disableOtp },
      }),
    onSuccess: async () => {
      toast.success("Authenticator removed — 2FA/MFA is off");
      setDisablePassword("");
      setDisableOtp("");
      await refreshAuth();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
      >
        <ChevronRight className="h-4 w-4 rotate-180" /> Security overview
      </button>

      <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
        <h2 className="font-display text-base font-semibold">Remove authenticator</h2>
        <p className="text-sm text-muted-foreground">
          Permanently unlinks your authenticator app. You will only need your password to sign in
          until you set up a new authenticator.
        </p>

        {!mfaEnabled ? (
          <p className="text-sm text-muted-foreground">
            No authenticator is active. Go to 2FA or MFA settings to set one up.
          </p>
        ) : (
          <div className="space-y-3 max-w-md">
            <div className="space-y-1.5">
              <Label>Account password</Label>
              <Input
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                maxLength={LIMITS.password.max}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label>6-digit code from authenticator</Label>
              <InputOTP
                name="totp"
                maxLength={6}
                value={disableOtp}
                onChange={(v) => setDisableOtp(v.replace(/\D/g, ""))}
              >
                <InputOTPGroup>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button
              variant="destructive"
              disabled={
                disableMutation.isPending || disablePassword.length < 8 || disableOtp.length !== 6
              }
              onClick={() => disableMutation.mutate()}
            >
              {disableMutation.isPending ? "Removing…" : "Delete authenticator & turn off 2FA"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
