import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Info,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  Monitor,
  Smartphone,
  Sparkles,
} from "lucide-react";

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
import { cn } from "@/lib/utils";
import { TwoFactorSettings } from "../pages/workspace-panels";
import {
  CardNote,
  IconTile,
  ListRow,
  OkChip,
  PlainCard,
  SettingsButton,
  SettingsCard,
  SettingsPanel,
  StatusChip,
  dayMonth,
  timeAgo,
} from "../components";

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

  const checks: { label: string; todo: string; ok: boolean; fix: "email" | "password" | "2fa" }[] =
    [
      { label: "Email verified", todo: "Verify your email", ok: emailVerified, fix: "email" },
      {
        label: "Password set",
        todo: "Set a password",
        ok: Boolean(user.hasPassword),
        fix: "password",
      },
      { label: "Two-factor on", todo: "Turn on two-factor", ok: mfaEnabled, fix: "2fa" },
      {
        label: "Backup sign-in method",
        todo: "Add a backup sign-in method",
        ok: Boolean(user.hasPassword) && Boolean(user.googleConnected),
        fix: user.hasPassword ? "2fa" : "password",
      },
    ];
  const score = checks.filter((c) => c.ok).length;
  const firstFix = checks.find((c) => !c.ok);
  const ring = 2 * Math.PI * 27;

  return (
    <SettingsPanel>
      <PlainCard className="flex flex-wrap items-center gap-[22px] px-6 py-5">
        <svg width="60" height="60" viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
          <circle cx="32" cy="32" r="27" fill="none" strokeWidth="7" className="stroke-muted" />
          <circle
            cx="32"
            cy="32"
            r="27"
            fill="none"
            stroke="#03A14A"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${(score / checks.length) * ring} ${ring}`}
            transform="rotate(-90 32 32)"
          />
          <text
            x="32"
            y="37"
            textAnchor="middle"
            fontSize="16"
            fontWeight="700"
            className="fill-foreground font-display"
          >
            {score}/{checks.length}
          </text>
        </svg>
        <div className="flex min-w-0 flex-grow flex-col gap-2">
          <div className="font-display text-lg font-semibold text-foreground">Security checkup</div>
          <div className="flex flex-wrap gap-3.5 text-[13px] text-muted-foreground">
            {checks.map((c) =>
              c.ok ? (
                <span key={c.label} className="inline-flex items-center gap-1.5">
                  <Check className="size-3.5 text-[#03A14A]" strokeWidth={2.4} />
                  {c.label}
                </span>
              ) : (
                <span
                  key={c.label}
                  className="inline-flex items-center gap-1.5 text-[#8A5A00] dark:text-warning"
                >
                  <Info className="size-3.5" strokeWidth={2.2} />
                  {c.todo}
                </span>
              ),
            )}
          </div>
        </div>
        {firstFix && (
          <SettingsButton onClick={() => setDialog(firstFix.fix)}>
            <span>Fix now</span>
          </SettingsButton>
        )}
      </PlainCard>

      <SettingsCard
        title="Sign-in methods"
        description="Changing any of these asks you to confirm it's you first."
      >
        <ListRow
          icon={
            <IconTile tone="orange">
              <Mail />
            </IconTile>
          }
          title={
            <>
              Email address
              {emailVerified ? (
                <OkChip>Verified</OkChip>
              ) : (
                <StatusChip tone="warning">Not verified</StatusChip>
              )}
            </>
          }
          description={
            user.pendingEmail
              ? `Waiting for the code sent to ${user.pendingEmail}.`
              : `${user.email}. We send a code to the new address and a heads up to this one.`
          }
          actions={
            <SettingsButton onClick={() => setDialog("email")}>
              <span>{user.pendingEmail ? "Enter code" : "Change"}</span>
            </SettingsButton>
          }
        />
        <ListRow
          icon={
            <IconTile tone="brand">
              <KeyRound />
            </IconTile>
          }
          title="Password"
          description={
            user.hasPassword
              ? `Last changed ${timeAgo(user.passwordChangedAt)}. Changing it signs you out everywhere else.`
              : "You sign in with Google. Set a password as a backup."
          }
          actions={
            <SettingsButton onClick={() => setDialog("password")}>
              <span>{user.hasPassword ? "Change" : "Set a password"}</span>
            </SettingsButton>
          }
        />
        <ListRow
          icon={
            <IconTile tone="google">
              <GoogleLogo />
            </IconTile>
          }
          title={
            <>
              Google
              {user.googleConnected ? (
                <OkChip tick={false}>Connected</OkChip>
              ) : (
                <StatusChip tone="muted">Not connected</StatusChip>
              )}
            </>
          }
          description={
            user.googleConnected
              ? user.hasPassword
                ? "One-click sign in. You have a password too, so you can disconnect safely."
                : "Set a password before disconnecting, or you won't be able to sign in."
              : "Sign in with one click."
          }
          actions={
            <SettingsButton
              disabled={google.isPending || (user.googleConnected && !user.hasPassword)}
              onClick={() => google.mutate()}
            >
              {google.isPending && <Loader2 className="animate-spin" />}
              <span>{user.googleConnected ? "Disconnect" : "Connect"}</span>
            </SettingsButton>
          }
        />
      </SettingsCard>

      <SettingsCard
        title="Two-factor authentication"
        description="A second step at sign in, so a stolen password is not enough."
      >
        <ListRow
          icon={
            <IconTile tone="blue">
              <Smartphone />
            </IconTile>
          }
          title={<>Authenticator app{mfaEnabled && <OkChip>On</OkChip>}</>}
          description="Google Authenticator, 1Password, Authy and similar."
          actions={
            <SettingsButton onClick={() => setDialog("2fa")}>
              <span>{mfaEnabled ? "Manage" : "Turn on"}</span>
            </SettingsButton>
          }
        />
        <ListRow
          icon={
            <IconTile tone="blue">
              <Mail />
            </IconTile>
          }
          title={<>Email code{mfaEmailOtpEnabled && <OkChip>On</OkChip>}</>}
          description="A 6 digit code sent to your email at sign in."
          actions={
            <SettingsButton onClick={() => setDialog("2fa")}>
              <span>{mfaEmailOtpEnabled ? "Manage" : "Turn on"}</span>
            </SettingsButton>
          }
        />
        <ListRow
          icon={
            <IconTile tone="blue">
              <Sparkles />
            </IconTile>
          }
          title={
            <>
              SMS code<StatusChip tone="warning">Coming soon</StatusChip>
            </>
          }
          description="Text message codes to your phone."
        />
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
    </SettingsPanel>
  );
}

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.6 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z"
      />
      <path
        fill="#34A853"
        d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"
      />
      <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9z" />
      <path
        fill="#EA4335"
        d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"
      />
    </svg>
  );
}

function SessionsCard() {
  const queryClient = useQueryClient();
  const sessions = useQuery({ queryKey: ["account-sessions"], queryFn: accountApi.listSessions });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["account-sessions"] });

  const revokeOne = useMutation({
    mutationFn: accountApi.revokeSession,
    onSuccess: () => {
      toast.success("That device was signed out.");
      void invalidate();
    },
    onError: (e) => toast.error(getUserErrorMessage(e)),
  });
  const revokeOthers = useMutation({
    mutationFn: accountApi.revokeOtherSessions,
    onSuccess: (r) => {
      toast.success(`Signed out ${r.count} other device${r.count === 1 ? "" : "s"}.`);
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
          <SettingsButton
            variant="dangerOutline"
            disabled={revokeOthers.isPending}
            onClick={() => revokeOthers.mutate()}
          >
            {revokeOthers.isPending ? <Loader2 className="animate-spin" /> : <LogOut />}
            <span>Sign out all others</span>
          </SettingsButton>
        ) : undefined
      }
    >
      {sessions.isLoading && <CardNote>Loading sessions…</CardNote>}
      {sessions.error && <CardNote tone="danger">{getUserErrorMessage(sessions.error)}</CardNote>}
      {list.map((s) => {
        const Icon = s.deviceType === "mobile" || s.deviceType === "tablet" ? Smartphone : Monitor;
        return (
          <ListRow
            key={s.id}
            className={cn("py-[18px]", s.current && "bg-[#FFF8F5] dark:bg-primary-wash")}
            icon={
              <IconTile>
                <Icon />
              </IconTile>
            }
            title={s.device}
            description={
              <span className="flex flex-wrap gap-x-3.5 gap-y-1">
                {s.ipMasked && <span className="font-mono text-xs">{s.ipMasked}</span>}
                <span>Signed in {dayMonth(s.signedInAt)}</span>
                {s.current ? (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#03A14A]">
                    <span className="inline-block size-[7px] rounded-full bg-[#03A14A]" />
                    Active now
                  </span>
                ) : (
                  <span>Active {timeAgo(s.lastActiveAt)}</span>
                )}
              </span>
            }
            actions={
              s.current ? (
                <StatusChip tone="brand">This device</StatusChip>
              ) : (
                <SettingsButton
                  disabled={revokeOne.isPending}
                  onClick={() => revokeOne.mutate(s.id)}
                >
                  <LogOut />
                  <span>Sign out</span>
                </SettingsButton>
              )
            }
          />
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
