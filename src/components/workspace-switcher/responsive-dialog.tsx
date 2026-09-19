import { useEffect, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useKeyboardInset, scrollFocusedIntoView } from "@/hooks/use-keyboard-inset";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";

/**
 * A dialog on desktop, a bottom sheet on mobile, written once.
 *
 * Every surface in the switcher flow needs both presentations, and maintaining two copies of the
 * add-workspace screen is how the two drift: one gains a state the other does not. The children
 * are identical in both; only the container changes.
 *
 * `DialogTitle` is always rendered, visually hidden when the content supplies its own heading:
 * Radix warns without one, and more importantly a screen reader announcing an untitled dialog
 * gives the user nothing to orient on.
 *
 * ## 🔴 dvh, not vh, and the three-part structure (FX1)
 *
 * Found on an iPhone 12 in Safari: the sheet cut off the lower plans AND the create button, so the
 * screen could not be completed at all.
 *
 * Two separate causes, both fixed here:
 *
 * 1. **`vh` is the LARGE viewport on iOS.** `100vh` ignores Safari's address bar and bottom
 *    toolbar, so `92vh` is taller than the space actually available and the bottom of the sheet
 *    sits under the toolbar. `dvh` tracks the *dynamic* viewport and shrinks when the toolbars are
 *    showing, which is the only unit that is correct while they are.
 * 2. **The whole sheet scrolled as one block.** The footer scrolled away with the content, so the
 *    button was only reachable by scrolling to the very end of a list the user could not see the
 *    end of.
 *
 * The container is now a flex column with `min-h-0` (without which a flex child refuses to shrink
 * below its content and the inner `overflow-y-auto` never engages). Consumers lay their children
 * out as header `shrink-0`, body `flex-1 overflow-y-auto min-h-0`, footer `shrink-0` with
 * safe-area padding. `DialogBody` and `DialogFooterBar` below exist so no caller has to remember
 * that combination.
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
  /** Announced to assistive tech. Visually hidden: the content draws its own heading. */
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const isMobile = useIsMobile();
  const keyboardInset = useKeyboardInset();

  /**
   * 🔴 The page behind is locked while the sheet is open. (R4)
   *
   * Reported as "content behind shows through". Two different things were happening and both are
   * handled here, because the fix for one does not fix the other:
   *
   * - The body could still scroll under the sheet, so a drag that started on the overlay moved the
   *   page. `overflow: hidden` on the documentElement is what stops that on iOS; `body` alone is
   *   not enough there.
   * - `overscroll-behavior: none` stops a scroll that reaches the end of the sheet's own body from
   *   chaining to the page behind it, which is the version of this that only shows up once the
   *   list is scrolled to the bottom.
   */
  useEffect(() => {
    if (!open || !isMobile) return;
    const root = document.documentElement;
    const previous = {
      overflow: root.style.overflow,
      overscroll: root.style.overscrollBehavior,
    };
    root.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";
    return () => {
      root.style.overflow = previous.overflow;
      root.style.overscrollBehavior = previous.overscroll;
    };
  }, [open, isMobile]);

  // Once the keyboard has settled, put the focused field back where it can be seen.
  useEffect(() => {
    if (keyboardInset > 0) scrollFocusedIntoView();
  }, [keyboardInset]);

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          className="flex min-h-0 flex-col overscroll-contain"
          /**
           * Height comes from the VISUAL viewport, not from `dvh`. (R4)
           *
           * `dvh` tracks Safari's toolbars and is still right for them, but it does not shrink for
           * the keyboard: iOS draws the keyboard over the page rather than resizing it. A sheet
           * sized purely in `dvh` therefore keeps its full height with the keyboard up, and its
           * pinned footer and create button end up underneath it.
           *
           * Subtracting the measured inset is what puts the footer directly above the keyboard.
           * The inset is 0 whenever there is no keyboard, so this is exactly the old behaviour on
           * every device that does not have one.
           */
          style={{ maxHeight: `calc(92dvh - ${keyboardInset}px)` }}
        >
          <DrawerTitle className="sr-only">{title}</DrawerTitle>
          {/*
            No `overflow-y-auto` here any more. Scrolling belongs to the BODY, so the footer can
            stay pinned. A wrapper that scrolls takes the footer with it, which is the defect.
          */}
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[calc(100dvh-4rem)] min-h-0 flex-col gap-0 p-0 sm:max-w-[540px]",
          className,
        )}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** The scrolling middle of a sheet. Everything that can overflow goes in here. */
export function DialogBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // `min-h-0` is what lets this shrink inside the flex column so the overflow engages;
        // `-webkit-overflow-scrolling` keeps momentum scrolling on iOS.
        // `overscroll-contain` stops a scroll that reaches either end of this list from chaining to
        // the page behind the sheet, which is the other half of "content behind shows through".
        "min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * The pinned footer. Never scrolls away, and clears the iPhone home indicator.
 *
 * The padding is additive (`calc`) rather than a bare `env()`, so the button keeps its normal
 * breathing room on devices where the inset is 0.
 */
export function DialogFooterBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const keyboardInset = useKeyboardInset();

  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-3 border-t bg-popover px-6 pt-4",
        className,
      )}
      /**
       * The home indicator inset is dropped while the keyboard is up. (R4)
       *
       * `env(safe-area-inset-bottom)` exists to clear the home indicator, and the keyboard is
       * already covering it. Keeping both leaves a band of empty sheet between the button and the
       * keyboard, which is the "floating over the page" look from the other side.
       */
      style={{
        paddingBottom:
          keyboardInset > 0 ? "1rem" : "calc(1rem + env(safe-area-inset-bottom))",
      }}
    >
      {children}
    </div>
  );
}

/** The fixed header of a sheet. Never scrolls. */
export function DialogHeaderBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("shrink-0 px-6 pt-6", className)}>{children}</div>;
}
