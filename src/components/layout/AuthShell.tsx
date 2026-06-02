import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

type AuthShellProps = {
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg";
};

const maxWidthClass = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

export function AuthShell({ children, maxWidth = "md" }: AuthShellProps) {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background p-4 sm:p-6">
      <div className="auth-mesh pointer-events-none absolute inset-0" aria-hidden />
      <div className="auth-grid pointer-events-none absolute inset-0 opacity-25 dark:opacity-15" aria-hidden />

      <ThemeToggle className="fixed top-4 right-4 z-20 p-2 rounded-lg border border-border/60 bg-card hover:bg-muted/50 transition-colors duration-150" />

      <div
        className={[
          "relative z-10 w-full animate-in fade-in duration-300",
          maxWidthClass[maxWidth],
          "rounded-xl border border-border/60 bg-card",
          "p-8 sm:p-10 shadow-card",
        ].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}
