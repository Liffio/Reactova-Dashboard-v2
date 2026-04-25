import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PlanBadge, PlanName } from "./PlanBadge";

interface Props {
  requiredPlan: PlanName;
  message?: string;
  ctaLabel?: string;
  variant?: "primary" | "accent";
  children?: React.ReactNode;
  className?: string;
}

export function PlanGate({ requiredPlan, message, ctaLabel = `Upgrade to ${requiredPlan}`, variant = "accent", children, className }: Props) {
  return (
    <div className={cn("relative rounded-xl overflow-hidden border border-border", className)}>
      {children && <div className="pointer-events-none select-none blur-sm opacity-40">{children}</div>}
      <div className={cn("absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center bg-card/60 backdrop-blur-sm", !children && "relative")}>
        <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center">
          <Lock className="h-5 w-5 text-primary" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm font-semibold">Available on</span>
            <PlanBadge plan={requiredPlan} />
          </div>
          {message && <p className="text-sm text-muted-foreground max-w-sm">{message}</p>}
        </div>
        <Button variant={variant === "accent" ? "accent" : "default"} size="sm">{ctaLabel}</Button>
      </div>
    </div>
  );
}
