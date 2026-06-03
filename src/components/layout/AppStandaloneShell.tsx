import type { ReactNode } from "react";
import { AppShellBackdrop } from "./AppShellBackdrop";

/** Centered glass card for checkout, invites, OAuth complete, etc. */
export function AppStandaloneShell({
  children,
  className = "",
  maxWidth = "max-w-md",
}: {
  children: ReactNode;
  className?: string;
  maxWidth?: string;
}) {
  return (
    <div className={`app-shell relative min-h-screen flex items-center justify-center p-4 sm:p-6 ${className}`}>
      <AppShellBackdrop />
      <div className={`relative z-10 container flex justify-center w-full ${maxWidth}`}>
        <div className="glass-surface w-full rounded-xl p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
}
