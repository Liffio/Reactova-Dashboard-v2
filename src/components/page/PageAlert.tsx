import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageAlertProps = {
  children: ReactNode;
  variant?: "error" | "warning" | "info";
  className?: string;
};

const variantClass = {
  error: "border-destructive/30 bg-destructive/5 text-foreground",
  warning: "border-border bg-muted/50 text-foreground",
  info: "border-border bg-muted/50 text-foreground",
};

export function PageAlert({ children, variant = "error", className }: PageAlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border px-4 py-3 text-sm leading-relaxed",
        variantClass[variant],
        className
      )}
    >
      {children}
    </div>
  );
}
