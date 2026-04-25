import { cn } from "@/lib/utils";

export type PlanName = "Free" | "Starter" | "Pro" | "Business" | "Agency" | "Agency Client";

const styles: Record<PlanName, string> = {
  Free: "bg-muted-foreground/15 text-muted-foreground border border-muted-foreground/20",
  Starter: "bg-info/15 text-info border border-info/30",
  Pro: "bg-primary/15 text-primary border border-primary/30",
  Business: "bg-violet/15 text-violet border border-violet/30",
  Agency: "bg-accent/15 text-accent border border-accent/30",
  "Agency Client": "bg-muted-foreground/15 text-muted-foreground border border-muted-foreground/20",
};

export function PlanBadge({ plan, className }: { plan: PlanName; className?: string }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide", styles[plan], className)}>
      {plan}
    </span>
  );
}
