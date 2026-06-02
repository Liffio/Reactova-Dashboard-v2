import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Mail, RefreshCw } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { apiRequest } from "@/lib/api";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { setAuthMe } from "@/store/authSlice";
import type { AuthMePayload } from "@/types/auth";
import { toast } from "@/components/ui/sonner";
import { loginPathWithRedirect, sanitizeAuthRedirect } from "@/lib/authNavigation";
import { useEmailVerifyCodeMutation } from "@/hooks/useAuth";

const PAID_PLANS = ["PRO", "BUSINESS", "AGENCY"];

export default function ConfirmEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = sanitizeAuthRedirect(searchParams.get("redirect"), "/onboarding");
  const dispatch = useAppDispatch();
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const user = useAppSelector((state) => state.auth.user);
  const emailVerified = useAppSelector((state) => state.auth.emailVerified);
  const isOnboarded = useAppSelector((state) => state.auth.isOnboarded);

  const [otp, setOtp] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const initialSendDone = useRef(false);

  const verifyMutation = useEmailVerifyCodeMutation();

  const resendMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ ok: boolean; emailVerified?: boolean; retryAfterSec?: number }>(
        "/api/v1/auth/email-verification/resend",
        { method: "POST" }
      ),
    onSuccess: (data) => {
      if (data.emailVerified) {
        handleVerified();
        return;
      }
      setDeliveryError(null);
      setResendIn(60);
      toast.success("New code sent — check your inbox");
    },
    onError: (error) => {
      const message = (error as Error).message;
      setDeliveryError(message);
      const match = message.match(/(\d+)\s*seconds?/i);
      if (match) setResendIn(Number(match[1]));
    }
  });

  useEffect(() => {
    if (!accessToken) {
      const loginTo = redirectTo !== "/onboarding" ? loginPathWithRedirect(redirectTo) : "/login";
      navigate(loginTo, { replace: true });
    }
  }, [accessToken, navigate, redirectTo]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  useEffect(() => {
    if (!accessToken || emailVerified || initialSendDone.current) return;
    initialSendDone.current = true;
    resendMutation.mutate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, emailVerified]);

  const handleVerified = () => {
    // Check for a pending paid plan from registration
    const pendingPlan = localStorage.getItem("pending_plan");
    if (pendingPlan && PAID_PLANS.includes(pendingPlan)) {
      localStorage.removeItem("pending_plan");
      navigate(`/checkout?plan=${pendingPlan}`, { replace: true });
      return;
    }
    if (pendingPlan) localStorage.removeItem("pending_plan");
    navigate(isOnboarded ? (redirectTo || "/dashboard") : "/onboarding", { replace: true });
  };

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (otp.length !== 6) return;
    verifyMutation.mutate(otp, {
      onSuccess: () => handleVerified(),
      onError: (err) => {
        toast.error((err as Error).message);
        setOtp("");
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  if (!accessToken) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <ThemeToggle className="fixed top-4 right-4 p-2 rounded-lg border border-border bg-card/80 backdrop-blur hover:bg-card transition-colors z-20" />
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-2xl animate-in fade-in duration-300">
        <div className="flex flex-col items-center mb-6 text-center">
          <Logo size="lg" />
          <div className="mt-5 h-12 w-12 rounded-full bg-primary/15 flex items-center justify-center">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold mt-4">Check your email</h1>
          <p className="text-sm text-muted-foreground mt-2">
            We sent a 6-digit code to{" "}
            <span className="font-semibold text-foreground">{user?.email ?? "your email"}</span>.
            Enter it below — you can copy it from any device.
          </p>
        </div>

        <div className="flex justify-center mb-6">
          <InputOTP
            maxLength={6}
            value={otp}
            onChange={(v) => setOtp(v.replace(/\D/g, ""))}
            disabled={verifyMutation.isPending}
          >
            <InputOTPGroup>
              {Array.from({ length: 6 }).map((_, i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        {verifyMutation.isPending && (
          <p className="text-center text-sm text-muted-foreground mb-4">Verifying…</p>
        )}

        {deliveryError && (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {deliveryError}
          </div>
        )}

        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={resendMutation.isPending || resendIn > 0}
            onClick={() => { setOtp(""); resendMutation.mutate(); }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {resendIn > 0 ? `Resend in ${resendIn}s` : resendMutation.isPending ? "Sending…" : "Resend code"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Wrong address?{" "}
            <Link to="/login" className="text-primary hover:underline">
              Sign in with a different account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
