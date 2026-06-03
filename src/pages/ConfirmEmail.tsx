import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Mail, RefreshCw } from "lucide-react";
import { AuthShell } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { apiRequest } from "@/lib/api";
import { useAppSelector } from "@/store/hooks";
import { toast } from "@/components/ui/sonner";
import { loginPathWithRedirect, sanitizeAuthRedirect } from "@/lib/authNavigation";
import { useEmailVerifyCodeMutation } from "@/hooks/useAuth";

const PAID_PLANS = ["PRO", "BUSINESS", "AGENCY"];

export default function ConfirmEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = sanitizeAuthRedirect(searchParams.get("redirect"), "/onboarding");
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
    const pendingPlan = localStorage.getItem("pending_plan");
    if (pendingPlan && PAID_PLANS.includes(pendingPlan)) {
      localStorage.removeItem("pending_plan");
      navigate(`/checkout?plan=${pendingPlan}`, { replace: true });
      return;
    }
    if (pendingPlan) localStorage.removeItem("pending_plan");
    navigate(isOnboarded ? (redirectTo || "/dashboard") : "/onboarding", { replace: true });
  };

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
    <AuthShell variant="confirm-email" maxWidth="sm">
      <header className="auth-form-header mb-6 pb-5">
        <div className="auth-ig-ring mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full p-[2px]">
          <span className="flex h-full w-full items-center justify-center rounded-full auth-glass-inner">
            <Mail className="h-5 w-5 text-primary" />
          </span>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Verify your email</h1>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
          Code sent to{" "}
          <span className="font-semibold text-foreground">{user?.email ?? "your inbox"}</span>
        </p>
      </header>

      <div className="flex justify-center mb-5">
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
        <p className="text-center text-[13px] text-muted-foreground mb-4">Verifying…</p>
      )}

      {deliveryError && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-[13px] text-destructive">
          {deliveryError}
        </div>
      )}

      <div className="space-y-3">
        <Button
          type="button"
          variant="outline"
          className="w-full h-10"
          disabled={resendMutation.isPending || resendIn > 0}
          onClick={() => {
            setOtp("");
            resendMutation.mutate();
          }}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-2" />
          {resendIn > 0 ? `Resend in ${resendIn}s` : resendMutation.isPending ? "Sending…" : "Resend code"}
        </Button>
        <p className="text-center text-[13px] text-muted-foreground">
          Wrong address?{" "}
          <Link to="/login" className="auth-ig-gradient-text font-semibold hover:opacity-90">
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
