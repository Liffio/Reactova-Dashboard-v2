/**
 * Local login form rendered on app.liffio.com itself. This is a fallback:
 * the normal flow bounces unauthenticated users to liffio.com/login, but if
 * that redirect can't complete (liffio.com unreachable, blocked, etc.) this
 * lets people still sign in without leaving app.liffio.com.
 */
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import {
  useLoginMutation,
  useMfaLoginEmailSendMutation,
  useMfaLoginVerifyMutation,
} from "@/hooks/use-auth";
import { API_BASE, ApiError } from "@/lib/api/http";
import { apiUri } from "@/lib/api/apiUri";
import { postAuthLandingPath, sanitizeAuthRedirect } from "@/lib/auth/auth-navigation";
import { authStore } from "@/lib/auth/auth-store";

/** Strips technical detail so a network hiccup never reads as a stack trace to the user. */
function friendlyErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return "Something went wrong signing you in. Please try again.";
}

export function LocalLoginForm({
  redirectTo,
  initialError,
}: {
  redirectTo: string;
  initialError?: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mfaPreAuthToken, setMfaPreAuthToken] = useState<string | null>(null);
  const [mfaMethod, setMfaMethod] = useState<"authenticator" | "email">("authenticator");
  const [otp, setOtp] = useState("");
  const [resendIn, setResendIn] = useState(0);

  const loginMutation = useLoginMutation();
  const mfaVerifyMutation = useMfaLoginVerifyMutation();
  const mfaEmailSendMutation = useMfaLoginEmailSendMutation();

  const target = sanitizeAuthRedirect(redirectTo);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = window.setInterval(() => setResendIn((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [resendIn]);

  const goToApp = () => {
    const { emailVerified, isOnboarded } = authStore.getState();
    window.location.href = postAuthLandingPath({ emailVerified, isOnboarded }, target);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await loginMutation.mutateAsync({ email, password }).catch(() => null);
    if (!result) return;
    if ("mfaRequired" in result && result.mfaRequired) {
      setMfaPreAuthToken(result.preAuthToken);
      setMfaMethod(result.methods.includes("authenticator") ? "authenticator" : "email");
      setOtp("");
      setResendIn(0);
      return;
    }
    goToApp();
  };

  const onVerifyMfa = async () => {
    if (!mfaPreAuthToken || otp.length < 6) return;
    const ok = await mfaVerifyMutation
      .mutateAsync({ preAuthToken: mfaPreAuthToken, code: otp.trim(), method: mfaMethod })
      .catch(() => null);
    if (ok) goToApp();
  };

  const onSendEmailOtp = async () => {
    if (!mfaPreAuthToken) return;
    const result = await mfaEmailSendMutation
      .mutateAsync({ preAuthToken: mfaPreAuthToken })
      .catch(() => null);
    if (result) setResendIn(result.retryAfterSec);
  };

  const googleUrl = `${API_BASE}${apiUri.auth.google}?redirect=${encodeURIComponent(target)}&fe=${encodeURIComponent(
    typeof window !== "undefined" ? window.location.origin : "",
  )}`;

  const activeError =
    mfaVerifyMutation.error ?? mfaEmailSendMutation.error ?? loginMutation.error ?? null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {mfaPreAuthToken ? "Verify it's you" : "Sign in to Liffio"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mfaPreAuthToken
              ? "Enter your authenticator or email code."
              : "Manage your Instagram automations."}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {initialError && !activeError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {initialError === "google_denied"
                ? "Google sign in was cancelled."
                : "Sign in failed. Please try again."}
            </div>
          )}

          {mfaPreAuthToken ? (
            <div className="space-y-4">
              <div className="inline-flex rounded-lg border border-border p-1">
                <button
                  type="button"
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
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
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                    mfaMethod === "email"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setMfaMethod("email")}
                >
                  Email OTP
                </button>
              </div>

              {mfaMethod === "email" && (
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
              )}

              <div className="flex items-center justify-center w-full pt-1">
                <InputOTP maxLength={6} value={otp} onChange={(v) => setOtp(v.replace(/\D/g, ""))}>
                  <InputOTPGroup>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {activeError && (
                <p className="text-xs text-destructive">{friendlyErrorMessage(activeError)}</p>
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
                className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-input bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Continue with Google
              </a>

              <div className="relative my-1 text-center text-xs text-muted-foreground">
                <span className="bg-card px-2">or email</span>
              </div>

              <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
                <div className="space-y-1.5">
                  <Label htmlFor="local-login-email">Email address</Label>
                  <Input
                    id="local-login-email"
                    type="email"
                    placeholder="you@brand.com"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="local-login-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="local-login-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                      className="pr-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {activeError && (
                  <p className="text-xs text-destructive">{friendlyErrorMessage(activeError)}</p>
                )}

                <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                  {loginMutation.isPending ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
