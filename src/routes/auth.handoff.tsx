/**
 * Token handoff from liffio.com (marketing site) to app.liffio.com.
 * After registering/logging in on liffio.com, the user is redirected here
 * with ?token={accessToken}&redirect={path} so we can hydrate the app session.
 */
import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { getAuthMe } from "@/lib/api/auth-api";
import { sanitizeAuthRedirect, loginPathWithRedirect } from "@/lib/auth/auth-navigation";
import { authStore } from "@/lib/auth/auth-store";

type HandoffSearch = {
  token?: string;
  redirect?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/auth/handoff")({
  validateSearch: (search: Record<string, unknown>): HandoffSearch => ({
    token: typeof search.token === "string" ? search.token : undefined,
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({ meta: [{ title: "Signing in — Liffio" }] }),
  component: AuthHandoff,
});

function AuthHandoff() {
  const navigate = useNavigate();

  // Read params directly from URL to avoid type errors before route tree regeneration
  const search: HandoffSearch = (() => {
    if (typeof window === "undefined") return {};
    const params = new URLSearchParams(window.location.search);
    return {
      token: params.get("token") ?? undefined,
      redirect: params.get("redirect") ?? undefined,
    };
  })();

  useEffect(() => {
    const token = search.token;
    const redirectTo = sanitizeAuthRedirect(search.redirect ?? null);

    if (!token) {
      window.location.replace(loginPathWithRedirect("/"));
      return;
    }

    const finish = async () => {
      authStore.setSession({ accessToken: token });
      const authMe = await getAuthMe({ token });
      authStore.setAuthMe(authMe);
      void navigate({ to: redirectTo as never, replace: true });
    };

    finish().catch(() => {
      window.location.replace(loginPathWithRedirect("/"));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">Setting up your workspace…</p>
    </div>
  );
}
