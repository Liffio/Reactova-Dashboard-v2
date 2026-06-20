import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";

type LoginSearch = { redirect?: string; error?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  head: () => ({ meta: [{ title: "Sign in — Liffio" }] }),
  component: LoginRedirect,
});

function LoginRedirect() {
  const search = Route.useSearch();

  useEffect(() => {
    const base = "https://liffio.com/login";
    const params = new URLSearchParams();
    if (search.redirect) params.set("redirect", search.redirect);
    if (search.error) params.set("error", search.error);
    const qs = params.toString();
    window.location.replace(qs ? `${base}?${qs}` : base);
  }, [search]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">Redirecting to sign in…</p>
    </div>
  );
}
