import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  icon: LucideIcon;
  title: string;
  description?: string;
  ctaLabel?: string;
  onCta?: () => void;
  ctaVariant?: "default" | "accent";
}

export function EmptyState({ icon: Icon, title, description, ctaLabel, onCta, ctaVariant = "accent" }: Props) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-xl border border-dashed border-border bg-card/30">
      <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted-foreground max-w-md">{description}</p>}
      {ctaLabel && (
        <Button onClick={onCta} variant={ctaVariant === "accent" ? "accent" : "default"} className="mt-5">
          {ctaLabel}
        </Button>
      )}
    </div>
  );
}
