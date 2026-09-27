import { Monitor, Moon, Sun } from "lucide-react";
import type { Theme } from "@/lib/theme";
import { useTheme } from "@/state/theme-store";
import { cn } from "@/lib/utils";

const OPTIONS: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Match system", icon: Monitor },
];

/**
 * Light / Dark / Match system (chatbot spec §10.2). The app-wide toggle only flips light and dark;
 * the chatbot screens offer the third option the prototype has, on the same `liffio-theme` store,
 * so a choice made here holds everywhere.
 */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  return (
    <div
      role="group"
      aria-label="Theme"
      className={cn("inline-flex gap-0.5 rounded-lg bg-secondary p-0.5", className)}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={theme === value}
          onClick={() => setTheme(value)}
          className={cn(
            "flex items-center rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:text-foreground",
            theme === value && "bg-card text-primary shadow-card",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
