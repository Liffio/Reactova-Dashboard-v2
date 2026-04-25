import { cn } from "@/lib/utils";

type Variant = "active" | "paused" | "draft" | "failed" | "scheduled" | "pending" | "completed" | "published" | "disconnected";

const map: Record<Variant, { label: string; cls: string; dot: string }> = {
  active: { label: "Active", cls: "bg-success/15 text-success border-success/30", dot: "bg-success" },
  paused: { label: "Paused", cls: "bg-warning/15 text-warning border-warning/30", dot: "bg-warning" },
  draft: { label: "Draft", cls: "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30", dot: "bg-muted-foreground" },
  failed: { label: "Failed", cls: "bg-destructive/15 text-destructive border-destructive/30", dot: "bg-destructive" },
  scheduled: { label: "Scheduled", cls: "bg-info/15 text-info border-info/30", dot: "bg-info" },
  pending: { label: "Pending", cls: "bg-warning/15 text-warning border-warning/30", dot: "bg-warning" },
  completed: { label: "Completed", cls: "bg-success/15 text-success border-success/30", dot: "bg-success" },
  published: { label: "Published", cls: "bg-success/15 text-success border-success/30", dot: "bg-success" },
  disconnected: { label: "Disconnected", cls: "bg-destructive/15 text-destructive border-destructive/30", dot: "bg-destructive" },
};

export function StatusBadge({ status, label, className, withDot = false }: { status: Variant; label?: string; className?: string; withDot?: boolean }) {
  const v = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border", v.cls, className)}>
      {withDot && <span className={cn("h-1.5 w-1.5 rounded-full", v.dot)} />}
      {label ?? v.label}
    </span>
  );
}

export function StatusDot({ status, className }: { status: Variant; className?: string }) {
  return <span className={cn("h-2 w-2 rounded-full inline-block", map[status].dot, className)} />;
}
