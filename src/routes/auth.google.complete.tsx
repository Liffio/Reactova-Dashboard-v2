/**
 * Google OAuth callback handler.
 * When the Google OAuth flow is initiated from liffio.com, the backend redirects
 * to liffio.com/auth/google/complete. This route handles the rare case where
 * the OAuth was initiated directly from app.liffio.com (e.g., deep link).
 */
import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { getAuthMe } from "@/lib/api/auth-api";
import { sanitizeAuthRedirect } from "@/lib/auth/auth-navigation";
import { authStore } from "@/lib/auth/auth-store";

type GoogleCompleteSearch = {
  token?: string;
  redirect?: string;
  expiresAt?: number;
};

export const Route = createFileRoute("/auth/google/complete")({
  validateSearch: (search: Record<string, unknown>): GoogleCompleteSearch => ({
    token: typeof search.token === "string" ? search.token : undefined,
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    expiresAt: typeof search.expiresAt === "string" ? Number(search.expiresAt) : undefined,
  }),
  head: () => ({ meta: [{ title: "Signing in — Liffio" }] }),
  component: GoogleAuthComplete,
});

function GoogleAuthComplete() {
  const navigate = useNavigate();
  const search = Route.useSearch();

  useEffect(() => {
    const token = search.token;
    const redirectTo = search.redirect ? sanitizeAuthRedirect(search.redirect) : "/dashboard";

    if (!token) {
      window.location.replace("/login?error=google_failed");
      return;
    }

    const finish = async () => {
      authStore.setSession({
        accessToken: token,
        accessTokenExpiresAt: Number.isFinite(search.expiresAt) ? (search.expiresAt as number) : null,
      });
      const authMe = await getAuthMe({ token });
      authStore.setAuthMe(authMe);
      // Go directly to dashboard (email verified via Google, onboarding handled by liffio.com)
      void navigate({ to: redirectTo as never, replace: true });
    };

    finish().catch(() => { window.location.replace("/login?error=google_failed"); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">Completing sign in with Google…</p>
    </div>
  );
}
