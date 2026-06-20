import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { authStore } from "@/lib/auth/auth-store";
import { onboardingUrl } from "@/lib/auth/auth-navigation";

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
  useEffect(() => {
    const { accessToken } = authStore.getState();
    if (!accessToken) {
      window.location.replace("https://liffio.com/login");
      return;
    }
    window.location.replace(onboardingUrl(accessToken));
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">Setting up your workspace…</p>
    </div>
  );
}
