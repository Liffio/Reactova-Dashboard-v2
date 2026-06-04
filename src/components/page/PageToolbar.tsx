import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "page-toolbar flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3",
        className
      )}
    >
      {children}
    </div>
  );
}
