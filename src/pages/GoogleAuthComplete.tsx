import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAppDispatch } from "@/store/hooks";
import { setAuthSession, setAuthMe } from "@/store/authSlice";
import { apiRequest } from "@/lib/api";
import { postAuthLandingPath, sanitizeAuthRedirect } from "@/lib/authNavigation";
import { store } from "@/store";
import type { AuthMePayload } from "@/types/auth";

export default function GoogleAuthComplete() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  useEffect(() => {
    const token = searchParams.get("token");
    const redirectParam = searchParams.get("redirect");
    const redirectTo = redirectParam ? sanitizeAuthRedirect(redirectParam) : "/dashboard";

    if (!token) {
      navigate("/login?error=google_failed", { replace: true });
      return;
    }

    const finish = async () => {
      dispatch(setAuthSession({ accessToken: token }));
      const authMe = await apiRequest<AuthMePayload>("/api/v1/auth/me", { token });
      dispatch(setAuthMe(authMe));
      const { emailVerified, isOnboarded } = store.getState().auth;
      navigate(postAuthLandingPath({ emailVerified, isOnboarded }, redirectTo), { replace: true });
    };

    finish().catch(() => navigate("/login?error=google_failed", { replace: true }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background text-foreground p-6">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">Completing sign in with Google…</p>
    </div>
  );
}
