import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { LocalLoginForm } from "@/components/auth/local-login-form";

type LoginSearch = { redirect?: string; error?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  head: () => ({ meta: [{ title: "Sign in — Liffio" }] }),
  component: LoginRedirect,
});

/** How long to wait for the cross-domain hop to liffio.com before giving up and
 * rendering the local fallback form (covers app.liffio.com being hit directly
 * while liffio.com is unreachable, blocked, or slow). */
const REDIRECT_FALLBACK_MS = 2500;

function LoginRedirect() {
  const search = Route.useSearch();
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    const base = "https://liffio.com/login";
    const params = new URLSearchParams();
    if (search.redirect) params.set("redirect", search.redirect);
    if (search.error) params.set("error", search.error);
    const qs = params.toString();
    window.location.replace(qs ? `${base}?${qs}` : base);

    // If we're still here after the timeout, the redirect didn't take — show
    // the local login form instead of spinning forever.
    const timer = window.setTimeout(() => setShowFallback(true), REDIRECT_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  if (showFallback) {
    return (
      <LocalLoginForm redirectTo={search.redirect ?? "/dashboard"} initialError={search.error} />
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">Redirecting to sign in…</p>
    </div>
  );
}
