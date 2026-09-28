import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

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
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const finish = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOpen(false);
    setSecret("");
    setError(null);
    setCodeSent(false);
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm it's you</DialogTitle>
          <DialogDescription>
            {copy?.body ?? "Checking how you can confirm…"} You won't be asked again for the next 5
            minutes.
          </DialogDescription>
        </DialogHeader>

        {method && !needsCode && (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <Label htmlFor="reauth-secret">{copy!.label}</Label>
            <Input
              id="reauth-secret"
              autoFocus
              type={method === "password" ? "password" : "text"}
              inputMode={method === "password" ? undefined : "numeric"}
              autoComplete={method === "password" ? "current-password" : "one-time-code"}
              placeholder={copy!.placeholder}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
          </form>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => finish(false)} disabled={busy}>
            Cancel
          </Button>
          {needsCode ? (
            <Button onClick={() => void sendCode()} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Email me a code
            </Button>
          ) : (
            <Button onClick={() => void submit()} disabled={busy || !method || !secret.trim()}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continue
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
