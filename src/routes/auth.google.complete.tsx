import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { getAuthMe } from "@/lib/api/auth-api";
import { postAuthLandingPath, sanitizeAuthRedirect } from "@/lib/auth/auth-navigation";
import { authStore } from "@/lib/auth/auth-store";

type GoogleCompleteSearch = {
  token?: string;
  redirect?: string;
};

export const Route = createFileRoute("/auth/google/complete")({
  validateSearch: (search: Record<string, unknown>): GoogleCompleteSearch => ({
    token: typeof search.token === "string" ? search.token : undefined,
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
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
      void navigate({ to: "/login", search: { error: "google_failed" }, replace: true });
      return;
    }

    const finish = async () => {
      authStore.setSession({ accessToken: token });
      const authMe = await getAuthMe({ token });
      authStore.setAuthMe(authMe);
      const { emailVerified, isOnboarded } = authStore.getState();
      void navigate({
        to: postAuthLandingPath({ emailVerified, isOnboarded }, redirectTo),
        replace: true,
      });
    };

    finish().catch(() =>
      navigate({ to: "/login", search: { error: "google_failed" }, replace: true })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">Completing sign in with Google…</p>
    </div>
  );
}
