import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "page-toolbar flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 rounded-lg border border-border bg-card p-3 shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}
