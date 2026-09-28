/**
 * Workspace settings panels carried over from the old single-page `/settings` (plan/settings-revamp.md).
 * Each is rendered by its own tab route now; the hardcoded plan→seat map that lived here is gone
 * (Team reads its limit from the server). The General / Instagram / Developer panels reproduce
 * `docs/profile/03-liffio-settings.html` with the shared primitives in `../components`.
 */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  ChevronRight,
  Copy,
  ExternalLink,
  Instagram,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
} from "lucide-react";
import { toast } from "@/lib/toast";

import { SendRateCard } from "@/components/settings/send-rate-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { UserAvatar } from "@/components/user-avatar";
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
import { LIMITS, lengthError } from "@/lib/validation";
import { useTouched } from "@/hooks/use-touched";
import { formatHandle } from "@/lib/format";
import { isWorkspaceReady } from "@/lib/api/active-workspace";
import { FeatureGate } from "@/components/access/feature-gate";
import { cn } from "@/lib/utils";
import {
  CardNote,
  IconButton,
  IconTile,
  OkChip,
  PlainCard,
  SettingRow,
  SettingsButton,
  SettingsCard,
  SettingsTable,
  StatTile,
  StatusChip,
  Td,
  TextField,
  Th,
  UsageTile,
  shortDate,
  textLinkClass,
  timeAgo,
} from "../components";

function copyToClipboard(value: string) {
  void navigator.clipboard.writeText(value);
  toast.success("Copied!");
}

export function GeneralSettings() {
  const { current, workspaces, setCurrentId, refreshAuth } = useApp();
  const workspaceId = current.id;
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(current.name);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const touched = useTouched();

  useEffect(() => {
    setDisplayName(current.name);
  }, [current.name]);

  const nameError = lengthError(displayName, "Workspace name", LIMITS.workspaceName);
  const nameDirty = displayName !== current.name;

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
      setDeleteOpen(false);
      setCurrentId(next?.id ?? "");
      await refreshAuth();
      toast.success("Workspace deleted");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const lastWorkspace = workspaces.length <= 1;

  return (
    <div className="flex flex-col gap-[22px]">
      <SettingsCard
        title="Workspace details"
        description={`Everyone in ${current.name} sees these.`}
      >
        <SettingRow
          label="Workspace name"
          hint="Keep it short, it shows in the sidebar."
          htmlFor="ws-name"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <TextField
              id="ws-name"
              wrapperClassName="flex-1"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, LIMITS.workspaceName.max))}
              onBlur={touched.onBlur("name")}
              maxLength={LIMITS.workspaceName.max}
              aria-invalid={touched.visible("name") && Boolean(nameError)}
              trailing={
                <span className="text-xs tabular-nums text-muted-foreground">
                  {displayName.length}/{LIMITS.workspaceName.max}
                </span>
              }
            />
            {nameDirty && (
              <SettingsButton
                variant="primary"
                className="h-11"
                disabled={saveMutation.isPending || Boolean(nameError)}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? "Saving…" : "Save"}
              </SettingsButton>
            )}
          </div>
          {touched.visible("name") && nameError && (
            <span className="text-[13px] text-destructive">{nameError}</span>
          )}
        </SettingRow>

        {current.humanId && (
          <SettingRow
            label="Workspace ID"
            hint="Share this with support so they find you fast. It stays the same if you rename the workspace."
            htmlFor="ws-id"
          >
            <TextField
              id="ws-id"
              readOnly
              value={current.humanId}
              trailing={
                <IconButton
                  label="Copy workspace ID"
                  onClick={() => copyToClipboard(current.humanId ?? "")}
                >
                  <Copy />
                </IconButton>
              }
            />
          </SettingRow>
        )}

        {/* The uuid stays visible — existing integrations and support tickets reference it. */}
        <SettingRow
          label="Internal ID"
          hint="The UUID older integrations and API calls use."
          htmlFor="ws-uuid"
        >
          <TextField
            id="ws-uuid"
            readOnly
            value={workspaceId}
            className="font-mono text-[13px]"
            trailing={
              <IconButton label="Copy internal ID" onClick={() => copyToClipboard(workspaceId)}>
                <Copy />
              </IconButton>
            }
          />
        </SettingRow>

        <SettingRow label="Plan" hint="What this workspace is on today.">
          <div className="flex flex-wrap items-center gap-3">
            <StatusChip tone="brand">{current.plan}</StatusChip>
            <Link to="/settings/billing" className={textLinkClass}>
              Manage in Billing
            </Link>
          </div>
        </SettingRow>
      </SettingsCard>

      <PlainCard className="flex flex-col gap-4 border-[#F3B8C1] px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-5 dark:border-destructive-edge">
        <div className="flex flex-col gap-1">
          <div className="text-[15px] font-semibold text-[#8F0A2B] dark:text-destructive">
            Delete this workspace
          </div>
          <div className="text-[13px] text-muted-foreground">
            {lastWorkspace
              ? "At least one workspace must remain on your account."
              : "Permanently deletes its automations, leads and short links, and disconnects Instagram."}
          </div>
        </div>
        <SettingsButton
          variant="dangerOutline"
          disabled={lastWorkspace || deleteMutation.isPending}
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 />
          <span>Delete workspace</span>
        </SettingsButton>
      </PlainCard>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {current.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes this workspace and all its data — automations, leads and
              short links. It can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                deleteMutation.mutate();
              }}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete workspace"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Days until an ISO date, or null. */
function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86_400_000);
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

  const tokenDays = daysUntil(current.igTokenExpiresAt);
  const health =
    current.status === "failed" || current.status === "disconnected"
      ? { tone: "danger" as const, label: "Needs reconnect" }
      : tokenDays !== null && tokenDays <= 7
        ? { tone: "warning" as const, label: "Token expiring" }
        : current.status === "paused"
          ? { tone: "warning" as const, label: "Paused" }
          : null;

  // Only metrics the workspace endpoint actually returns — `null` means "not computed", never 0.
  const stats = [
    { label: "Followers", value: current.igFollowerCount },
    { label: "Live automations", value: current.activeAutomations },
    { label: "DMs sent this month", value: current.dmsThisMonth },
    { label: "Leads this month", value: current.leadsThisMonth },
  ].filter((s): s is { label: string; value: number } => s.value !== null);

  return (
    <div className="flex flex-col gap-[22px]">
      {current.instagramConnected ? (
        <section className="overflow-hidden rounded-[16px] border border-border bg-card">
          <div className="flex flex-col gap-4 border-b border-border px-6 py-[22px] sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <span className="inline-flex size-14 shrink-0 rounded-full bg-brand-gradient p-[3px]">
                <span className="flex size-[50px] items-center justify-center rounded-full bg-card">
                  <UserAvatar
                    userId={workspaceId}
                    name={current.igHandle ?? current.name}
                    size={44}
                  />
                </span>
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2 text-[17px] font-bold text-foreground">
                  {current.igHandle ? formatHandle(current.igHandle) : current.name}
                  {health ? (
                    <StatusChip tone={health.tone}>{health.label}</StatusChip>
                  ) : (
                    <OkChip>Healthy</OkChip>
                  )}
                </div>
                <div className="text-[13px] text-muted-foreground">
                  Professional account
                  {current.igTokenExpiresAt
                    ? ` · token valid until ${shortDate(current.igTokenExpiresAt)}`
                    : ""}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <SettingsButton disabled={isConnecting} onClick={() => void handleConnect()}>
                <RefreshCw />
                <span>{isConnecting ? "Connecting…" : "Reconnect"}</span>
              </SettingsButton>
              <SettingsButton variant="dangerOutline" onClick={() => setUnlinkOpen(true)}>
                Disconnect
              </SettingsButton>
            </div>
          </div>

          {stats.length > 0 && (
            <div
              className={cn(
                "grid grid-cols-2 gap-3 border-b border-border px-6 py-[18px]",
                stats.length >= 4 ? "lg:grid-cols-4" : stats.length === 3 && "lg:grid-cols-3",
              )}
            >
              {stats.map((s) => (
                <StatTile key={s.label} value={s.value.toLocaleString()} label={s.label} />
              ))}
            </div>
          )}

          {/* Send rate lives with the connection rather than under automations: it is a property
              of the Instagram account, and every automation on it shares the same budget. */}
          <div className="px-6 py-5">
            <SendRateCard />
          </div>
        </section>
      ) : (
        <SettingsCard
          title="Instagram"
          description="Connect your Instagram Professional account to start sending automated DMs."
        >
          <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[13px] text-muted-foreground">
              {[
                "Requires an Instagram Professional account",
                "Your account must be linked to a Facebook Page",
                "You must be the admin of the Facebook Page",
              ].map((r) => (
                <li key={r} className="flex items-start gap-2">
                  <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-warning" />
                  {r}
                </li>
              ))}
            </ul>
            <SettingsButton
              variant="primary"
              disabled={isConnecting}
              onClick={() => void handleConnect()}
            >
              {isConnecting ? (
                <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Instagram />
              )}
              <span>{isConnecting ? "Connecting…" : "Connect Instagram"}</span>
            </SettingsButton>
          </div>
        </SettingsCard>
      )}

      {current.instagramConnected && (
        // No in-page route adds a workspace (that flow lives in the workspace switcher), so this is
        // the reference's dashed hint without a link target.
        <div className="flex items-center gap-4 rounded-[16px] border-[1.5px] border-dashed border-[#D3CBC3] bg-transparent px-6 py-5 text-foreground dark:border-border">
          <IconTile tone="white">
            <Plus />
          </IconTile>
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold">Connect another Instagram account</span>
            <span className="text-[13px] text-muted-foreground">
              Each workspace runs one account. Add a workspace from the switcher to run more.
            </span>
          </div>
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

const KEY_STATUS: Record<ApiCredentialItem["status"], { label: string; tone: "muted" | "danger" }> =
  {
    active: { label: "Active", tone: "muted" },
    expired: { label: "Expired", tone: "muted" },
    revoked: { label: "Revoked", tone: "danger" },
  };

/**
 * Developer tab: the key-quota tile + API docs link, then the API keys table. `docsHref` is the
 * in-page anchor of the docs card the route renders below.
 */
export function ApiCredentialsSettings({ docsHref }: { docsHref?: string } = {}) {
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
  const limits = credsQuery.data?.limits;
  const activeCount = creds.filter((c) => c.status === "active").length;

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

  const createButton = (
    <SettingsButton
      variant="primary"
      onClick={apiAvailable ? () => setCreateOpen(true) : undefined}
    >
      <Plus />
      <span>Create key</span>
    </SettingsButton>
  );

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {limits ? (
          <UsageTile label="API keys" used={activeCount} limit={limits.maxApiCredentials || null} />
        ) : (
          <Skeleton className="h-[106px] rounded-[14px]" />
        )}
        <a
          href={docsHref ?? "#api-docs"}
          className="flex items-center gap-3.5 rounded-[14px] border border-border bg-card p-[18px] text-foreground no-underline transition-colors hover:bg-muted/40"
        >
          <IconTile tone="green">
            <BookOpen />
          </IconTile>
          <div className="flex flex-grow flex-col gap-0.5">
            <span className="text-[15px] font-semibold">API docs</span>
            <span className="text-[13px] text-muted-foreground">
              Endpoints, auth and examples
              {limits?.apiRequestsPerDay
                ? ` · ${limits.apiRequestsPerDay.toLocaleString()} requests / day`
                : ""}
            </span>
          </div>
          <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
        </a>
      </div>

      <SettingsCard
        title="API keys"
        description={
          limits
            ? `${activeCount} of ${limits.maxApiCredentials} keys on ${credsQuery.data?.plan ?? "this plan"}. We only show a key once, right after you create it.`
            : "We only show a key once, right after you create it."
        }
        actions={
          apiAvailable ? (
            createButton
          ) : (
            // Shown locked; the tooltip names the plan that includes API access.
            <FeatureGate module="api" action="create_keys">
              {createButton}
            </FeatureGate>
          )
        }
      >
        {credsQuery.isLoading ? (
          <div className="flex flex-col gap-2 px-6 py-5">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-[10px]" />
            ))}
          </div>
        ) : creds.length === 0 ? (
          <CardNote>No API keys yet. Create one to call the API from your own tools.</CardNote>
        ) : (
          <SettingsTable>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Key</Th>
                <Th>Expires</Th>
                <Th>Last used</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {creds.map((cred) => {
                const status = KEY_STATUS[cred.status];
                return (
                  <tr key={cred.id}>
                    <Td className="font-semibold">
                      <div className="flex flex-wrap items-center gap-2">
                        {cred.name}
                        {cred.status !== "active" && (
                          <StatusChip tone={status.tone}>{status.label}</StatusChip>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <span className="whitespace-nowrap rounded-[6px] bg-muted px-2 py-[3px] font-mono text-[13px]">
                        {cred.maskedKey}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-muted-foreground">
                      {cred.neverExpires ? "Never" : shortDate(cred.expiresAt)}
                    </Td>
                    <Td className="whitespace-nowrap text-muted-foreground">
                      {cred.lastUsedAt ? timeAgo(cred.lastUsedAt) : "Never"}
                    </Td>
                    <Td className="w-px text-right">
                      <SettingsButton variant="ghost" onClick={() => setDeletingId(cred.id)}>
                        Revoke
                      </SettingsButton>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </SettingsTable>
        )}
      </SettingsCard>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New API key</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <label htmlFor="api-key-name" className="text-[13px] font-semibold">
              Key name
            </label>
            <TextField
              id="api-key-name"
              placeholder="My integration"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value.slice(0, LIMITS.apiKeyName.max))}
              maxLength={LIMITS.apiKeyName.max}
            />
            <p className="m-0 text-right text-xs text-muted-foreground">
              {newKeyName.length}/{LIMITS.apiKeyName.max}
            </p>
          </div>
          <DialogFooter>
            <SettingsButton onClick={() => setCreateOpen(false)}>Cancel</SettingsButton>
            <SettingsButton
              variant="primary"
              disabled={
                createMutation.isPending ||
                Boolean(lengthError(newKeyName, "Key name", LIMITS.apiKeyName))
              }
              onClick={() => createMutation.mutate(newKeyName.trim())}
            >
              {createMutation.isPending ? "Creating…" : "Create key"}
            </SettingsButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deletingId)} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API key?</AlertDialogTitle>
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
              {deleteMutation.isPending ? "Revoking…" : "Revoke"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
