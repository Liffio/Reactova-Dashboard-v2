import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, Laptop, Loader2, Smartphone } from "lucide-react";

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
import { accountApi } from "@/lib/api/account-api";
import { useAuthState } from "@/lib/auth/auth-store";
import { getUserErrorMessage } from "@/lib/user-facing-error";
import { toast } from "@/lib/toast";
import { TwoFactorSettings } from "../pages/workspace-panels";
import { SettingRow, SettingsCard, StatusChip, shortDate, timeAgo } from "../components";

/** Mirrors the server's shared `passwordRule` minimum; the server is the authority. */
const PASSWORD_MIN = 8;

/** `?google=error&code=...` from the link-mode OAuth callback → readable copy. */
const GOOGLE_ERRORS: Record<string, string> = {
  google_already_linked: "That Google account is already linked to another Liffio account.",
};

export function SecurityTab({ search }: { search: { google?: string; code?: string } }) {
  const user = useAuthState((s) => s.user);
  const emailVerified = useAuthState((s) => s.emailVerified);
  const mfaEnabled = useAuthState((s) => s.mfaEnabled);
  const mfaEmailOtpEnabled = useAuthState((s) => s.mfaEmailOtpEnabled);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<null | "email" | "password" | "2fa">(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["auth-me"] });

  useEffect(() => {
    if (!search.google) return;
    if (search.google === "linked") {
      toast.success("Google connected");
      void refresh();
    } else {
      toast.error(GOOGLE_ERRORS[search.code ?? ""] ?? "Couldn't connect Google. Try again.");
    }
    void navigate({ to: "/settings/security", search: {}, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.google]);

  const google = useMutation({
    mutationFn: async () => {
      if (user?.googleConnected) {
        await accountApi.disconnectGoogle();
        return null;
      }
      return (await accountApi.startGoogleLink()).url;
    },
    onSuccess: (url) => {
      if (url) {
        window.location.assign(url);
        return;
      }
      toast.success("Google disconnected");
      void refresh();
    },
    onError: (e) => toast.error(getUserErrorMessage(e)),
  });

  if (!user) return null;

  const checks = [
    { label: "Email verified", ok: emailVerified },
    { label: "Password set", ok: Boolean(user.hasPassword) },
    { label: "Two-factor on", ok: mfaEnabled },
    {
      label: "Backup sign-in method",
      ok: Boolean(user.hasPassword) && Boolean(user.googleConnected),
    },
  ];
  const score = checks.filter((c) => c.ok).length;

  return (
    <div className="space-y-6">
      <SettingsCard title="Security checkup" description={`${score} of ${checks.length} done`}>
        <div className="grid gap-2 px-5 py-4 sm:grid-cols-2">
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-2 text-sm">
              {c.ok ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={c.ok ? "" : "text-muted-foreground"}>{c.label}</span>
            </div>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Sign-in methods"
        description="Changing any of these asks you to confirm it's you first."
      >
        <SettingRow
          label={
            <span className="flex items-center gap-2">
              Email address{" "}
              <StatusChip tone={emailVerified ? "success" : "warning"}>
                {emailVerified ? "Verified" : "Not verified"}
              </StatusChip>
            </span>
          }
          hint={
            user.pendingEmail
              ? `Waiting for the code sent to ${user.pendingEmail}.`
              : `${user.email}. We send a code to the new address and a heads-up to this one.`
          }
        >
          <Button variant="outline" size="sm" onClick={() => setDialog("email")}>
            {user.pendingEmail ? "Enter code" : "Change"}
          </Button>
        </SettingRow>

        <SettingRow
          label="Password"
          hint={
            user.hasPassword
              ? `Last changed ${timeAgo(user.passwordChangedAt)}. Changing it signs you out everywhere else.`
              : "You sign in with Google. Set a password as a backup."
          }
        >
          <Button variant="outline" size="sm" onClick={() => setDialog("password")}>
            {user.hasPassword ? "Change" : "Set a password"}
          </Button>
        </SettingRow>

        <SettingRow
          label={
            <span className="flex items-center gap-2">
              Google{" "}
              <StatusChip tone={user.googleConnected ? "success" : "muted"}>
                {user.googleConnected ? "Connected" : "Not connected"}
              </StatusChip>
            </span>
          }
          hint={
            user.googleConnected
              ? user.hasPassword
                ? "One-click sign in. You have a password too, so you can disconnect safely."
                : "Set a password before disconnecting, or you won't be able to sign in."
              : "Sign in with one click."
          }
        >
          <Button
            variant="outline"
            size="sm"
            disabled={google.isPending || (user.googleConnected && !user.hasPassword)}
            onClick={() => google.mutate()}
          >
            {google.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {user.googleConnected ? "Disconnect" : "Connect"}
          </Button>
        </SettingRow>
      </SettingsCard>

      <SettingsCard
        title="Two-factor authentication"
        description="A second step at sign in, so a stolen password is not enough."
      >
        <SettingRow
          label="Authenticator app"
          hint="Google Authenticator, 1Password, Authy and similar."
        >
          <StatusChip tone={mfaEnabled ? "success" : "muted"}>
            {mfaEnabled ? "On" : "Off"}
          </StatusChip>
          <Button variant="outline" size="sm" onClick={() => setDialog("2fa")}>
            Manage
          </Button>
        </SettingRow>
        <SettingRow label="Email code" hint="A 6-digit code sent to your email at sign in.">
          <StatusChip tone={mfaEmailOtpEnabled ? "success" : "muted"}>
            {mfaEmailOtpEnabled ? "On" : "Off"}
          </StatusChip>
        </SettingRow>
        <SettingRow label="SMS code" hint="Text message codes to your phone.">
          <StatusChip tone="muted">Coming soon</StatusChip>
        </SettingRow>
      </SettingsCard>

      <SessionsCard />

      <EmailChangeDialog
        open={dialog === "email"}
        onClose={() => setDialog(null)}
        pendingEmail={user.pendingEmail ?? null}
      />
      <PasswordDialog
        open={dialog === "password"}
        onClose={() => setDialog(null)}
        hasPassword={Boolean(user.hasPassword)}
      />
      <Dialog open={dialog === "2fa"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Two-factor authentication</DialogTitle>
          </DialogHeader>
          <TwoFactorSettings />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SessionsCard() {
  const queryClient = useQueryClient();
  const sessions = useQuery({ queryKey: ["account-sessions"], queryFn: accountApi.listSessions });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["account-sessions"] });

  const revokeOne = useMutation({
    mutationFn: accountApi.revokeSession,
    onSuccess: () => {
      toast.success("Signed out. It can take a few minutes to take effect on that device.");
      void invalidate();
    },
    onError: (e) => toast.error(getUserErrorMessage(e)),
  });
  const revokeOthers = useMutation({
    mutationFn: accountApi.revokeOtherSessions,
    onSuccess: (r) => {
      toast.success(
        `Signed out ${r.count} other device${r.count === 1 ? "" : "s"}, within a few minutes.`,
      );
      void invalidate();
    },
    onError: (e) => toast.error(getUserErrorMessage(e)),
  });

  const list = sessions.data?.sessions ?? [];
  const others = list.filter((s) => !s.current).length;

  return (
    <SettingsCard
      title="Active sessions"
      description="Don't recognise a device? Sign it out and change your password."
      actions={
        others > 0 ? (
          <Button
            variant="outline"
            size="sm"
            disabled={revokeOthers.isPending}
            onClick={() => revokeOthers.mutate()}
          >
            {revokeOthers.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign out all others
          </Button>
        ) : undefined
      }
    >
      {sessions.isLoading && (
        <p className="px-5 py-4 text-sm text-muted-foreground">Loading sessions…</p>
      )}
      {sessions.error && (
        <p className="px-5 py-4 text-sm text-destructive">{getUserErrorMessage(sessions.error)}</p>
      )}
      {list.map((s) => {
        const Icon = s.deviceType === "mobile" || s.deviceType === "tablet" ? Smartphone : Laptop;
        return (
          <div key={s.id} className="flex items-center gap-3 px-5 py-3">
            <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {s.device}
                {s.current && <StatusChip tone="success">This device</StatusChip>}
              </div>
              <p className="text-xs text-muted-foreground">
                {[
                  s.ipMasked,
                  `Signed in ${shortDate(s.signedInAt)}`,
                  s.current ? "Active now" : `Active ${timeAgo(s.lastActiveAt)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            {!s.current && (
              <Button
                variant="ghost"
                size="sm"
                disabled={revokeOne.isPending}
                onClick={() => revokeOne.mutate(s.id)}
              >
                Sign out
              </Button>
            )}
          </div>
        );
      })}
    </SettingsCard>
  );
}

function EmailChangeDialog({
  open,
  onClose,
  pendingEmail,
}: {
  open: boolean;
  onClose: () => void;
  pendingEmail: string | null;
}) {
  const queryClient = useQueryClient();
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const stage = pendingEmail ? "confirm" : "start";
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["auth-me"] });

  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      if (done) toast.success(done);
      await refresh();
      return true;
    } catch (e) {
      setError(getUserErrorMessage(e));
      await refresh();
      return false;
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setNewEmail("");
    setCode("");
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{stage === "start" ? "Change email" : "Confirm your new email"}</DialogTitle>
          <DialogDescription>
            {stage === "start"
              ? "We'll send a 6-digit code to the new address. Your current address gets a heads-up once it changes."
              : `Enter the code we sent to ${pendingEmail}. It expires in 15 minutes.`}
          </DialogDescription>
        </DialogHeader>
        {stage === "start" ? (
          <div className="space-y-2">
            <Label htmlFor="new-email">New email</Label>
            <Input
              id="new-email"
              type="email"
              autoComplete="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="email-code">Code</Label>
            <Input
              id="email-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <div className="flex gap-3 text-xs">
              <button
                type="button"
                className="text-primary hover:underline"
                disabled={busy}
                onClick={() => void run(accountApi.resendEmailChange, "Code resent")}
              >
                Resend code
              </button>
              <button
                type="button"
                className="text-muted-foreground hover:underline"
                disabled={busy}
                onClick={() => void run(accountApi.cancelEmailChange).then((ok) => ok && close())}
              >
                Cancel change
              </button>
            </div>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={busy}>
            Close
          </Button>
          {stage === "start" ? (
            <Button
              disabled={busy || !newEmail.includes("@")}
              onClick={() => void run(() => accountApi.startEmailChange(newEmail), "Code sent")}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send code
            </Button>
          ) : (
            <Button
              disabled={busy || code.length !== 6}
              onClick={() =>
                void run(
                  () => accountApi.confirmEmailChange(code),
                  "Email changed. Other devices were signed out.",
                ).then((ok) => ok && close())
              }
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PasswordDialog({
  open,
  onClose,
  hasPassword,
}: {
  open: boolean;
  onClose: () => void;
  hasPassword: boolean;
}) {
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
    onClose();
  };

  const localError =
    next && next.length < PASSWORD_MIN
      ? `Use at least ${PASSWORD_MIN} characters.`
      : confirm && next !== confirm
        ? "Passwords don't match."
        : null;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const out = hasPassword
        ? await accountApi.changePassword({ currentPassword: current, newPassword: next })
        : await accountApi.setPassword(next);
      toast.success(
        out.signedOutDevices > 0
          ? `Password saved. Signed out ${out.signedOutDevices} other device${out.signedOutDevices === 1 ? "" : "s"}.`
          : "Password saved.",
      );
      await queryClient.invalidateQueries({ queryKey: ["auth-me"] });
      await queryClient.invalidateQueries({ queryKey: ["account-sessions"] });
      close();
    } catch (e) {
      setError(getUserErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{hasPassword ? "Change password" : "Set a password"}</DialogTitle>
          <DialogDescription>
            You'll stay signed in here. Every other device is signed out.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {hasPassword && (
            <div className="space-y-1.5">
              <Label htmlFor="pw-current">Current password</Label>
              <Input
                id="pw-current"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="pw-new">New password</Label>
            <Input
              id="pw-new"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-confirm">Confirm new password</Label>
            <Input
              id="pw-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
        </form>
        {(localError || error) && <p className="text-sm text-destructive">{localError ?? error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button
            disabled={
              busy || Boolean(localError) || !next || next !== confirm || (hasPassword && !current)
            }
            onClick={() => void submit()}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
