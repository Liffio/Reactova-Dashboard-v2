import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth/auth-shell";
import { useMounted } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useEmailVerifyCodeMutation } from "@/hooks/use-auth";
import { resendEmailVerification } from "@/lib/api/auth-api";
import { sanitizeAuthRedirect } from "@/lib/auth/auth-navigation";
import { useAuthState } from "@/lib/auth/auth-store";

const PAID_PLANS = ["PRO", "BUSINESS", "AGENCY"];

type ConfirmEmailSearch = {
  redirect?: string;
};

export const Route = createFileRoute("/confirm-email")({
  validateSearch: (search: Record<string, unknown>): ConfirmEmailSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({ meta: [{ title: "Verify your email — Liffio" }] }),
  component: ConfirmEmailPage,
});

function ConfirmEmailPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const mounted = useMounted();
  const redirectTo = sanitizeAuthRedirect(search.redirect ?? null, "/onboarding");

  const accessToken = useAuthState((s) => s.accessToken);
  const user = useAuthState((s) => s.user);
  const emailVerified = useAuthState((s) => s.emailVerified);
  const isOnboarded = useAuthState((s) => s.isOnboarded);

  const [otp, setOtp] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const initialSendDone = useRef(false);

  const verifyMutation = useEmailVerifyCodeMutation();

  const resendMutation = useMutation({
    mutationFn: resendEmailVerification,
    onSuccess: (data: { ok?: boolean; emailVerified?: boolean }) => {
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
    },
  });

  useEffect(() => {
    if (mounted && !accessToken) {
      void navigate({
        to: "/login",
        search: redirectTo !== "/onboarding" ? { redirect: redirectTo } : {},
        replace: true,
      });
    }
  }, [mounted, accessToken, navigate, redirectTo]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const handleVerified = () => {
    const pendingPlan = localStorage.getItem("pending_plan");
    if (pendingPlan && PAID_PLANS.includes(pendingPlan)) {
      localStorage.removeItem("pending_plan");
      void navigate({ to: "/checkout", search: { plan: pendingPlan }, replace: true });
      return;
    }
    if (pendingPlan) localStorage.removeItem("pending_plan");
    void navigate({
      to: isOnboarded ? redirectTo || "/dashboard" : "/onboarding",
      replace: true,
    });
  };

  // If email becomes verified while we're here (e.g. auth-me corrects state), navigate away.
  useEffect(() => {
    if (emailVerified && accessToken) {
      handleVerified();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailVerified]);

  useEffect(() => {
    if (!mounted || !accessToken || emailVerified || initialSendDone.current) return;
    initialSendDone.current = true;
    resendMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, accessToken, emailVerified]);

  useEffect(() => {
    if (otp.length !== 6) return;
    verifyMutation.mutate(otp, {
      onSuccess: () => handleVerified(),
      onError: (err) => {
        toast.error((err as Error).message);
        setOtp("");
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  if (!mounted || !accessToken) return null;

  return (
    <AuthShell maxWidth="sm">
      <header className="mb-6 border-b pb-5">
        <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent">
          <Mail className="h-5 w-5 text-accent-foreground" />
        </div>
        <h1 className="font-display text-xl font-semibold tracking-tight">Verify your email</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Code sent to{" "}
          <span className="font-semibold text-foreground">{user?.email ?? "your inbox"}</span>
        </p>
      </header>

      <div className="mb-5 flex justify-center">
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
        <p className="mb-4 text-center text-[13px] text-muted-foreground">Verifying…</p>
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
          className="h-10 w-full"
          disabled={resendMutation.isPending || resendIn > 0}
          onClick={() => {
            setOtp("");
            resendMutation.mutate();
          }}
        >
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          {resendIn > 0
            ? `Resend in ${resendIn}s`
            : resendMutation.isPending
              ? "Sending…"
              : "Resend code"}
        </Button>
        <p className="text-center text-[13px] text-muted-foreground">
          Wrong address?{" "}
          <Link to="/login" className="font-semibold text-brand-gradient hover:opacity-90">
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
