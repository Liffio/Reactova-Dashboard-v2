import { useEffect, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { useLoginMutation, useMfaLoginEmailSendMutation, useMfaLoginVerifyMutation } from "@/hooks/useAuth";

const toErrorText = (value: unknown): string | null => {
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Error) {
    return value.message;
  }
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
  const redirectTo = searchParams.get("redirect") ?? "/dashboard";

  const form = useForm({
    defaultValues: {
      email: "",
      password: ""
    },
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
      navigate(redirectTo);
    }
  });

  const onVerifyMfa = async () => {
    if (!mfaPreAuthToken || otp.length < 6) {
      return;
    }
    await mfaVerifyMutation.mutateAsync({
      preAuthToken: mfaPreAuthToken,
      code: otp.trim(),
      method: mfaMethod
    });
    navigate(redirectTo);
  };

  const onSendEmailOtp = async () => {
    if (!mfaPreAuthToken) {
      return;
    }
    const result = await mfaEmailSendMutation.mutateAsync({ preAuthToken: mfaPreAuthToken });
    setResendIn(result.retryAfterSec);
    setExpiresIn(result.expiresInSec);
  };

  useEffect(() => {
    if (resendIn <= 0) {
      return;
    }
    const id = window.setInterval(() => {
      setResendIn((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [resendIn]);

  useEffect(() => {
    if (expiresIn <= 0) {
      return;
    }
    const id = window.setInterval(() => {
      setExpiresIn((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [expiresIn]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <ThemeToggle className="fixed top-4 right-4 p-2 rounded-lg border border-border bg-card/80 backdrop-blur hover:bg-card transition-colors z-20" />
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-2xl animate-fade-in">
        <div className="flex flex-col items-center mb-7">
          <Logo size="lg" />
          <p className="text-sm text-muted-foreground mt-3">
            {mfaPreAuthToken
              ? "Choose authenticator or email OTP to continue"
              : "Sign in to your workspace"}
          </p>
        </div>

        {mfaPreAuthToken ? (
          <div className="space-y-4">
            <div className="inline-flex rounded-lg border border-border p-1">
              <button
                type="button"
                className={`px-3 py-1.5 text-xs rounded-md ${
                  mfaMethod === "authenticator" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
                onClick={() => setMfaMethod("authenticator")}
              >
                Authenticator
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 text-xs rounded-md ${
                  mfaMethod === "email" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
                onClick={() => setMfaMethod("email")}
              >
                Email OTP
              </button>
            </div>
            <div className="space-y-2">
              <Label>{mfaMethod === "email" ? "Email OTP (6 digits)" : "Authenticator code (6 digits)"}</Label>
              {mfaMethod === "email" && (
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>OTP expires in 5 minutes after sending.</p>
                  {expiresIn > 0 && (
                    <p>
                      Current OTP expires in <span className="font-medium">{Math.ceil(expiresIn / 60)} min</span>.
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={mfaEmailSendMutation.isPending || resendIn > 0}
                    onClick={() => void onSendEmailOtp()}
                  >
                    {mfaEmailSendMutation.isPending
                      ? "Sending..."
                      : resendIn > 0
                        ? `Resend in ${resendIn}s`
                        : "Send OTP"}
                  </Button>
                </div>
              )}
              <div className="flex items-center justify-center w-full">
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
              Back to password
            </Button>
          </div>
        ) : (
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
              validators={{
                onChange: ({ value }) =>
                  /\S+@\S+\.\S+/.test(value) ? undefined : "Enter a valid email"
              }}
            >
              {(field) => {
                const emailError = toErrorText(field.state.meta.errors[0]);
                return (
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@brand.com"
                      required
                      className="bg-input border-border"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    {emailError && <p className="text-xs text-destructive">{emailError}</p>}
                  </div>
                );
              }}
            </form.Field>

            <form.Field
              name="password"
              validators={{
                onChange: ({ value }) =>
                  value.length >= 8 ? undefined : "Password must be at least 8 characters"
              }}
            >
              {(field) => (
                <div className="space-y-1.5">
                  {(() => {
                    const passwordError = toErrorText(field.state.meta.errors[0]);
                    return (
                      <>
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={show ? "text" : "password"}
                      placeholder="••••••••"
                      required
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
                  {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
                      </>
                    );
                  })()}
                </div>
              )}
            </form.Field>

            {loginMutation.error && (
              <p className="text-xs text-destructive">{loginMutation.error.message}</p>
            )}

            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "Signing In..." : "Sign In"}
            </Button>

            <div className="text-right">
              <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-primary">
                Forgot password?
              </Link>
            </div>
          </form>
        )}

        <div className="my-6 h-px bg-border" />

        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link to="/register" className="text-primary font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
