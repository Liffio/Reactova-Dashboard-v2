import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthBackdrop } from "@/components/auth/AuthBackdrop";
import { AuthInstagramShowcase, type AuthPanelVariant } from "@/components/auth/AuthFeaturePanel";

type AuthShellProps = {
  children: ReactNode;
  maxWidth?: "sm" | "md";
  variant?: AuthPanelVariant;
};

const formMaxWidth = {
  sm: "max-w-[400px]",
  md: "max-w-[440px]",
};

export function AuthShell({ children, maxWidth = "sm", variant = "default" }: AuthShellProps) {
  return (
    <div className="auth-page relative min-h-screen w-full overflow-x-hidden">
      <AuthBackdrop />

      <ThemeToggle className="auth-glass-pill fixed top-4 right-4 z-30 !rounded-full p-2.5 border-0 shadow-none hover:scale-105 transition-transform" />

      <div className="relative z-10 flex min-h-screen w-full items-center justify-center py-8 sm:py-10">
        <div className="container mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto flex w-full flex-col items-center justify-center gap-8 lg:flex-row lg:items-stretch lg:justify-center lg:gap-8 xl:gap-10">
            <div className="flex w-full justify-center lg:w-auto lg:flex-1 lg:max-w-[480px] lg:justify-end">
              <AuthInstagramShowcase variant={variant} />
            </div>

            <div className={["flex w-full flex-col items-center mx-auto", formMaxWidth[maxWidth], "lg:mx-0 lg:shrink-0"].join(" ")}>
              <div className="mb-5 flex justify-center lg:hidden">
                <Logo size="sm" />
              </div>

              <div className="auth-glass-panel auth-glass-form w-full">
                <div className="relative p-6 sm:p-8">{children}</div>
              </div>

              <p className="mt-5 text-center text-[11px] text-muted-foreground/80 px-4">
                Secured with encryption · Meta Business API ·{" "}
                <span className="text-foreground/70">© {new Date().getFullYear()} Liffio</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
