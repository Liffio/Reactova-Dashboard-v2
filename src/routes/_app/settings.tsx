import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  Copy,
  Instagram,
  KeyRound,
  Plus,
  Shield,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/page-header";
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
import { listApiCredentials, createApiCredential, revokeApiCredential, type ApiCredentialItem } from "@/lib/api/api-credentials-api";
import {
  mfaSetupStart, mfaSetupVerify, mfaSetupCancel, mfaSetChannels,
} from "@/lib/api/auth-api";
import { apiRequest } from "@/lib/api/http";
import { apiUri } from "@/lib/api/apiUri";
import { listNotifications, updateNotificationPreference } from "@/lib/api/notifications-api";
import {
  listTeamMembers, listTeamInvites, getTeamOptions, createTeamInvite, revokeTeamInvite, removeTeamMember, updateTeamMember,
} from "@/lib/api/team-api";
import { LIMITS, emailError, lengthError, duplicateAliasError } from "@/lib/validation";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — Liffio" }] }),
  component: SettingsRoute,
});

function SettingsRoute() {
  return (
    <ProtectedRoute module="workspace">
      <SettingsPage />
    </ProtectedRoute>
  );
}

function SettingsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Manage your workspace, Instagram connection and security settings."
      />
      <div className="p-4 sm:p-6 md:p-10 max-w-3xl">
        <Tabs defaultValue="general">
          <TabsList className="mb-6 flex-wrap h-auto gap-1">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="instagram">Instagram</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="api">API keys</TabsTrigger>
            <TabsTrigger value="docs">API docs</TabsTrigger>
          </TabsList>
          <TabsContent value="general">
            <GeneralSettings />
          </TabsContent>
          <TabsContent value="instagram">
            <InstagramSettings />
          </TabsContent>
          <TabsContent value="notifications">
            <NotificationsSettings />
          </TabsContent>
          <TabsContent value="team">
            <TeamSettings />
          </TabsContent>
          <TabsContent value="security">
            <SecuritySettings />
          </TabsContent>
          <TabsContent value="api">
            <ApiCredentialsSettings />
          </TabsContent>
          <TabsContent value="docs">
            <div className="rounded-2xl border bg-card p-6 shadow-soft">
              <ApiDocsContent />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function GeneralSettings() {
  const { current, workspaces, setCurrentId, refreshAuth } = useApp();
  const workspaceId = current.id;
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(current.name);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

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
              maxLength={LIMITS.workspaceName.max}
              aria-invalid={Boolean(nameError)}
            />
            <div className="flex items-center justify-between text-xs">
              <span className="text-destructive">{nameError && displayName !== current.name ? nameError : ""}</span>
              <span className="text-muted-foreground">{displayName.length}/{LIMITS.workspaceName.max}</span>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground">Workspace ID</Label>
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
        <p className="text-sm text-muted-foreground">Permanently delete this workspace and all its automations, leads, and short links.</p>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.checked)} />
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
          <p className="text-xs text-muted-foreground">At least one workspace must remain on your account.</p>
        )}
      </div>
    </div>
  );
}

function InstagramSettings() {
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
        }
      );
      if (result.meta === "connected") {
        toast.success(
          result.igHandle ? `Connected as @${result.igHandle}` : "Instagram connected"
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
              <span className="text-sm text-muted-foreground">· @{current.igHandle}</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Your Instagram account is connected and automations are active.
          </p>
          <div className="flex gap-3">
            <Button size="sm" variant="outline" disabled={isConnecting} onClick={() => void handleConnect()}>
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

function ApiCredentialsSettings() {
  const workspaceId = useApp().current.id;
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const credsQuery = useQuery({
    queryKey: ["api-credentials", workspaceId],
    queryFn: () => listApiCredentials(workspaceId),
    enabled: Boolean(workspaceId) && workspaceId !== "default",
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => createApiCredential(workspaceId, { name, neverExpires: true }),
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
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New key
          </Button>
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
            <p className="text-xs text-muted-foreground text-right">{newKeyName.length}/{LIMITS.apiKeyName.max}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              disabled={createMutation.isPending || Boolean(lengthError(newKeyName, "Key name", LIMITS.apiKeyName))}
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

function NotificationsSettings() {
  const { current } = useApp();
  const workspaceId = current.id;

  const notifQuery = useQuery({
    queryKey: ["notifications", workspaceId],
    queryFn: () => listNotifications(workspaceId),
    enabled: Boolean(workspaceId) && workspaceId !== "default",
  });

  const updateMutation = useMutation({
    mutationFn: (body: { type: string; isEnabled: boolean }) =>
      updateNotificationPreference(workspaceId, body as Parameters<typeof updateNotificationPreference>[1]),
    onError: (e) => toast.error((e as Error).message),
  });

  const prefs = notifQuery.data?.preferences ?? [];

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
      <h2 className="font-display text-base font-semibold">Notification preferences</h2>
      {notifQuery.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
      ) : prefs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notification preferences found for this workspace.</p>
      ) : (
        <div className="space-y-1 divide-y divide-border">
          {prefs.map((item) => (
            <div key={item.type} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
              </div>
              <Switch
                checked={item.isEnabled}
                onCheckedChange={(checked) => updateMutation.mutate({ type: item.type, isEnabled: checked })}
                disabled={updateMutation.isPending}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Team ──────────────────────────────────────────────────────────────────────

const PLAN_TEAM_LIMITS: Record<string, number> = {
  FREE: 2, STARTER: 5, PRO: 10, BUSINESS: 20, AGENCY: 50,
};

function TeamSettings() {
  const { current } = useApp();
  const workspaceId = current.id;

  const membersQuery = useQuery({ queryKey: ["team-members", workspaceId], queryFn: () => listTeamMembers(workspaceId), enabled: Boolean(workspaceId) && workspaceId !== "default" });
  const invitesQuery = useQuery({ queryKey: ["team-invites", workspaceId], queryFn: () => listTeamInvites(workspaceId), enabled: Boolean(workspaceId) && workspaceId !== "default" });
  const optionsQuery = useQuery({ queryKey: ["team-options", workspaceId], queryFn: () => getTeamOptions(workspaceId), enabled: Boolean(workspaceId) && workspaceId !== "default" });

  const [email, setEmail] = useState("");
  const [roleKey, setRoleKey] = useState("MEMBER");

  const memberLimit = PLAN_TEAM_LIMITS[current.plan] ?? 2;
  const memberCount = membersQuery.data?.length ?? 0;
  const atLimit = memberCount >= memberLimit;

  const existingEmails = [
    ...(membersQuery.data ?? []).map((m) => m.user.email),
    ...(invitesQuery.data ?? []).filter((i) => i.status === "PENDING").map((i) => i.email),
  ];
  const inviteEmailError = email ? (emailError(email) || duplicateAliasError(email, existingEmails)) : null;

  const invalidate = () => {
    void Promise.all([
      membersQuery.refetch(),
      invitesQuery.refetch(),
    ]);
  };

  const createInviteMutation = useMutation({
    mutationFn: () => createTeamInvite(workspaceId, { email: email.trim(), roleKey, moduleAccess: [], permissionKeys: [], policyKeys: [] }),
    onSuccess: (data) => {
      if (data.emailSent) toast.success(`Invitation sent to ${email}`);
      else if (data.inAppNotified) toast.success(`Invite created for ${email} — they were notified in-app`);
      else toast.warning(`Invite created for ${email} but email could not be sent`);
      setEmail("");
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const revokeInviteMutation = useMutation({
    mutationFn: (id: string) => revokeTeamInvite(workspaceId, id),
    onSuccess: () => { toast.success("Invite revoked"); invalidate(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => removeTeamMember(workspaceId, userId),
    onSuccess: () => { toast.success("Member removed"); invalidate(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, roleKey: rk }: { userId: string; roleKey: string }) =>
      updateTeamMember(workspaceId, userId, { roleKey: rk, permissionKeys: [], policyKeys: [] }),
    onSuccess: () => { toast.success("Role updated"); invalidate(); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-5">
      {/* Invite */}
      <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-semibold">Invite team member</h2>
            <p className="text-xs text-muted-foreground">{memberCount} / {memberLimit} seats used</p>
          </div>
          <Users className="h-5 w-5 text-muted-foreground" />
        </div>
        {atLimit && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-muted-foreground">
            You've reached the {memberLimit}-member limit on the {current.plan.toLowerCase()} plan.
          </div>
        )}
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="member@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value.slice(0, LIMITS.email.max))}
            maxLength={LIMITS.email.max}
            disabled={atLimit}
            className="flex-1"
          />
          <select value={roleKey} onChange={(e) => setRoleKey(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm" disabled={atLimit}>
            {(optionsQuery.data?.roles ?? []).map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
          </select>
          <Button size="sm" disabled={Boolean(inviteEmailError) || createInviteMutation.isPending || atLimit} onClick={() => createInviteMutation.mutate()}>
            <Plus className="h-4 w-4" /> Invite
          </Button>
        </div>
        {inviteEmailError && (
          <p className="text-xs text-destructive">{inviteEmailError}</p>
        )}
      </div>

      {/* Members */}
      <div className="rounded-2xl border bg-card shadow-soft overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="font-display text-base font-semibold">Members</h2>
        </div>
        {membersQuery.isLoading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : (
          <div className="divide-y divide-border">
            {(membersQuery.data ?? []).map((m) => {
              const isOwner = m.role.key === "OWNER";
              return (
                <div key={m.user.email} className="flex items-center gap-3 px-6 py-3">
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                    {m.user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{m.user.name} {isOwner && <span className="text-xs text-primary">(owner)</span>}</p>
                    <p className="text-xs text-muted-foreground">{m.user.email}</p>
                  </div>
                  {isOwner ? (
                    <span className="text-xs text-muted-foreground">Owner</span>
                  ) : (
                    <select
                      value={m.role.key}
                      onChange={(e) => updateRoleMutation.mutate({ userId: m.user.id, roleKey: e.target.value })}
                      className="h-8 rounded-md border bg-background px-2 text-xs"
                      disabled={m.immutableSuperAdmin || updateRoleMutation.isPending}
                    >
                      {(optionsQuery.data?.roles ?? []).map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
                    </select>
                  )}
                  {!isOwner && !m.immutableSuperAdmin && (
                    <button className="text-muted-foreground hover:text-destructive" onClick={() => removeMemberMutation.mutate(m.user.id)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Invites */}
      <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-3">
        <h2 className="font-display text-base font-semibold">Pending invites</h2>
        {invitesQuery.isLoading ? (
          <Skeleton className="h-12 rounded-lg" />
        ) : (invitesQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No invites sent yet.</p>
        ) : (
          <div className="space-y-2">
            {(invitesQuery.data ?? []).map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">{inv.baseRole?.name ?? "Member"} · <span className={inv.status === "PENDING" ? "text-amber-500" : inv.status === "ACCEPTED" ? "text-green-500" : ""}>{inv.status.toLowerCase()}</span></p>
                </div>
                {inv.status === "PENDING" && (
                  <button className="text-muted-foreground hover:text-destructive" onClick={() => revokeInviteMutation.mutate(inv.id)} disabled={revokeInviteMutation.isPending}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Security ──────────────────────────────────────────────────────────────────

type SecurityPage = "home" | "2fa" | "mfa" | "consent" | "delete";

function SecuritySettings() {
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
            <strong className="text-foreground">2FA</strong> is a second factor (OTP from your authenticator app).{" "}
            <strong className="text-foreground">MFA</strong> is the broader concept — authenticator app, email OTP, SMS OTP. Liffio currently supports authenticator app OTP.
          </p>
        </div>
      </div>

      {[
        { page: "2fa" as SecurityPage, title: "Two-factor authentication (2FA)", body: "Set up or manage your authenticator app OTP." },
        { page: "mfa" as SecurityPage, title: "Multi-factor authentication (MFA)", body: "Configure MFA channels (email OTP, SMS OTP — app only currently)." },
        { page: "consent" as SecurityPage, title: "Security disclosure & consent", body: "Review your onboarding security acknowledgment." },
        { page: "delete" as SecurityPage, title: "Remove authenticator", body: "Unlink your authenticator and turn off 2FA/MFA." },
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

  const title = variant === "2fa" ? "Two-factor authentication (2FA)" : "Multi-factor authentication (MFA)";
  const lead = variant === "2fa"
    ? "2FA adds a second factor after your password — a rotating 6-digit OTP from your authenticator app."
    : "MFA combines something you know (password) with other factors. Liffio currently supports authenticator-based OTP; email and SMS OTP can be toggled below.";

  const startMutation = useMutation({
    mutationFn: mfaSetupStart,
    onSuccess: (data) => {
      setSetup({ qrDataUrl: (data as { qrDataUrl?: string }).qrDataUrl ?? "", secretKey: (data as { secretKey?: string; secret?: string }).secretKey ?? (data as { secret?: string }).secret ?? "" });
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
    onSuccess: () => { setSetup(null); toast.info("Setup cancelled"); },
  });

  const disableMutation = useMutation({
    mutationFn: () => apiRequest<void>(apiUri.auth.mfa.disable, { method: "POST", body: { password: disablePassword, code: disableOtp } }),
    onSuccess: async () => {
      toast.success("Authenticator removed — 2FA/MFA is off");
      setDisablePassword("");
      setDisableOtp("");
      await refreshAuth();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const channelMutation = useMutation({
    mutationFn: (body: { emailOtpEnabled?: boolean; smsOtpEnabled?: boolean }) => mfaSetChannels(body),
    onSuccess: async () => { await refreshAuth(); toast.success("MFA channels updated"); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ChevronRight className="h-4 w-4 rotate-180" /> Security overview
      </button>

      <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
        <h2 className="font-display text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{lead}</p>

        {variant === "mfa" && (
          <div className="rounded-lg border p-3 space-y-3">
            <p className="text-xs text-muted-foreground">MFA OTP channels (SMS not yet supported)</p>
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-sm font-medium">Email OTP</p><p className="text-xs text-muted-foreground">Receive a 6-digit code by email at login.</p></div>
              <Switch checked={mfaEmailOtpEnabled} onCheckedChange={(v) => channelMutation.mutate({ emailOtpEnabled: v })} disabled={channelMutation.isPending} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-sm font-medium">SMS OTP</p><p className="text-xs text-muted-foreground">Coming soon.</p></div>
              <Switch checked={mfaSmsOtpEnabled} disabled />
            </div>
          </div>
        )}

        {mfaEnabled ? (
          <div className="space-y-3 max-w-md">
            <p className="text-sm text-success">An authenticator is linked to your account.</p>
            <div className="space-y-1.5">
              <Label>Account password</Label>
              <Input type="password" value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} maxLength={LIMITS.password.max} autoComplete="current-password" />
            </div>
            <div className="space-y-1.5">
              <Label>6-digit authenticator code</Label>
              <InputOTP maxLength={6} value={disableOtp} onChange={(v) => setDisableOtp(v.replace(/\D/g, ""))}>
                <InputOTPGroup>{Array.from({ length: 6 }).map((_, i) => <InputOTPSlot key={i} index={i} />)}</InputOTPGroup>
              </InputOTP>
            </div>
            <Button variant="outline" className="text-destructive border-destructive/40" disabled={disableMutation.isPending || disablePassword.length < 8 || disableOtp.length < 6} onClick={() => disableMutation.mutate()}>
              {disableMutation.isPending ? "Removing…" : "Turn off & remove authenticator"}
            </Button>
          </div>
        ) : !setup ? (
          <Button onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>
            {startMutation.isPending ? "Starting…" : "Set up authenticator app"}
          </Button>
        ) : (
          <div className="space-y-4 max-w-md">
            <p className="text-sm text-muted-foreground">Scan the QR code with your authenticator app, then enter the 6-digit code to confirm.</p>
            {setup.qrDataUrl && (
              <img src={setup.qrDataUrl} alt="Authenticator QR" className="rounded-lg border w-44 h-44 p-2 object-contain" />
            )}
            <div className="space-y-1.5">
              <Label>Setup key</Label>
              <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2">
                <span className="flex-1 text-sm font-mono break-all select-all">{setup.secretKey}</span>
                <button onClick={() => { void navigator.clipboard.writeText(setup.secretKey); toast.success("Copied!"); }} className="text-muted-foreground hover:text-foreground"><Copy className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>6-digit code</Label>
              <InputOTP maxLength={6} value={otpSetup} onChange={(v) => setOtpSetup(v.replace(/\D/g, ""))}>
                <InputOTPGroup>{Array.from({ length: 6 }).map((_, i) => <InputOTPSlot key={i} index={i} />)}</InputOTPGroup>
              </InputOTP>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={verifyMutation.isPending || otpSetup.length !== 6} onClick={() => verifyMutation.mutate(otpSetup)}>
                {verifyMutation.isPending ? "Confirming…" : "Confirm and enable"}
              </Button>
              <Button variant="ghost" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>Cancel</Button>
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
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(consentAt))
    : null;

  const revokeMutation = useMutation({
    mutationFn: () => apiRequest<void>(apiUri.auth.mfa.onboardingConsentRevoke, { method: "POST", body: { password: revokePassword } }),
    onSuccess: async () => { toast.success("Consent record cleared"); setRevokePassword(""); setRevokeConfirm(false); await refreshAuth(); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ChevronRight className="h-4 w-4 rotate-180" /> Security overview
      </button>

      <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
        <h2 className="font-display text-base font-semibold">Security disclosure & consent</h2>
        <div className="text-sm text-muted-foreground space-y-2 leading-relaxed">
          <p>You acknowledged that extra login protection (2FA uses OTP; MFA can include OTP via app, SMS, email, and similar) is optional but recommended, that you are responsible for backup access to your factors, and that Liffio may email you from <span className="font-mono text-xs">noreply@liffio.com</span> when you change security settings.</p>
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
          <p className="text-xs text-muted-foreground">Clears only the stored acknowledgment timestamp. Does not turn off an active authenticator.</p>
          <div className="space-y-1.5 max-w-sm">
            <Label>Account password</Label>
            <Input type="password" value={revokePassword} onChange={(e) => setRevokePassword(e.target.value)} maxLength={LIMITS.password.max} autoComplete="current-password" />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={revokeConfirm} onChange={(e) => setRevokeConfirm(e.target.checked)} /> I want to delete this consent record.
          </label>
          <Button variant="outline" className="text-destructive border-destructive/40" disabled={revokeMutation.isPending || revokePassword.length < 8 || !revokeConfirm} onClick={() => revokeMutation.mutate()}>
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
    mutationFn: () => apiRequest<void>(apiUri.auth.mfa.disable, { method: "POST", body: { password: disablePassword, code: disableOtp } }),
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
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ChevronRight className="h-4 w-4 rotate-180" /> Security overview
      </button>

      <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
        <h2 className="font-display text-base font-semibold">Remove authenticator</h2>
        <p className="text-sm text-muted-foreground">Permanently unlinks your authenticator app. You will only need your password to sign in until you set up a new authenticator.</p>

        {!mfaEnabled ? (
          <p className="text-sm text-muted-foreground">No authenticator is active. Go to 2FA or MFA settings to set one up.</p>
        ) : (
          <div className="space-y-3 max-w-md">
            <div className="space-y-1.5">
              <Label>Account password</Label>
              <Input type="password" value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} maxLength={LIMITS.password.max} autoComplete="current-password" />
            </div>
            <div className="space-y-1.5">
              <Label>6-digit code from authenticator</Label>
              <InputOTP maxLength={6} value={disableOtp} onChange={(v) => setDisableOtp(v.replace(/\D/g, ""))}>
                <InputOTPGroup>{Array.from({ length: 6 }).map((_, i) => <InputOTPSlot key={i} index={i} />)}</InputOTPGroup>
              </InputOTP>
            </div>
            <Button variant="destructive" disabled={disableMutation.isPending || disablePassword.length < 8 || disableOtp.length !== 6} onClick={() => disableMutation.mutate()}>
              {disableMutation.isPending ? "Removing…" : "Delete authenticator & turn off 2FA"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
