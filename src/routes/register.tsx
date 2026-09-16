import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";

type RegisterSearch = { redirect?: string; plan?: string; ref?: string; b?: string };

export const Route = createFileRoute("/register")({
  validateSearch: (search: Record<string, unknown>): RegisterSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    plan: typeof search.plan === "string" ? search.plan : undefined,
    ref: typeof search.ref === "string" ? search.ref : undefined,
    b: typeof search.b === "string" ? search.b : undefined,
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
    if (search.ref) params.set("ref", search.ref);
    // The actual signup form (and the request that submits it) lives on the marketing site, not
    // in this repo — this route's only job is to carry `b` across in the query string. Don't stash
    // it in localStorage or attach it to a payload here: there is no signup request on this origin
    // to attach it to, and localStorage written just before this redirect can't survive the
    // cross-origin navigation anyway. The marketing site's register page reads it from here.
    if (search.b) params.set("b", search.b);
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
