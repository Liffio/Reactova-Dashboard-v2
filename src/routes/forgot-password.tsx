import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Reset password — Liffio" }] }),
  component: ForgotPasswordRedirect,
});

function ForgotPasswordRedirect() {
  useEffect(() => {
    window.location.replace("https://liffio.com/forgot-password");
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">Redirecting…</p>
    </div>
  );
}
