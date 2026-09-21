import type { LucideIcon } from "lucide-react";

/**
 * The heading every automation section wears. (A2)
 *
 * Lifted out of `automation-builder.tsx` unchanged so the sections beside it can be mounted
 * anywhere without dragging the builder in. The scheduler uses the same one, which is the point of
 * A4: two surfaces that must not drift should not be two pieces of markup.
 */
export function SectionTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-gradient text-primary-foreground shadow-glow">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h2 className="font-display text-lg font-semibold leading-tight">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}
