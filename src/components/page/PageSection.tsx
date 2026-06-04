import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageSectionProps = {
  title?: string;
  description?: string;
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  noPadding?: boolean;
};

export function PageSection({
  title,
  description,
  action,
  footer,
  children,
  className,
  contentClassName,
  noPadding,
}: PageSectionProps) {
  const hasHeader = Boolean(title || description || action);

  return (
    <section className={cn("surface-card overflow-hidden", className)}>
      {hasHeader && (
        <div className="card-section-head flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
          <div className="min-w-0">
            {title && <h2 className="font-semibold text-sm text-foreground">{title}</h2>}
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0 w-full sm:w-auto">{action}</div>}
        </div>
      )}
      <div className={cn(!noPadding && "px-4 sm:px-5 py-4 sm:py-5", contentClassName)}>{children}</div>
      {footer && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-3 border-t border-border/50 text-xs text-muted-foreground">
          {footer}
        </div>
      )}
    </section>
  );
}
