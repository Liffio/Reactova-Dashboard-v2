import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthFeaturePanel, AuthMobileHighlights, type AuthPanelVariant } from "@/components/auth/AuthFeaturePanel";

type AuthShellProps = {
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg";
  variant?: AuthPanelVariant;
};

const maxWidthClass = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

export function AuthShell({ children, maxWidth = "md", variant = "default" }: AuthShellProps) {
  return (
    <div className="relative min-h-screen bg-background lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(400px,520px)] xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,540px)]">
      <AuthFeaturePanel variant={variant} />

      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-4 sm:p-6 lg:p-8 xl:p-10">
        <div className="auth-mesh pointer-events-none absolute inset-0 lg:hidden" aria-hidden />
        <div className="auth-grid pointer-events-none absolute inset-0 opacity-25 dark:opacity-15 lg:hidden" aria-hidden />
        <div className="auth-orb auth-orb-primary pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full blur-3xl lg:opacity-60" aria-hidden />

        <ThemeToggle className="fixed top-4 right-4 z-20 p-2 rounded-lg border border-border/60 bg-card/90 backdrop-blur-sm hover:bg-muted/50 transition-colors duration-150" />

        <div
          className={[
            "relative z-10 w-full animate-in fade-in duration-300",
            maxWidthClass[maxWidth],
          ].join(" ")}
        >
          <AuthMobileHighlights variant={variant} />

          <div className="rounded-2xl border border-border/60 bg-card/95 backdrop-blur-sm p-7 sm:p-9 shadow-elevated">
            {children}
          </div>
        </div>

        <p className="relative z-10 mt-6 text-center text-[11px] text-muted-foreground/80 max-w-sm px-4">
          Trusted by creators and brands · Secured with encryption · Official Instagram API
        </p>
      </div>
    </div>
  );
}
