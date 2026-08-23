import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/state/theme-store";
import { cn } from "@/lib/utils";

/**
 * Light/dark switch.
 *
 * Lifted out of `_app.tsx` because it now has two homes: the desktop topbar, and the mobile
 * sidebar reached through "More" — where it moved so the phone topbar could give its width to the
 * breadcrumb instead of a control most people touch once.
 *
 * `variant` is about shape, not behaviour. The topbar wants a 36px square that matches the
 * notification and search buttons beside it; a sidebar row wants a full-width target with a label,
 * because an unlabelled icon in a list of labelled links reads as a missing string.
 */
export function ThemeToggle({
  variant = "icon",
  className,
}: {
  variant?: "icon" | "row";
  className?: string;
}) {
  const { resolved, toggle } = useTheme();
  const dark = resolved === "dark";
  const label = dark ? "Switch to light mode" : "Switch to dark mode";

  const glyph = (
    <AnimatePresence mode="wait" initial={false}>
      {dark ? (
        <motion.span
          key="sun"
          initial={{ rotate: -90, opacity: 0, scale: 0.7 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 90, opacity: 0, scale: 0.7 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className={variant === "icon" ? "absolute" : undefined}
        >
          <Sun className="h-4 w-4" />
        </motion.span>
      ) : (
        <motion.span
          key="moon"
          initial={{ rotate: 90, opacity: 0, scale: 0.7 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: -90, opacity: 0, scale: 0.7 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className={variant === "icon" ? "absolute" : undefined}
        >
          <Moon className="h-4 w-4" />
        </motion.span>
      )}
    </AnimatePresence>
  );

  if (variant === "row") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          className,
        )}
      >
        <span className="grid h-4 w-4 shrink-0 place-items-center">{glyph}</span>
        <span>{dark ? "Light mode" : "Dark mode"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      className={cn(
        "relative grid h-9 w-9 shrink-0 place-items-center rounded-lg border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
        className,
      )}
    >
      {glyph}
    </button>
  );
}
