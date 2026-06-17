import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";

import { AuthShell } from "@/components/auth/auth-shell";
import { GoogleIcon } from "@/components/auth/google-icon";
import { useMounted } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import {
  useLoginMutation,
  useMfaLoginEmailSendMutation,
  useMfaLoginVerifyMutation,
} from "@/hooks/use-auth";
import { googleAuthUrl } from "@/lib/api/auth-api";
import { postAuthLandingPath, sanitizeAuthRedirect } from "@/lib/auth/auth-navigation";
import { authStore } from "@/lib/auth/auth-store";

type LoginSearch = {
  redirect?: string;
  error?: string;
};

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  head: () => ({ meta: [{ title: "Sign in — Liffio" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const mounted = useMounted();
  const redirectTo = sanitizeAuthRedirect(search.redirect ?? null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [mfaPreAuthToken, setMfaPreAuthToken] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [mfaMethod, setMfaMethod] = useState<"authenticator" | "email">("authenticator");
  const [resendIn, setResendIn] = useState(0);
  const [expiresIn, setExpiresIn] = useState(0);

  const loginMutation = useLoginMutation();
  const mfaVerifyMutation = useMfaLoginVerifyMutation();
  const mfaEmailSendMutation = useMfaLoginEmailSendMutation();

  const navigatePostAuth = () => {
    const { emailVerified, isOnboarded } = authStore.getState();
    void navigate({ to: postAuthLandingPath({ emailVerified, isOnboarded }, redirectTo) });
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await loginMutation.mutateAsync({ email, password });
    if ("mfaRequired" in result && result.mfaRequired) {
      setMfaPreAuthToken(result.preAuthToken);
      setMfaMethod(result.methods.includes("authenticator") ? "authenticator" : "email");
      setOtp("");
      setResendIn(0);
      setExpiresIn(0);
      return;
    }
    navigatePostAuth();
  };

  const onVerifyMfa = async () => {
    if (!mfaPreAuthToken || otp.length < 6) return;
    await mfaVerifyMutation.mutateAsync({
      preAuthToken: mfaPreAuthToken,
      code: otp.trim(),
      method: mfaMethod,
    });
    navigatePostAuth();
  };

  const onSendEmailOtp = async () => {
    if (!mfaPreAuthToken) return;
    const result = await mfaEmailSendMutation.mutateAsync({ preAuthToken: mfaPreAuthToken });
    setResendIn(result.retryAfterSec);
    setExpiresIn(result.expiresInSec);
  };

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = window.setInterval(() => setResendIn((p) => (p > 0 ? p - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [resendIn]);

  useEffect(() => {
    if (expiresIn <= 0) return;
    const id = window.setInterval(() => setExpiresIn((p) => (p > 0 ? p - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [expiresIn]);

  const googleUrl = mounted ? googleAuthUrl(redirectTo, window.location.origin) : "#";

  return (
    <AuthShell maxWidth="sm">
      <header className="mb-6 border-b pb-5">
        <h1 className="font-display text-xl font-semibold tracking-tight">
          {mfaPreAuthToken ? "Verify it's you" : "Welcome back"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {mfaPreAuthToken
            ? "Enter your authenticator or email code."
            : "Sign in to manage your Instagram automations."}
        </p>
      </header>

      {search.error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {search.error === "google_denied"
            ? "Google sign in was cancelled."
            : "Google sign in failed. Please try again."}
        </div>
      )}

      {mfaPreAuthToken ? (
        <div className="space-y-4">
          <div className="inline-flex rounded-lg border p-1">
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                mfaMethod === "authenticator"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setMfaMethod("authenticator")}
            >
              Authenticator
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                mfaMethod === "email"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setMfaMethod("email")}
            >
              Email OTP
            </button>
          </div>
          <div className="space-y-2">
            <Label>
              {mfaMethod === "email" ? "Email OTP (6 digits)" : "Authenticator code (6 digits)"}
            </Label>
            {mfaMethod === "email" && (
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <p>OTP expires 5 minutes after sending.</p>
                {expiresIn > 0 && (
                  <p>
                    Current OTP expires in{" "}
                    <span className="font-medium">{Math.ceil(expiresIn / 60)} min</span>.
                  </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={mfaEmailSendMutation.isPending || resendIn > 0}
                  onClick={() => void onSendEmailOtp()}
                >
                  {mfaEmailSendMutation.isPending
                    ? "Sending…"
                    : resendIn > 0
                      ? `Resend in ${resendIn}s`
                      : "Send OTP"}
                </Button>
              </div>
            )}
            <div className="flex w-full items-center justify-center pt-1">
              <InputOTP maxLength={6} value={otp} onChange={(v) => setOtp(v.replace(/\D/g, ""))}>
                <InputOTPGroup>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>
          {(mfaVerifyMutation.error || loginMutation.error || mfaEmailSendMutation.error) && (
            <p className="text-xs text-destructive">
              {(mfaVerifyMutation.error ?? mfaEmailSendMutation.error ?? loginMutation.error)?.message}
            </p>
          )}
          <Button
            type="button"
            className="w-full"
            disabled={mfaVerifyMutation.isPending || otp.length < 6}
            onClick={() => void onVerifyMfa()}
          >
            {mfaVerifyMutation.isPending ? "Verifying…" : "Verify and sign in"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={() => {
              setMfaPreAuthToken(null);
              setOtp("");
              setResendIn(0);
              setExpiresIn(0);
              mfaVerifyMutation.reset();
              mfaEmailSendMutation.reset();
            }}
          >
            Back to sign in
          </Button>
        </div>
      ) : (
        <>
          <a
            href={googleUrl}
            className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <GoogleIcon />
            Continue with Google
          </a>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="rounded-full bg-card px-3 py-0.5 text-muted-foreground">
                or email
              </span>
            </div>
          </div>

          <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@brand.com"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-muted-foreground hover:text-primary"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={show ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:text-foreground"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {loginMutation.error && (
              <p className="text-xs text-destructive">{loginMutation.error.message}</p>
            )}

            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </>
      )}

      <p className="mt-6 border-t pt-5 text-center text-sm text-muted-foreground">
        New to Liffio?{" "}
        <Link
          to="/register"
          search={redirectTo !== "/dashboard" ? { redirect: redirectTo } : {}}
          className="font-semibold text-brand-gradient hover:opacity-90"
        >
          Create free account
        </Link>
      </p>
    </AuthShell>
  );
}
