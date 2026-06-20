import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { authStore } from "@/lib/auth/auth-store";
import { confirmEmailUrl } from "@/lib/auth/auth-navigation";

type ConfirmEmailSearch = { redirect?: string };

export const Route = createFileRoute("/confirm-email")({
  validateSearch: (search: Record<string, unknown>): ConfirmEmailSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({ meta: [{ title: "Verify your email — Liffio" }] }),
  component: ConfirmEmailRedirect,
});

function ConfirmEmailRedirect() {
  const search = Route.useSearch();

  useEffect(() => {
    const { accessToken } = authStore.getState();
    if (!accessToken) {
      window.location.replace("https://liffio.com/login");
      return;
    }
    window.location.replace(confirmEmailUrl(accessToken, search.redirect));
  }, [search]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">Redirecting to email verification…</p>
    </div>
  );
}
