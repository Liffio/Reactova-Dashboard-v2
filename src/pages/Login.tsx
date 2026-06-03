import { useEffect, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { GoogleIcon } from "@/components/auth/GoogleIcon";
import { AuthShell } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { useLoginMutation, useMfaLoginEmailSendMutation, useMfaLoginVerifyMutation } from "@/hooks/useAuth";
import { postAuthLandingPath, sanitizeAuthRedirect } from "@/lib/authNavigation";
import { API_BASE } from "@/lib/api";
import { store } from "@/store";

const toErrorText = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;
  return null;
};

export default function Login() {
  const [show, setShow] = useState(false);
  const [mfaPreAuthToken, setMfaPreAuthToken] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [mfaMethod, setMfaMethod] = useState<"authenticator" | "email">("authenticator");
  const [resendIn, setResendIn] = useState(0);
  const [expiresIn, setExpiresIn] = useState(0);
  const loginMutation = useLoginMutation();
  const mfaVerifyMutation = useMfaLoginVerifyMutation();
  const mfaEmailSendMutation = useMfaLoginEmailSendMutation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = sanitizeAuthRedirect(searchParams.get("redirect"));
  const registerTo =
    redirectTo !== "/dashboard"
      ? `/register?redirect=${encodeURIComponent(redirectTo)}`
      : "/register";

  const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: async ({ value }) => {
      const result = await loginMutation.mutateAsync(value);
      if ("mfaRequired" in result && result.mfaRequired) {
        setMfaPreAuthToken(result.preAuthToken);
        setMfaMethod(result.methods.includes("authenticator") ? "authenticator" : "email");
        setOtp("");
        setResendIn(0);
        setExpiresIn(0);
        return;
      }
      const { emailVerified, isOnboarded } = store.getState().auth;
      navigate(postAuthLandingPath({ emailVerified, isOnboarded }, redirectTo));
    }
  });

  const onVerifyMfa = async () => {
    if (!mfaPreAuthToken || otp.length < 6) return;
    await mfaVerifyMutation.mutateAsync({ preAuthToken: mfaPreAuthToken, code: otp.trim(), method: mfaMethod });
    const { emailVerified, isOnboarded } = store.getState().auth;
    navigate(postAuthLandingPath({ emailVerified, isOnboarded }, redirectTo));
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

  const googleUrl = `${API_BASE}/api/v1/auth/google?redirect=${encodeURIComponent(redirectTo)}&fe=${encodeURIComponent(window.location.origin)}`;

  return (
    <AuthShell variant="login" maxWidth="sm">
      <header className="auth-form-header mb-6 pb-5">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          {mfaPreAuthToken ? "Verify it's you" : "Welcome back"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {mfaPreAuthToken
            ? "Enter your authenticator or email code."
            : "Sign in to manage your Instagram automations."}
        </p>
      </header>

      {searchParams.get("error") && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {searchParams.get("error") === "google_denied"
            ? "Google sign in was cancelled."
            : "Google sign in failed. Please try again."}
        </div>
      )}

      {mfaPreAuthToken ? (
        <div className="space-y-4">
          <div className="inline-flex rounded-lg border border-border p-1">
            <button
              type="button"
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                mfaMethod === "authenticator" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setMfaMethod("authenticator")}
            >
              Authenticator
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                mfaMethod === "email" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setMfaMethod("email")}
            >
              Email OTP
            </button>
          </div>
          <div className="space-y-2">
            <Label>{mfaMethod === "email" ? "Email OTP (6 digits)" : "Authenticator code (6 digits)"}</Label>
            {mfaMethod === "email" && (
              <div className="text-xs text-muted-foreground space-y-1.5">
                <p>OTP expires 5 minutes after sending.</p>
                {expiresIn > 0 && (
                  <p>Current OTP expires in <span className="font-medium">{Math.ceil(expiresIn / 60)} min</span>.</p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={mfaEmailSendMutation.isPending || resendIn > 0}
                  onClick={() => void onSendEmailOtp()}
                >
                  {mfaEmailSendMutation.isPending ? "Sending…" : resendIn > 0 ? `Resend in ${resendIn}s` : "Send OTP"}
                </Button>
              </div>
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
          {/* Google Sign In */}
          <a
            href={googleUrl}
            className="auth-btn-google flex h-11 w-full items-center justify-center gap-2.5 rounded-xl px-4 text-sm font-medium text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <GoogleIcon />
            Continue with Google
          </a>

          <div className="auth-divider relative my-5">
            <div className="absolute inset-0 flex items-center">
              <span className="auth-divider-line w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="auth-glass-pill px-3 py-0.5 text-muted-foreground">or email</span>
            </div>
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void form.handleSubmit();
            }}
          >
            <form.Field
              name="email"
              validators={{ onChange: ({ value }) => /\S+@\S+\.\S+/.test(value) ? undefined : "Enter a valid email" }}
            >
              {(field) => {
                const err = toErrorText(field.state.meta.errors[0]);
                return (
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@brand.com"
                      required
                      autoComplete="email"
                      className="bg-input border-border"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    {err && <p className="text-xs text-destructive">{err}</p>}
                  </div>
                );
              }}
            </form.Field>

            <form.Field
              name="password"
              validators={{ onChange: ({ value }) => value.length >= 8 ? undefined : "Password must be at least 8 characters" }}
            >
              {(field) => {
                const err = toErrorText(field.state.meta.errors[0]);
                return (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-primary">
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
                        className="bg-input border-border pr-10"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShow((s) => !s)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-muted-foreground hover:text-foreground"
                      >
                        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {err && <p className="text-xs text-destructive">{err}</p>}
                  </div>
                );
              }}
            </form.Field>

            {loginMutation.error && (
              <p className="text-xs text-destructive">{loginMutation.error.message}</p>
            )}

            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </>
      )}

      <p className="auth-form-header mt-6 pt-5 text-center text-sm text-muted-foreground">
        New to Liffio?{" "}
        <Link to={registerTo} className="auth-ig-gradient-text font-semibold hover:opacity-90">
          Create free account
        </Link>
      </p>
    </AuthShell>
  );
}
