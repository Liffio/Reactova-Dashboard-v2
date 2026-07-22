import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

type AuthShellProps = {
  children: ReactNode;
  maxWidth?: "sm" | "md";
  /** Optional marketing blurb shown beside the form on large screens. */
  aside?: ReactNode;
};

const defaultAside = (
  <div className="hidden max-w-sm flex-col gap-6 lg:flex">
    <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight">
      Turn Instagram comments into <span className="text-brand-gradient">customers</span> — on
      autopilot.
    </h2>
    <ul className="space-y-3 text-sm text-muted-foreground">
      <li className="flex items-start gap-2.5">
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
        Auto-DM anyone who comments your keyword — in seconds, 24/7.
      </li>
      <li className="flex items-start gap-2.5">
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
        Capture leads, track link clicks, and attribute sales to every post.
      </li>
      <li className="flex items-start gap-2.5">
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
        Schedule posts and reels with music from one calendar.
      </li>
    </ul>
  </div>
);

export function AuthShell({ children, maxWidth = "sm", aside = defaultAside }: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-soft-gradient opacity-80"
      />
      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <Link to="/">
          <Logo size="sm" />
        </Link>
      </header>
      <div className="relative z-10 flex flex-1 items-center justify-center gap-16 px-4 pb-16 pt-4">
        {aside}
        <div
          className={cn(
            "w-full rounded-2xl border bg-card p-6 shadow-soft sm:p-8",
            maxWidth === "sm" ? "max-w-md" : "max-w-lg",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
