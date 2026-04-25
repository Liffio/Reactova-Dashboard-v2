export function Logo({ size = "md", className = "" }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const text = size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-xl";
  const dot = size === "lg" ? "h-3 w-3" : size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className={`${dot} rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.7)]`} />
      <span className={`font-bold tracking-tight text-foreground ${text}`}>Reactova</span>
    </div>
  );
}
