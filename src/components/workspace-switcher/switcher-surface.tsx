import type { ReactNode } from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Where the switcher panel appears, which is a different answer on a phone than on a desktop.
 *
 * 🔴 **On mobile it is a bottom sheet, never a dropdown from the header.** The HTML is explicit and
 * the previous build got this wrong: it rendered a `Popover` anchored under the header trigger and
 * merely widened it to the viewport, so the panel dropped DOWN from the top of the screen. On a
 * phone the list can be twenty workspaces long and the user's thumb is at the bottom, which is the
 * whole reason the reference design pulls it up from there.
 *
 * On desktop the trigger sits at the BOTTOM of the sidebar, so the popover opens UPWARD, anchored
 * above it, at a fixed 340px. Opening it to the side (what `side="right"` did) put the panel over
 * the page content instead of over the sidebar it belongs to.
 *
 * Built on `vaul` directly rather than on `components/ui/drawer`, because that shared wrapper
 * hardcodes its own grabber at 100x8px and this surface needs the reference's 40x4. `vaul` is
 * already a dependency; nothing new is installed.
 */

/**
 * The switcher's own breakpoint.
 *
 * The HTML switches at `max-width: 820px`. The app's `useIsMobile` switches at 768px and is used
 * across the whole product, so widening it here would move every other responsive decision with it.
 * This is deliberately local.
 */
export const SWITCHER_SHEET_BREAKPOINT = 821;

export function SwitcherSurface({
  open,
  onOpenChange,
  isSheet,
  trigger,
  children,
  /** `up` for the sidebar footer trigger, `down` for the header pills. */
  desktopSide = "top",
  desktopAlign = "start",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSheet: boolean;
  trigger: ReactNode;
  children: ReactNode;
  desktopSide?: "top" | "bottom" | "right";
  desktopAlign?: "start" | "end";
}) {
  if (isSheet) {
    return (
      <DrawerPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DrawerPrimitive.Trigger asChild>{trigger}</DrawerPrimitive.Trigger>
        <DrawerPrimitive.Portal>
          {/* The dark scrim. Tapping it closes, which vaul wires up. */}
          <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/35" />
          <DrawerPrimitive.Content
            className={cn(
              "fixed inset-x-0 bottom-0 z-50 flex max-h-[82vh] flex-col",
              "rounded-t-[20px] border bg-popover pb-[env(safe-area-inset-bottom)]",
              "shadow-[0_1px_2px_rgba(22,10,8,.06),0_16px_40px_-12px_rgba(22,10,8,.22)]",
            )}
          >
            <DrawerPrimitive.Title className="sr-only">Switch workspace</DrawerPrimitive.Title>
            {/* 40x4 with a 2px radius, per the reference. */}
            <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-sm bg-border" />
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Portal>
      </DrawerPrimitive.Root>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        side={desktopSide}
        align={desktopAlign}
        sideOffset={8}
        className="flex max-h-[calc(100vh-80px)] w-[340px] flex-col overflow-hidden rounded-2xl p-0"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
