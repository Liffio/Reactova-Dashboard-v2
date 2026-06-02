import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, RefreshCw } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { useAppSelector } from "@/store/hooks";
import { useAppDispatch } from "@/store/hooks";
import { setAuthMe } from "@/store/authSlice";
import type { AuthMePayload } from "@/types/auth";
import { toast } from "@/components/ui/sonner";
import { loginPathWithRedirect, postAuthLandingPath, sanitizeAuthRedirect } from "@/lib/authNavigation";

export default function ConfirmEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = sanitizeAuthRedirect(searchParams.get("redirect"), "/onboarding");
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const user = useAppSelector((state) => state.auth.user);
  const emailVerified = useAppSelector((state) => state.auth.emailVerified);
  const isOnboarded = useAppSelector((state) => state.auth.isOnboarded);
  const [resendIn, setResendIn] = useState(0);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const initialSendDone = useRef(false);

  const authMeQuery = useQuery({
    queryKey: ["auth-me", "confirm-email", accessToken],
    queryFn: () => apiRequest<AuthMePayload>("/api/v1/auth/me"),
    enabled: Boolean(accessToken),
    refetchInterval: emailVerified ? false : 3000,
    staleTime: 0
  });

  useEffect(() => {
    if (authMeQuery.data) {
      dispatch(setAuthMe(authMeQuery.data));
    }
  }, [authMeQuery.data, dispatch]);

  useEffect(() => {
    if (!accessToken) {
      const loginTo =
        redirectTo !== "/onboarding" ? loginPathWithRedirect(redirectTo) : "/login";
      navigate(loginTo, { replace: true });
      return;
    }
    if (emailVerified) {
      navigate(postAuthLandingPath({ emailVerified: true, isOnboarded }, redirectTo), {
        replace: true
      });
    }
  }, [accessToken, emailVerified, isOnboarded, navigate, redirectTo]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const resendMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ ok: boolean; emailVerified?: boolean; retryAfterSec?: number }>(
        "/api/v1/auth/email-verification/resend",
        { method: "POST" }
      ),
    onSuccess: async (data) => {
      if (data.emailVerified) {
        await queryClient.invalidateQueries({ queryKey: ["auth-me"] });
        return;
      }
      setDeliveryError(null);
      setResendIn(60);
      toast.success("Confirmation email sent");
    },
    onError: (error) => {
      const message = (error as Error).message;
      setDeliveryError(message);
      const match = message.match(/(\d+)\s*seconds?/i);
      if (match) setResendIn(Number(match[1]));
      toast.error(message);
    }
  });

  useEffect(() => {
    if (!accessToken || emailVerified || initialSendDone.current) {
      return;
    }
    initialSendDone.current = true;
    resendMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- send once when landing on this page
  }, [accessToken, emailVerified]);

  if (!accessToken) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <ThemeToggle className="fixed top-4 right-4 p-2 rounded-lg border border-border bg-card/80 backdrop-blur hover:bg-card transition-colors z-20" />
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-2xl animate-fade-in">
        <div className="flex flex-col items-center mb-6 text-center">
          <Logo size="lg" />
          <div className="mt-4 h-12 w-12 rounded-full bg-primary/15 flex items-center justify-center">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold mt-4">Confirm your email</h1>
          <p className="text-sm text-muted-foreground mt-2">
            We sent a confirmation link to{" "}
            <span className="font-medium text-foreground">{user?.email ?? "your email"}</span>.
            Open it on any device — your account will activate automatically.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-background/60 p-4 text-sm text-muted-foreground space-y-2">
          <p>After you click the link, you can close that tab and return here.</p>
          <p>This page updates as soon as your email is verified (no refresh needed).</p>
        </div>

        {deliveryError && (
          <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {deliveryError}
          </div>
        )}

        <div className="mt-6 space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={resendMutation.isPending || resendIn > 0}
            onClick={() => resendMutation.mutate()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {resendIn > 0 ? `Resend in ${resendIn}s` : resendMutation.isPending ? "Sending…" : "Resend confirmation email"}
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
