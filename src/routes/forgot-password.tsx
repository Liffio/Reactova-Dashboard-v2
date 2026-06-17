import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, KeyRound, Mail } from "lucide-react";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { usePasswordForgotMutation, usePasswordResetMutation } from "@/hooks/use-auth";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Reset password — Liffio" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [cpw, setCpw] = useState("");
  const [show, setShow] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const forgotMutation = usePasswordForgotMutation();
  const resetMutation = usePasswordResetMutation();

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = window.setInterval(() => setResendIn((p) => (p > 0 ? p - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [resendIn]);

  const sendCode = async () => {
    const result = await forgotMutation.mutateAsync({ email });
    setResendIn(result.retryAfterSec);
    setStep("reset");
    toast.success("If that email exists, a reset code is on its way");
  };

  const onReset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pw !== cpw || pw.length < 8 || code.length !== 6) return;
    await resetMutation.mutateAsync({ email, code, newPassword: pw });
    toast.success("Password updated — sign in with your new password");
    void navigate({ to: "/login" });
  };

  return (
    <AuthShell maxWidth="sm">
      <header className="mb-6 border-b pb-5">
        <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent">
          {step === "email" ? (
            <Mail className="h-5 w-5 text-accent-foreground" />
          ) : (
            <KeyRound className="h-5 w-5 text-accent-foreground" />
          )}
        </div>
        <h1 className="font-display text-xl font-semibold tracking-tight">
          {step === "email" ? "Reset your password" : "Enter the code"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {step === "email"
            ? "We'll email you a 6-digit code to reset your password."
            : `Code sent to ${email}. It expires in 5 minutes.`}
        </p>
      </header>

      {step === "email" ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void sendCode();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@brand.com"
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
        </form>
      ) : (
        <form className="space-y-4" onSubmit={(e) => void onReset(e)}>
          <div className="space-y-2">
            <Label>Reset code</Label>
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={code} onChange={(v) => setCode(v.replace(/\D/g, ""))}>
                <InputOTPGroup>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <div className="text-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                disabled={forgotMutation.isPending || resendIn > 0}
                onClick={() => void sendCode()}
              >
                {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pw">New password</Label>
            <div className="relative">
              <Input
                id="pw"
                type={show ? "text" : "password"}
                required
                autoComplete="new-password"
                className="pr-10"
                placeholder="At least 8 characters"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:text-foreground"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cpw">Confirm new password</Label>
            <Input
              id="cpw"
              type={show ? "text" : "password"}
              required
              autoComplete="new-password"
              value={cpw}
              onChange={(e) => setCpw(e.target.value)}
            />
            {pw !== cpw && cpw.length > 0 && (
              <p className="text-xs text-destructive">Passwords do not match</p>
            )}
          </div>

          {resetMutation.error && (
            <p className="text-xs text-destructive">{resetMutation.error.message}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={resetMutation.isPending || pw !== cpw || pw.length < 8 || code.length !== 6}
          >
            {resetMutation.isPending ? "Resetting…" : "Reset password"}
          </Button>
        </form>
      )}

      <p className="mt-6 border-t pt-5 text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link to="/login" className="font-semibold text-brand-gradient hover:opacity-90">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
