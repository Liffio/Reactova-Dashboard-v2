import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { authStore } from "@/lib/auth/auth-store";
import { onboardingUrl, loginPathWithRedirect } from "@/lib/auth/auth-navigation";

type OnboardingSearch = { meta?: string; reason?: string; step?: number };

export const Route = createFileRoute("/onboarding")({
  validateSearch: (search: Record<string, unknown>): OnboardingSearch => ({
    meta: typeof search.meta === "string" ? search.meta : undefined,
    reason: typeof search.reason === "string" ? search.reason : undefined,
    step: Number(search.step) || undefined,
  }),
  head: () => ({ meta: [{ title: "Get started — Liffio" }] }),
  component: OnboardingRedirect,
});

function OnboardingRedirect() {
  const search = Route.useSearch();

  useEffect(() => {
    const { accessToken } = authStore.getState();
    if (!accessToken) {
      window.location.replace(loginPathWithRedirect("/onboarding"));
      return;
    }
    let url = onboardingUrl(accessToken);
    if (search.meta) url += `&meta=${encodeURIComponent(search.meta)}`;
    if (search.reason) url += `&reason=${encodeURIComponent(search.reason)}`;
    if (search.step) url += `&step=${search.step}`;
    window.location.replace(url);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">Setting up your workspace…</p>
    </div>
  );
}
