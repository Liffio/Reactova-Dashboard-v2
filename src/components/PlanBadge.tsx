import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type PlanName = "Free" | "Starter" | "Pro" | "Business" | "Agency" | "Agency Client";

export function PlanBadge({ plan, className }: { plan: PlanName; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
        className
      )}
    >
      {plan}
    </Badge>
  );
}
