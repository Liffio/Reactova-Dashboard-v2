import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthFeaturePanel, type AuthPanelVariant } from "@/components/auth/AuthFeaturePanel";

type AuthShellProps = {
  children: ReactNode;
  maxWidth?: "xs" | "sm" | "md";
  variant?: AuthPanelVariant;
};

const maxWidthClass = {
  xs: "max-w-[340px]",
  sm: "max-w-[360px]",
  md: "max-w-[380px]",
};

export function AuthShell({ children, maxWidth = "sm", variant = "default" }: AuthShellProps) {
  return (
    <div className="relative min-h-screen bg-background">
      <div className="auth-mesh-subtle pointer-events-none absolute inset-0" aria-hidden />

      <ThemeToggle className="fixed top-4 right-4 z-20 h-9 w-9 flex items-center justify-center rounded-md border border-border/80 bg-card/95 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors" />

      <div className="relative z-10 flex min-h-screen">
        <AuthFeaturePanel variant={variant} />

        <main className="flex flex-1 flex-col items-center justify-center px-5 py-12 sm:px-6">
          <div className={["w-full animate-in fade-in duration-200", maxWidthClass[maxWidth]].join(" ")}>
            <div className="mb-6 lg:hidden">
              <Logo size="sm" />
            </div>

            <div className="rounded-lg border border-border bg-card px-6 py-7 shadow-sm">
              {children}
            </div>

            <p className="mt-5 text-center text-[11px] text-muted-foreground/75">
              © {new Date().getFullYear()} Liffio · Privacy · Terms
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
