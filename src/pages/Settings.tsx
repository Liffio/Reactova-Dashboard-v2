import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Instagram, Trash2, Plus, RefreshCw, ChevronRight, Shield } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageTabs } from "@/components/page/PageTabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAppSelector } from "@/store/hooks";
import { CopyButton, CopyField } from "@/components/CopyButton";
import { StatusDot } from "@/components/StatusBadge";
import { getWorkspaceIndicatorStatus } from "@/lib/workspaceIndicator";
import { resolveInstagramConnected } from "@/lib/workspaceInstagram";
import { ApiCredentialsSettings } from "@/components/settings/ApiCredentialsSettings";
import { InstagramMusicSessionSettings } from "@/components/settings/InstagramMusicSessionSettings";
import { BillingContent } from "@/pages/Billing";
import { PlanGate } from "@/components/PlanGate";
import { useApp } from "@/state/AppContext";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/api";
import { openMetaOAuthPopup, buildMetaOAuthStartPath } from "@/lib/metaOAuthPopup";
import { toast } from "@/components/ui/sonner";
import {
  useCreateInviteMutation,
  useRemoveMemberMutation,
  useRevokeInviteMutation,
  useTeamInvitesQuery,
  useTeamMembersQuery,
  useTeamOptionsQuery,
  useUpdateMemberMutation
} from "@/hooks/useTeamAccess";
import { useDeleteWorkspaceMutation } from "@/hooks/useDeleteWorkspace";
import {
  useNotificationsQuery,
  useUpdateNotificationPreferenceMutation
} from "@/hooks/useNotifications";

const tabs = ["General", "Billing", "Notifications", "Team", "API", "Security"] as const;
type Tab = (typeof tabs)[number];

const settingsSearch = (tab: Tab, page?: string) => {
  const params = new URLSearchParams({ tab });
  if (tab === "Security" && page) {
    params.set("page", page);
  }
  return `/settings?${params.toString()}`;
};

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as Tab | null) ?? "General";
  const securityPage = searchParams.get("page") ?? "index";
  const { current } = useApp();

  const selectTab = (next: Tab) => {
    if (next === "Security") {
      setSearchParams({ tab: "Security", page: "index" });
    } else {
      setSearchParams({ tab: next });
    }
  };

  return (
    <DashboardLayout title="Settings" subtitle={`Workspace: ${current.name}`}>
      <PageTabs
        className="-mt-2"
        tabs={tabs.map((t) => ({ id: t, label: t }))}
        value={tab}
        onChange={selectTab}
      />

      {tab === "General" && <General />}
      {tab === "Billing" && <BillingSettingsTab />}
      {tab === "Notifications" && <Notifications />}
      {tab === "Team" && <Team />}
      {tab === "API" && <ApiCredentialsSettings />}
      {tab === "Security" && (
        <SecuritySection
          page={
            ["index", "2fa", "mfa", "consent", "delete"].includes(securityPage)
              ? securityPage
              : "index"
          }
        />
      )}
    </DashboardLayout>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-5 surface-card space-y-4">
      <h3 className="font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function SecuritySection({ page }: { page: string }) {
  switch (page) {
    case "2fa":
      return <AuthenticatorPanel variant="2fa" />;
    case "mfa":
      return <AuthenticatorPanel variant="mfa" />;
    case "consent":
      return <SecurityConsent />;
    case "delete":
      return <DeleteAuthenticator />;
    default:
      return <SecurityHome />;
  }
}

function SecurityHome() {
  const links: Array<{ href: string; title: string; body: string }> = [
    {
      href: settingsSearch("Security", "2fa"),
      title: "Two-factor authentication (2FA)",
      body: "Second step is a one-time passcode (OTP)—here, a 6-digit code from your authenticator app after your password."
    },
    {
      href: settingsSearch("Security", "mfa"),
      title: "Multi-factor authentication (MFA)",
      body: "Broader login protection: password plus other factors (SMS, email OTP, authenticator, etc.). Liffio currently uses authenticator OTP; more channels may follow."
    },
    {
      href: settingsSearch("Security", "consent"),
      title: "Security disclosure & consent",
      body: "Review the disclosure you acknowledged. Security emails are sent from noreply with reply-to support@liffio.com."
    },
    {
      href: settingsSearch("Security", "delete"),
      title: "Remove authenticator",
      body: "Delete your linked authenticator (turn off 2FA/MFA) using your password and a final 6-digit code."
    }
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-background">
        <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-lg">Account security</h2>
          <p className="text-sm text-muted-foreground mt-1">
            <strong className="text-foreground">2FA</strong> here means a second factor using <strong className="text-foreground">OTP</strong> (one-time codes).
            <strong className="text-foreground"> MFA</strong> is the wider idea—combining password with SMS, email OTP,
            authenticator apps, and similar. Liffio currently delivers login OTP via an authenticator app; security
            notices are emailed from noreply@liffio.com (reply to support@liffio.com).
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        {links.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className="flex items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-card/80 transition-colors group"
          >
            <div>
              <div className="font-medium">{item.title}</div>
              <p className="text-sm text-muted-foreground mt-0.5">{item.body}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}

function AuthenticatorPanel({ variant }: { variant: "2fa" | "mfa" }) {
  const mfaEnabled = useAppSelector((s) => s.auth.mfaEnabled);
  const mfaEmailOtpEnabled = useAppSelector((s) => s.auth.mfaEmailOtpEnabled);
  const mfaSmsOtpEnabled = useAppSelector((s) => s.auth.mfaSmsOtpEnabled);
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const { refreshAuth } = useApp();
  const [setup, setSetup] = useState<{ qrDataUrl: string; secretKey: string } | null>(null);
  const [otpSetup, setOtpSetup] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [disableOtp, setDisableOtp] = useState("");

  const title =
    variant === "2fa"
      ? "Two-factor authentication (2FA)"
      : "Multi-factor authentication (MFA)";
  const lead =
    variant === "2fa"
      ? "2FA adds a second factor after your password: a one-time passcode (OTP). Here that OTP is a rotating 6-digit code from an authenticator app you control."
      : "MFA combines something you know (password) with additional factors—mobile SMS, email OTP, authenticator apps, and more. Liffio currently supports authenticator-based OTP for sign-in; SMS and email OTP may be added later.";

  const startMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ qrDataUrl: string; secretKey: string }>("/api/v1/auth/mfa/setup/start", {
        method: "POST"
      }),
    onSuccess: (data) => {
      setSetup({ qrDataUrl: data.qrDataUrl, secretKey: data.secretKey });
      setOtpSetup("");
    },
    onError: (error) => toast.error((error as Error).message)
  });

  const verifyMutation = useMutation({
    mutationFn: (code: string) =>
      apiRequest<void>("/api/v1/auth/mfa/setup/verify", {
        method: "POST",
        body: { code }
      }),
    onSuccess: async () => {
      toast.success("Authenticator enabled");
      setSetup(null);
      await refreshAuth();
    },
    onError: (error) => toast.error((error as Error).message)
  });

  const cancelMutation = useMutation({
    mutationFn: () => apiRequest<void>("/api/v1/auth/mfa/setup/cancel", { method: "POST" }),
    onSuccess: () => {
      setSetup(null);
      toast.info("Setup cancelled");
    }
  });

  const disableMutation = useMutation({
    mutationFn: () =>
      apiRequest<void>("/api/v1/auth/mfa/disable", {
        method: "POST",
        body: { password: disablePassword, code: disableOtp }
      }),
    onSuccess: async () => {
      toast.success("Authenticator removed — 2FA/MFA is off");
      setDisablePassword("");
      setDisableOtp("");
      await refreshAuth();
    },
    onError: (error) => toast.error((error as Error).message)
  });

  const channelMutation = useMutation({
    mutationFn: (body: { emailOtpEnabled?: boolean; smsOtpEnabled?: boolean }) =>
      apiRequest("/api/v1/auth/mfa/channels", { method: "POST", body }),
    onSuccess: async () => {
      await refreshAuth();
      toast.success("MFA channels updated");
    },
    onError: (error) => toast.error((error as Error).message)
  });

  if (!accessToken) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Link
        to={settingsSearch("Security", "index")}
        className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
      >
        <ChevronRight className="h-4 w-4 rotate-180" /> Security overview
      </Link>
      <Card title={title}>
        <p className="text-sm text-muted-foreground">{lead}</p>
        {variant === "mfa" && (
          <div className="rounded-lg border border-border p-3 space-y-3">
            <p className="text-xs text-muted-foreground">
              Choose active MFA OTP channels. SMS is visible but not supported yet.
            </p>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Email OTP</p>
                <p className="text-xs text-muted-foreground">Receive a 6-digit code by email during login.</p>
              </div>
              <Switch
                checked={mfaEmailOtpEnabled}
                onCheckedChange={(checked) => {
                  void channelMutation.mutateAsync({ emailOtpEnabled: checked });
                }}
                disabled={channelMutation.isPending}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">SMS OTP</p>
                <p className="text-xs text-muted-foreground">Coming soon (toggle kept for roadmap visibility).</p>
              </div>
              <Switch
                checked={mfaSmsOtpEnabled}
                onCheckedChange={(checked) => {
                  if (checked) {
                    toast.info("SMS OTP is not available yet.");
                    return;
                  }
                  void channelMutation.mutateAsync({ smsOtpEnabled: false });
                }}
                disabled
              />
            </div>
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          When you turn protection on or off, Liffio sends a security email from <span className="font-mono text-xs">noreply@liffio.com</span> with reply-to{" "}
          <span className="font-mono text-xs">support@liffio.com</span>. Other product emails still follow your workspace notification preferences.
        </p>
        {mfaEnabled ? (
          <div className="space-y-3 max-w-md">
            <p className="text-sm text-success">An authenticator is linked to your account.</p>
            <p className="text-xs text-muted-foreground">
              To remove it, use{" "}
              <Link className="text-primary hover:underline" to={settingsSearch("Security", "delete")}>
                Remove authenticator
              </Link>{" "}
              for a dedicated flow, or enter your password and code below.
            </p>
            <div className="space-y-1.5">
              <Label>Account password</Label>
              <Input
                type="password"
                className="bg-input border-border"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label>6-digit authenticator code</Label>
              <InputOTP
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
              disabled={disableMutation.isPending || disablePassword.length < 8 || disableOtp.length < 6}
              onClick={() => disableMutation.mutate()}
            >
              {disableMutation.isPending ? "Removing…" : "Turn off & remove authenticator"}
            </Button>
          </div>
        ) : !setup ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>
              {startMutation.isPending ? "Starting…" : "Set up authenticator app"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 max-w-md">
            <p className="text-sm text-muted-foreground">
              Scan the QR code or enter the setup key manually in your authenticator app, then enter the 6-digit code to
              confirm.
            </p>
            <img src={setup.qrDataUrl} alt="Authenticator QR" className="rounded-lg border border-border w-44 h-44 p-2 object-contain" />
            <div className="space-y-1.5">
              <Label>Setup key (copy if you cannot scan)</Label>
              <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-input border border-border">
                <span className="flex-1 text-sm font-mono text-foreground break-all select-all">{setup.secretKey}</span>
                <CopyButton value={setup.secretKey} className="shrink-0 mt-0.5" label="Copy" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>6-digit code</Label>
              <InputOTP
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
                type="button"
                disabled={verifyMutation.isPending || otpSetup.length !== 6}
                onClick={() => verifyMutation.mutate(otpSetup)}
              >
                {verifyMutation.isPending ? "Confirming…" : "Confirm and enable"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function SecurityConsent() {
  const consentAt = useAppSelector((s) => s.auth.mfaOnboardingConsentAt);
  const { refreshAuth } = useApp();
  const [revokePassword, setRevokePassword] = useState("");
  const [revokeConfirm, setRevokeConfirm] = useState(false);

  const revokeMutation = useMutation({
    mutationFn: () =>
      apiRequest<void>("/api/v1/auth/mfa/onboarding-consent/revoke", {
        method: "POST",
        body: { password: revokePassword }
      }),
    onSuccess: async () => {
      toast.success("Consent record cleared");
      setRevokePassword("");
      setRevokeConfirm(false);
      await refreshAuth();
    },
    onError: (error) => toast.error((error as Error).message)
  });

  const formatted = consentAt
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(consentAt))
    : null;

  return (
    <div className="space-y-4">
      <Link
        to={settingsSearch("Security", "index")}
        className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
      >
        <ChevronRight className="h-4 w-4 rotate-180" /> Security overview
      </Link>
      <Card title="Security disclosure & consent">
        <div className="text-sm text-muted-foreground space-y-3 leading-relaxed">
          <p>
            You acknowledged that extra login protection (2FA uses OTP; MFA can include OTP via app, SMS, email, and similar)
            is optional but recommended, that you are responsible for backup access to your factors, and that Liffio may
            email you from <span className="font-mono text-xs">noreply@liffio.com</span> when you change security settings—replies go to{" "}
            <span className="font-mono text-xs">support@liffio.com</span>.
          </p>
          <p>
            Workspace notification preferences still control routine product emails; they do not turn off these security
            notices.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background p-3 text-sm">
          <span className="text-muted-foreground">On file: </span>
          {formatted ? (
            <span className="font-medium text-foreground">Acknowledged {formatted}</span>
          ) : (
            <span className="text-muted-foreground">No onboarding acknowledgment timestamp stored yet.</span>
          )}
        </div>

        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-destructive">Delete consent record</h4>
          <p className="text-xs text-muted-foreground">
            Clears the stored onboarding disclosure timestamp only. It does not turn off an active authenticator or change
            workspaces. You may need to acknowledge again if you complete onboarding on a new workspace.
          </p>
          <div className="space-y-1.5 max-w-md">
            <Label>Account password</Label>
            <Input
              type="password"
              className="bg-input border-border"
              value={revokePassword}
              onChange={(e) => setRevokePassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={revokeConfirm} onChange={(e) => setRevokeConfirm(e.target.checked)} />I want to
            delete this consent record.
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
      </Card>
    </div>
  );
}

function DeleteAuthenticator() {
  const mfaEnabled = useAppSelector((s) => s.auth.mfaEnabled);
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const { refreshAuth } = useApp();
  const [disablePassword, setDisablePassword] = useState("");
  const [disableOtp, setDisableOtp] = useState("");

  const disableMutation = useMutation({
    mutationFn: () =>
      apiRequest<void>("/api/v1/auth/mfa/disable", {
        method: "POST",
        body: { password: disablePassword, code: disableOtp }
      }),
    onSuccess: async () => {
      toast.success("Authenticator removed — 2FA/MFA is off");
      setDisablePassword("");
      setDisableOtp("");
      await refreshAuth();
    },
    onError: (error) => toast.error((error as Error).message)
  });

  if (!accessToken) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Link
        to={settingsSearch("Security", "index")}
        className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
      >
        <ChevronRight className="h-4 w-4 rotate-180" /> Security overview
      </Link>
      <Card title="Remove authenticator (delete 2FA / MFA)">
        <p className="text-sm text-muted-foreground">
          Permanently unlinks your authenticator app from this account. You will only need your password to sign in until
          you set up a new authenticator.
        </p>
        {!mfaEnabled ? (
          <p className="text-sm text-muted-foreground">
            No authenticator is active.{" "}
            <Link className="text-primary hover:underline" to={settingsSearch("Security", "2fa")}>
              Set up 2FA
            </Link>{" "}
            or{" "}
            <Link className="text-primary hover:underline" to={settingsSearch("Security", "mfa")}>
              MFA
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-3 max-w-md">
            <div className="space-y-1.5">
              <Label>Account password</Label>
              <Input
                type="password"
                className="bg-input border-border"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label>6-digit code from authenticator</Label>
              <InputOTP
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
              disabled={disableMutation.isPending || disablePassword.length < 8 || disableOtp.length !== 6}
              onClick={() => disableMutation.mutate()}
            >
              {disableMutation.isPending ? "Removing…" : "Delete authenticator & turn off 2FA"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

function General() {
  const { current, workspaces, setCurrentId, refreshAuth } = useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [workspaceName, setWorkspaceName] = useState(current.name);
  const [unlinkConfirm, setUnlinkConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    setWorkspaceName(current.name);
  }, [current.id, current.name]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const meta = params.get("meta");
    if (!meta) {
      return;
    }

    if (meta === "connected") {
      void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      void refreshAuth();
      toast.success("Instagram connected successfully");
    } else if (meta === "error") {
      const reason = decodeURIComponent(params.get("reason") ?? "");
      toast.error(reason ? `Instagram connection failed: ${reason.replace(/_/g, " ")}` : "Instagram connection failed");
    }

    params.delete("meta");
    params.delete("reason");
    params.delete("step");
    const next = params.toString();
    navigate(next ? `/settings?${next}` : "/settings?tab=General", { replace: true });
  }, [navigate, queryClient, refreshAuth]);

  const renameWorkspaceMutation = useMutation({
    mutationFn: async (displayName: string) =>
      apiRequest(`/api/v1/workspaces/${current.id}`, {
        method: "PATCH",
        workspaceId: current.id,
        body: { displayName: displayName.trim() }
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      toast.success("Workspace renamed");
    },
    onError: (error) => toast.error((error as Error).message)
  });
  const checkWorkspaceInstagramConnected = async () => {
    const workspaces = await apiRequest<
      Array<{ id: string; instagramConnected?: boolean; onboarding?: Record<string, unknown> }>
    >("/api/v1/workspaces", { workspaceId: current.id });
    const workspace = workspaces.find((item) => item.id === current.id);
    return workspace ? resolveInstagramConnected(workspace) : false;
  };

  const reconnectMutation = useMutation({
    mutationFn: () => {
      const wasAlreadyConnected = resolveInstagramConnected(current);
      let authorizeUrlReady = false;
      return openMetaOAuthPopup(
        async () => {
          const { url } = await apiRequest<{ url: string }>(buildMetaOAuthStartPath("settings"), {
            workspaceId: current.id,
          });
          authorizeUrlReady = true;
          return url;
        },
        {
          checkConnected: async () => {
            if (!authorizeUrlReady || wasAlreadyConnected) {
              return false;
            }
            return checkWorkspaceInstagramConnected();
          },
          verifyConnected: checkWorkspaceInstagramConnected,
        }
      );
    },
    onSuccess: async (result) => {
      if (result.meta === "connected") {
        await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
        await queryClient.invalidateQueries({ queryKey: ["scheduler", "platform-accounts", current.id] });
        await refreshAuth();
        toast.success("Instagram connected successfully");
        return;
      }
      const reason = result.reason ?? "token_exchange_failed";
      if (reason === "user_canceled") {
        // User deliberately closed the Meta popup — no error to show
        return;
      }
      if (reason === "connection_not_persisted") {
        toast.error(
          "Instagram authorized but Liffio could not save the connection. Restart the API worker and try again."
        );
        return;
      }
      toast.error(`Instagram connection failed: ${reason.replace(/_/g, " ")}`);
    },
    onError: (error) => toast.error((error as Error).message)
  });
  const unlinkMutation = useMutation({
    mutationFn: async () =>
      apiRequest<void>("/api/v1/integrations/meta/unlink", {
        method: "POST",
        workspaceId: current.id
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      await queryClient.invalidateQueries({ queryKey: ["scheduler", "platform-accounts", current.id] });
      await refreshAuth();
      setUnlinkConfirm(false);
      toast.success("Instagram disconnected for this workspace");
    },
    onError: (error) => toast.error((error as Error).message)
  });
  const deleteWorkspaceMutation = useDeleteWorkspaceMutation(async (deletedWorkspaceId) => {
    const nextWorkspace = workspaces.find((workspace) => workspace.id !== deletedWorkspaceId);
    setCurrentId(nextWorkspace?.id ?? "");
    await refreshAuth();
    setDeleteConfirm(false);
    toast.success("Workspace deleted");
    navigate("/dashboard");
  });

  return (
    <div className="space-y-5">
      <Card title="Workspace">
        <div className="space-y-2">
          <Label htmlFor="workspace-name">Workspace name</Label>
          <Input
            id="workspace-name"
            value={workspaceName}
            onChange={(event) => setWorkspaceName(event.target.value)}
            className="bg-input border-border max-w-md"
            maxLength={80}
            disabled={renameWorkspaceMutation.isPending}
          />
          {current.igHandle && (
            <p className="text-xs text-muted-foreground">
              Instagram: <span className="font-mono">{current.igHandle}</span>
            </p>
          )}
        </div>
        <Button
          disabled={
            renameWorkspaceMutation.isPending ||
            !workspaceName.trim() ||
            workspaceName.trim() === current.name
          }
          onClick={() => renameWorkspaceMutation.mutate(workspaceName)}
        >
          {renameWorkspaceMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </Card>
      <Card title="Account security">
        <p className="text-sm text-muted-foreground">
          2FA (OTP second step), MFA overview (app and future SMS or email OTP), consent, and removing your authenticator.
        </p>
        <ul className="space-y-2 text-sm pt-1">
          <li>
            <Link
              className="text-primary hover:underline inline-flex items-center gap-1"
              to={settingsSearch("Security", "2fa")}
            >
              Two-factor authentication (2FA) <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </li>
          <li>
            <Link
              className="text-primary hover:underline inline-flex items-center gap-1"
              to={settingsSearch("Security", "mfa")}
            >
              Multi-factor authentication (MFA) <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </li>
          <li>
            <Link
              className="text-primary hover:underline inline-flex items-center gap-1"
              to={settingsSearch("Security", "consent")}
            >
              Security disclosure & consent <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </li>
          <li>
            <Link
              className="text-primary hover:underline inline-flex items-center gap-1"
              to={settingsSearch("Security", "delete")}
            >
              Remove authenticator <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </li>
          <li>
            <Link
              className="text-muted-foreground hover:text-primary inline-flex items-center gap-1 text-xs"
              to={settingsSearch("Security", "index")}
            >
              All security settings <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </li>
        </ul>
      </Card>
      <Card title="Instagram Connection">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <StatusDot
              status={getWorkspaceIndicatorStatus({
                status: current.status,
                instagramConnected: resolveInstagramConnected(current)
              })}
            />
            <span className="font-mono text-sm">
              {resolveInstagramConnected(current) && current.igHandle
                ? current.igHandle
                : "Not connected"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => reconnectMutation.mutate()}
              disabled={reconnectMutation.isPending}
            >
              <Instagram className="h-4 w-4" />
              {reconnectMutation.isPending ? "Opening..." : "Reconnect"}
            </Button>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => unlinkMutation.mutate()}
              disabled={!unlinkConfirm || unlinkMutation.isPending}
            >
              {unlinkMutation.isPending ? "Disconnecting..." : "Disconnect"}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          During Instagram authorisation, Meta can show the registered app name. This is a Meta platform limitation and does not affect your Liffio branding.
        </p>
        <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 space-y-2">
          <p className="text-xs text-warning">
            Warning: reconnecting or unlinking this Instagram account is workspace-specific and permanently removes this workspace's linked automations,
            short links, bio link, and generated leads. This cannot be undone.
          </p>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={unlinkConfirm}
              onChange={(event) => setUnlinkConfirm(event.target.checked)}
            />
            I understand this workspace data will be permanently lost when switching accounts.
          </label>
        </div>
        <InstagramMusicSessionSettings
          workspaceId={current.id}
          instagramConnected={resolveInstagramConnected(current)}
        />
      </Card>
      <div className="p-5 rounded-xl bg-destructive/5 border border-destructive/30 space-y-3">
        <h3 className="font-semibold text-destructive">Danger Zone</h3>
        <p className="text-sm text-muted-foreground">Permanently delete this workspace and all of its automations, leads, and short links.</p>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={deleteConfirm}
            onChange={(event) => setDeleteConfirm(event.target.checked)}
          />
          I understand this action permanently deletes this workspace and its data.
        </label>
        <Button
          variant="destructive"
          disabled={!deleteConfirm || deleteWorkspaceMutation.isPending || workspaces.length <= 1}
          onClick={() =>
            deleteWorkspaceMutation.mutate(current.id, {
              onError: (error) => toast.error((error as Error).message)
            })
          }
        >
          {deleteWorkspaceMutation.isPending ? "Deleting..." : "Delete Workspace"}
        </Button>
        {workspaces.length <= 1 && (
          <p className="text-xs text-muted-foreground">At least one workspace must remain on your account.</p>
        )}
      </div>
    </div>
  );
}

function BillingSettingsTab() {
  return <BillingContent />;
}


function Notifications() {
  const { current } = useApp();
  const notificationsQuery = useNotificationsQuery(current.id);
  const updatePreferenceMutation = useUpdateNotificationPreferenceMutation(current.id);
  return (
    <Card title="Notifications">
      <div className="space-y-3">
        {(notificationsQuery.data?.preferences ?? []).map((item) => (
          <div key={item.type} className="flex items-center justify-between py-2 border-b border-border last:border-0">
            <div className="text-sm">{item.label}</div>
            <Switch
              checked={item.isEnabled}
              onCheckedChange={(checked) =>
                updatePreferenceMutation.mutate({
                  type: item.type,
                  isEnabled: checked
                })
              }
            />
          </div>
        ))}
        {!notificationsQuery.isLoading && (notificationsQuery.data?.preferences.length ?? 0) === 0 && (
          <p className="text-xs text-muted-foreground">No notification preferences found for this workspace.</p>
        )}
      </div>
    </Card>
  );
}

const PLAN_TEAM_LIMITS: Record<string, number> = {
  Free: 2, Starter: 5, Pro: 10, Business: 20, Agency: 50
};

function Team() {
  const { current } = useApp();
  const membersQuery = useTeamMembersQuery(current.id);
  const invitesQuery = useTeamInvitesQuery(current.id);
  const optionsQuery = useTeamOptionsQuery(current.id);
  const createInviteMutation = useCreateInviteMutation(current.id);
  const revokeInviteMutation = useRevokeInviteMutation(current.id);
  const updateMemberMutation = useUpdateMemberMutation(current.id);
  const removeMemberMutation = useRemoveMemberMutation(current.id);

  const [email, setEmail] = useState("");
  const [roleKey, setRoleKey] = useState("MEMBER");
  const [permissionKeys, setPermissionKeys] = useState<string[]>([]);
  const [policyKeys, setPolicyKeys] = useState<string[]>([]);

  const memberLimit = PLAN_TEAM_LIMITS[current.plan] ?? 2;
  const memberCount = membersQuery.data?.length ?? 0;
  const atLimit = memberCount >= memberLimit;

  const moduleGroups = useMemo(() => {
    const grouped = new Map<string, { moduleName: string; keys: string[] }>();
    for (const permission of optionsQuery.data?.permissions ?? []) {
      const currentGroup = grouped.get(permission.moduleKey) ?? {
        moduleName: permission.moduleName,
        keys: []
      };
      currentGroup.keys.push(permission.key);
      grouped.set(permission.moduleKey, currentGroup);
    }
    return Array.from(grouped.entries()).map(([moduleKey, value]) => ({
      moduleKey,
      moduleName: value.moduleName,
      keys: value.keys.sort()
    }));
  }, [optionsQuery.data]);

  const onTogglePermission = (key: string) => {
    setPermissionKeys((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  const onTogglePolicy = (key: string) => {
    setPolicyKeys((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  return (
    <div className="space-y-5">
      <section className="surface-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Invite Team Member</h3>
          <span className="text-xs text-muted-foreground">
            {memberCount} / {memberLimit} seats used
          </span>
        </div>
        {atLimit && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-muted-foreground">
            You've reached the {memberLimit}-member limit on the {current.plan} plan.{" "}
            <Link to="/billing" className="font-medium text-foreground underline underline-offset-2 hover:text-primary">Upgrade</Link>{" "}
            to invite more people.
          </div>
        )}
        <div className="grid md:grid-cols-3 gap-2">
          <Input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="member@company.com"
            className="bg-input border-border"
            disabled={atLimit}
          />
          <select
            value={roleKey}
            onChange={(event) => setRoleKey(event.target.value)}
            className="h-10 rounded-md border border-border bg-input px-3 text-sm disabled:opacity-50"
            disabled={atLimit}
          >
            {(optionsQuery.data?.roles ?? []).map((role) => (
              <option key={role.key} value={role.key}>
                {role.name}
              </option>
            ))}
          </select>
          <Button
            onClick={async () => {
              const result = await createInviteMutation.mutateAsync({
                email,
                roleKey,
                moduleAccess: [],
                permissionKeys,
                policyKeys
              });
              if (result.emailSent) {
                toast.success(`Invitation sent to ${email}. They'll receive an email with a link to accept.`);
              } else if (result.inAppNotified) {
                toast.success(`Invite created for ${email}. They already have a Liffio account and were notified in-app.`);
              } else {
                toast.warning(
                  `Invite created for ${email}, but email could not be sent. Check BREVO_API_KEY / SMTP settings on the server.`
                );
              }
              setEmail("");
              setPermissionKeys([]);
              setPolicyKeys([]);
            }}
            disabled={!email || createInviteMutation.isPending || atLimit}
          >
            <Plus className="h-4 w-4" /> Send Invite
          </Button>
        </div>

        <div className="grid lg:grid-cols-2 gap-3">
          <div className="rounded-lg border border-border p-3 space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Permissions</div>
            <div className="max-h-48 overflow-auto space-y-2">
              {moduleGroups.map((module) => (
                <div key={module.moduleKey} className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">{module.moduleName}</div>
                  <div className="flex flex-wrap gap-2">
                    {module.keys.map((key) => (
                      <label key={key} className="text-xs flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={permissionKeys.includes(key)}
                          onChange={() => onTogglePermission(key)}
                        />
                        {key}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border p-3 space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Policies</div>
            <div className="max-h-48 overflow-auto space-y-2">
              {(optionsQuery.data?.policies ?? []).map((policy) => (
                <label key={policy.key} className="text-xs flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={policyKeys.includes(policy.key)}
                    onChange={() => onTogglePolicy(policy.key)}
                  />
                  <span>
                    <span className="font-medium">{policy.key}</span>
                    <span className="block text-muted-foreground">
                      {policy.effect} {policy.moduleKey}:{policy.action}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {createInviteMutation.error && (
          <p className="text-sm text-destructive">{(createInviteMutation.error as Error).message}</p>
        )}
      </section>

      <section className="surface-card overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted-foreground border-b border-border">
            <th className="px-5 py-3">Member</th><th className="px-5 py-3">Email</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Permissions</th><th />
          </tr></thead>
          <tbody>{(membersQuery.data ?? []).map((m) => {
            const isOwner = m.role.key === "OWNER";
            return (
              <tr key={m.user.email} className="stripe-row">
                <td className="px-5 py-3 flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-semibold">{m.user.name.split(" ").map(n => n[0]).join("")}</div>
                  {m.user.name}
                  {isOwner && <span className="text-[10px] text-primary">owner</span>}
                </td>
                <td className="px-5 py-3 text-muted-foreground">
                  {m.user.email}
                  {m.immutableSuperAdmin && <span className="text-[10px] text-primary block">immutable super admin</span>}
                </td>
                <td className="px-5 py-3">
                  {isOwner ? (
                    <span className="text-xs text-muted-foreground">Owner</span>
                  ) : (
                    <select
                      className="h-8 rounded-md border border-border bg-input px-2 text-xs"
                      value={m.role.key}
                      onChange={async (event) => {
                        await updateMemberMutation.mutateAsync({
                          userId: m.user.id,
                          payload: { roleKey: event.target.value, permissionKeys: [], policyKeys: [] }
                        });
                      }}
                      disabled={m.immutableSuperAdmin || updateMemberMutation.isPending}
                    >
                      {(optionsQuery.data?.roles ?? []).map((role) => (
                        <option key={role.key} value={role.key}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-5 py-3 text-muted-foreground text-sm">{m.permissions.length} perms</td>
                <td className="px-5 py-3">
                  {!isOwner && (
                    <button
                      disabled={m.immutableSuperAdmin || removeMemberMutation.isPending}
                      onClick={async () => {
                        await removeMemberMutation.mutateAsync(m.user.id);
                        toast.success(`${m.user.name} removed from workspace`);
                      }}
                      className="p-1.5 text-muted-foreground hover:text-destructive disabled:opacity-50"
                      title="Remove member"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}</tbody>
        </table>
      </section>

      <section className="surface-card p-4">
        <h3 className="font-semibold mb-3">Invites</h3>
        <div className="space-y-2 text-sm">
          {(invitesQuery.data ?? []).map((invite) => (
            <div key={invite.id} className="flex items-center justify-between border border-border rounded-lg px-3 py-2 gap-2">
              <div className="min-w-0">
                <div className="font-medium truncate">{invite.email}</div>
                <div className="text-xs text-muted-foreground">
                  {invite.baseRole?.name ?? invite.baseRole?.key ?? "Member"} ·{" "}
                  <span className={
                    invite.status === "PENDING" ? "text-amber-500"
                    : invite.status === "ACCEPTED" ? "text-green-500"
                    : "text-muted-foreground"
                  }>
                    {invite.status === "PENDING" ? "Awaiting acceptance"
                     : invite.status === "ACCEPTED" ? "Active"
                     : invite.status === "EXPIRED" ? "Expired"
                     : "Revoked"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {invite.status === "PENDING" && new Date(invite.expiresAt) > new Date() && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    expires {new Date(invite.expiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                )}
                {invite.status === "PENDING" && (
                  <button
                    disabled={revokeInviteMutation.isPending}
                    onClick={async () => {
                      await revokeInviteMutation.mutateAsync(invite.id);
                      toast.success("Invite revoked");
                    }}
                    className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-50"
                    title="Revoke invite"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                {invite.status === "ACCEPTED" && invite.acceptedUserId && (
                  <button
                    disabled={removeMemberMutation.isPending}
                    onClick={async () => {
                      await removeMemberMutation.mutateAsync(invite.acceptedUserId!);
                      toast.success(`${invite.email} removed from workspace`);
                    }}
                    className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-50"
                    title="Remove access"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {invitesQuery.data?.length === 0 && <p className="text-xs text-muted-foreground">No invites sent yet.</p>}
        </div>
      </section>
    </div>
  );
}

