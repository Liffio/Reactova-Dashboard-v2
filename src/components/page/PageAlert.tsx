import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageAlertProps = {
  children: ReactNode;
  variant?: "error" | "warning" | "info";
  className?: string;
};

const variantClass = {
  error: "border-destructive/40 bg-destructive/10 text-destructive",
  warning: "border-accent/40 bg-accent/10 text-foreground",
  info: "border-primary/30 bg-primary/5 text-foreground",
};

export function PageAlert({ children, variant = "error", className }: PageAlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        "surface-card rounded-xl px-4 py-3 pl-5 text-sm leading-relaxed",
        variantClass[variant],
        className
      )}
    >
      {children}
    </div>
  );
}
