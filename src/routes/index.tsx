import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useMounted } from "@/components/auth/guards";
import { postAuthLandingPath } from "@/lib/auth/auth-navigation";
import { useAuthState } from "@/lib/auth/auth-store";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Liffio — Creator OS" }] }),
  component: IndexRedirect,
});

/** `/` routes signed-in users to the app and everyone else to sign in. */
function IndexRedirect() {
  const navigate = useNavigate();
  const mounted = useMounted();
  const token = useAuthState((s) => s.accessToken);
  const emailVerified = useAuthState((s) => s.emailVerified);
  const isOnboarded = useAuthState((s) => s.isOnboarded);
  const user = useAuthState((s) => s.user);

  useEffect(() => {
    if (!mounted) return;
    if (!token) {
      void navigate({ to: "/login", replace: true });
      return;
    }
    // Wait for auth/me before deciding between confirm-email/onboarding/dashboard.
    if (!user) return;
    void navigate({ to: postAuthLandingPath({ emailVerified, isOnboarded }), replace: true });
  }, [mounted, token, user, emailVerified, isOnboarded, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
