import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Lock } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { accountApi, type ReauthMethod } from "@/lib/api/account-api";
import { registerReauthPrompt, setReauthToken } from "@/lib/auth/reauth";
import { getUserErrorMessage } from "@/lib/user-facing-error";

const COPY: Record<ReauthMethod, { body: string; label: string; placeholder: string }> = {
  password: {
    body: "Enter your password to continue.",
    label: "Password",
    placeholder: "Your password",
  },
  mfa: {
    body: "Enter the 6-digit code from your authenticator app.",
    label: "Authenticator code",
    placeholder: "123456",
  },
  email: {
    body: "We'll email a 6-digit code to your current address.",
    label: "Email code",
    placeholder: "123456",
  },
};

/**
 * "Confirm it's you" (plan/settings-revamp.md, spec §4). Mounted ONCE in the app shell; it
 * registers itself as the global reauth prompt, so any call answered `403 REAUTH_REQUIRED` opens
 * it and is retried after a successful confirm (see `lib/auth/reauth.ts` + `apiRequest`).
 *
 * The method comes from the server (`GET /auth/me/reauth`) — strongest the user has.
 */
export function ReauthDialog() {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<ReauthMethod | null>(null);
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [reveal, setReveal] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const finish = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOpen(false);
    setSecret("");
    setError(null);
    setCodeSent(false);
    setReveal(false);
  }, []);

  useEffect(
    () =>
      registerReauthPrompt(
        () =>
          new Promise<boolean>((resolve) => {
            resolver.current = resolve;
            setMethod(null);
            setOpen(true);
            accountApi
              .getReauthMethod()
              .then((r) => setMethod(r.method))
              .catch((e) => setError(getUserErrorMessage(e)));
          }),
      ),
    [],
  );

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    try {
      await accountApi.sendReauthEmailCode();
      setCodeSent(true);
    } catch (e) {
      setError(getUserErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!method || !secret.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const out = await accountApi.reauth(
        method === "password" ? { method, password: secret } : { method, code: secret.trim() },
      );
      setReauthToken(out.reauthToken, out.expiresInSec);
      finish(true);
    } catch (e) {
      setError(getUserErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = method ? COPY[method] : null;
  const needsCode = method === "email" && !codeSent;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && finish(false)}>
      <DialogContent className="max-w-[calc(100%-32px)] gap-0 overflow-hidden rounded-[20px] border-0 p-0 shadow-[0_30px_80px_-20px_rgba(22,10,8,0.5)] sm:max-w-[460px]">
        <div className="h-1.5 bg-brand-gradient" />
        <div className="flex flex-col gap-[22px] px-8 pb-7 pt-8">
          <span className="flex size-[52px] items-center justify-center rounded-[16px] bg-[#FFE4EA] text-[#B80D38] dark:bg-primary-wash dark:text-primary">
            <Lock className="size-6" strokeWidth={2} />
          </span>
          <DialogHeader className="gap-2 text-left">
            <DialogTitle className="font-display text-2xl font-bold tracking-[-0.02em]">
              Confirm it's you
            </DialogTitle>
            <DialogDescription className="text-sm leading-[1.55] text-muted-foreground">
              {copy?.body ?? "Checking how you can confirm…"} You won't be asked again for the next
              5 minutes.
            </DialogDescription>
          </DialogHeader>

          {method && !needsCode && (
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <label htmlFor="reauth-secret" className="text-[13px] font-semibold text-foreground">
                {copy!.label}
              </label>
              <div className="flex items-center overflow-hidden rounded-[10px] border border-border bg-card focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-[#F5184C]">
                <input
                  id="reauth-secret"
                  name={method === "password" ? "password" : "one-time-code"}
                  autoFocus
                  type={method === "password" && !reveal ? "password" : "text"}
                  inputMode={method === "password" ? undefined : "numeric"}
                  autoComplete={method === "password" ? "current-password" : "one-time-code"}
                  placeholder={copy!.placeholder}
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  className="h-[42px] min-w-0 flex-grow border-0 bg-transparent px-3 text-sm text-foreground outline-none"
                />
                {method === "password" && (
                  <button
                    type="button"
                    onClick={() => setReveal((r) => !r)}
                    className="cursor-pointer border-0 bg-transparent pr-3 text-[13px] font-semibold text-[#C20F3B] dark:text-primary"
                  >
                    {reveal ? "Hide" : "Show"}
                  </button>
                )}
              </div>
            </form>
          )}
          {error && <p className="m-0 text-sm text-destructive">{error}</p>}

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => finish(false)}
              disabled={busy}
              className="h-11 flex-grow cursor-pointer rounded-[10px] border border-border bg-card text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-45"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void (needsCode ? sendCode() : submit())}
              disabled={busy || (!needsCode && (!method || !secret.trim()))}
              className="inline-flex h-11 flex-grow cursor-pointer items-center justify-center gap-2 rounded-[10px] border-0 bg-[#E8103F] text-sm font-semibold text-white hover:bg-[#C20F3B] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {needsCode ? "Email me a code" : "Continue"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
