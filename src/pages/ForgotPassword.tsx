import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import {
  usePasswordForgotMutation,
  usePasswordResetMutation
} from "@/hooks/useAuth";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [expiresIn, setExpiresIn] = useState(0);

  const forgotMutation = usePasswordForgotMutation();
  const resetMutation = usePasswordResetMutation();

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

  const onRequestCode = async () => {
    const trimmed = email.trim();
    if (!/\S+@\S+\.\S+/.test(trimmed)) {
      return;
    }
    try {
      const result = await forgotMutation.mutateAsync({ email: trimmed });
      setResendIn(result.retryAfterSec);
      setExpiresIn(result.expiresInSec);
      setStep("reset");
      setOtp("");
      toast.success("Check your email", {
        message: "If an account exists for that address, we sent a 6-digit code. It expires in 5 minutes."
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not send reset code";
      toast.error("Request failed", { message: msg });
    }
  };

  const onResend = async () => {
    const trimmed = email.trim();
    try {
      const result = await forgotMutation.mutateAsync({ email: trimmed });
      setResendIn(result.retryAfterSec);
      setExpiresIn(result.expiresInSec);
      toast.success("Code sent", { message: "Check your inbox for a new code." });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not resend code";
      toast.error("Resend failed", { message: msg });
    }
  };

  const onReset = async () => {
    if (password.length < 8 || password !== confirm) {
      return;
    }
    try {
      await resetMutation.mutateAsync({
        email: email.trim(),
        code: otp.trim(),
        newPassword: password
      });
      toast.success("Password updated", {
        message: "You can sign in with your new password. Other sessions were signed out."
      });
      navigate("/login");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not update password";
      toast.error("Reset failed", { message: msg });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <ThemeToggle className="fixed top-4 right-4 p-2 rounded-lg border border-border bg-card/80 backdrop-blur hover:bg-card transition-colors z-20" />
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-2xl animate-fade-in">
        <div className="flex flex-col items-center mb-7">
          <Logo size="lg" />
          <p className="text-sm text-muted-foreground mt-3 text-center">
            {step === "email" ? "Enter your email to receive a reset code" : "Enter the code and your new password"}
          </p>
        </div>

        {step === "email" ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void onRequestCode();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="fp-email">Email</Label>
              <Input
                id="fp-email"
                type="email"
                autoComplete="email"
                placeholder="you@brand.com"
                required
                className="bg-input border-border"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {forgotMutation.error && (
              <p className="text-xs text-destructive">{forgotMutation.error.message}</p>
            )}
            <Button type="submit" className="w-full" disabled={forgotMutation.isPending}>
              {forgotMutation.isPending ? "Sending…" : "Send reset code"}
            </Button>
            <Button type="button" variant="ghost" className="w-full text-muted-foreground" asChild>
              <Link to="/login">Back to sign in</Link>
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Code sent to <span className="font-medium text-foreground">{email.trim()}</span>
            </div>
            <div className="space-y-2">
              <Label>Verification code</Label>
              <div className="flex justify-center w-full">
                <InputOTP maxLength={6} value={otp} onChange={(v) => setOtp(v.replace(/\D/g, ""))}>
                  <InputOTPGroup>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                {expiresIn > 0 && (
                  <p>
                    Code expires in about <span className="font-medium">{Math.max(1, Math.ceil(expiresIn / 60))}</span>{" "}
                    min.
                  </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={forgotMutation.isPending || resendIn > 0}
                  onClick={() => void onResend()}
                >
                  {forgotMutation.isPending ? "Sending…" : resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fp-np">New password</Label>
              <div className="relative">
                <Input
                  id="fp-np"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  className="bg-input border-border pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-muted-foreground hover:text-foreground"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fp-cp">Confirm password</Label>
              <Input
                id="fp-cp"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                className="bg-input border-border"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={8}
                placeholder="Repeat password"
              />
              {confirm.length > 0 && password !== confirm && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
            </div>
            {resetMutation.error && (
              <p className="text-xs text-destructive">{resetMutation.error.message}</p>
            )}
            {forgotMutation.error && (
              <p className="text-xs text-destructive">{forgotMutation.error.message}</p>
            )}
            <Button
              type="button"
              className="w-full"
              disabled={
                resetMutation.isPending || otp.length < 6 || password.length < 8 || password !== confirm
              }
              onClick={() => void onReset()}
            >
              {resetMutation.isPending ? "Updating…" : "Update password"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => {
                setStep("email");
                setOtp("");
                setPassword("");
                setConfirm("");
                forgotMutation.reset();
                resetMutation.reset();
              }}
            >
              Use a different email
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
