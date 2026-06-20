import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";

type RegisterSearch = { redirect?: string; plan?: string };

export const Route = createFileRoute("/register")({
  validateSearch: (search: Record<string, unknown>): RegisterSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    plan: typeof search.plan === "string" ? search.plan : undefined,
  }),
  head: () => ({ meta: [{ title: "Create account — Liffio" }] }),
  component: RegisterRedirect,
});

function RegisterRedirect() {
  const search = Route.useSearch();

  useEffect(() => {
    const base = "https://liffio.com/register";
    const params = new URLSearchParams();
    if (search.redirect) params.set("redirect", search.redirect);
    if (search.plan) params.set("plan", search.plan);
    const qs = params.toString();
    window.location.replace(qs ? `${base}?${qs}` : base);
  }, [search]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">Redirecting to registration…</p>
    </div>
  );
}
