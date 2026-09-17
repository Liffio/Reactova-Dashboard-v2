import type { ReactNode } from "react";

import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";

/**
 * A dialog on desktop, a bottom sheet on mobile, written once.
 *
 * Every surface in the switcher flow needs both presentations, and maintaining two copies of the
 * add-workspace screen is how the two drift — one gains a state the other does not. The children
 * are identical in both; only the container changes.
 *
 * `DialogTitle` is always rendered, visually hidden when the content supplies its own heading:
 * Radix warns without one, and more importantly a screen reader announcing an untitled dialog gives
 * the user nothing to orient on.
 */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Announced to assistive tech. Visually hidden — the content draws its own heading. */
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92vh] pb-[env(safe-area-inset-bottom)]">
          <DrawerTitle className="sr-only">{title}</DrawerTitle>
          <div className="overflow-y-auto">{children}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={className ?? "max-h-[calc(100vh-4rem)] overflow-y-auto sm:max-w-[540px]"}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
