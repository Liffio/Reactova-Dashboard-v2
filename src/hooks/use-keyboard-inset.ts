import { useEffect, useState } from "react";

/**
 * How much of the screen the software keyboard is covering, in CSS pixels. (R4)
 *
 * ## Why `dvh` is not enough, even though it looks like it should be
 *
 * FX1 moved the sheet from `vh` to `dvh` because `vh` is the LARGE viewport on iOS and ignores
 * Safari's toolbars. That fixed the toolbar case and is still right.
 *
 * `dvh` does not shrink for the keyboard. The *layout* viewport is unchanged when the keyboard
 * opens: iOS slides the keyboard over the page rather than resizing it, and on Android the
 * behaviour depends on a manifest setting the browser may ignore. So a sheet sized to `92dvh` keeps
 * its full height, its pinned footer stays where it was, and the keyboard is drawn on top of it.
 * That is exactly the report: "the footer and the create button end up floating over the page".
 *
 * `window.visualViewport` is the only thing that knows. It describes what the user can actually
 * see, and it DOES shrink. The inset is the part of the layout viewport now hidden underneath the
 * keyboard:
 *
 * ```
 * inset = innerHeight - (visualViewport.height + visualViewport.offsetTop)
 * ```
 *
 * `offsetTop` is in there because the page can also be scrolled within the visual viewport, and
 * without it a pinned element drifts by exactly that much.
 *
 * ## What it returns when there is no keyboard
 *
 * 0. Including on desktop, in browsers with no `visualViewport`, and during SSR. Callers can add it
 *    unconditionally.
 *
 * Small readings are treated as 0: browsers report a handful of pixels of jitter while toolbars
 * animate, and an inset that flickers between 0 and 6 makes a pinned footer twitch.
 */
const NOISE_FLOOR_PX = 24;

export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : undefined;
    if (!vv) return;

    const read = () => {
      const hidden = window.innerHeight - (vv.height + vv.offsetTop);
      setInset(hidden > NOISE_FLOOR_PX ? Math.round(hidden) : 0);
    };

    read();
    vv.addEventListener("resize", read);
    vv.addEventListener("scroll", read);
    return () => {
      vv.removeEventListener("resize", read);
      vv.removeEventListener("scroll", read);
    };
  }, []);

  return inset;
}

/**
 * Keep the focused field in view once the keyboard has settled. (R4)
 *
 * The browser does this itself for an ordinary page, and gets it wrong inside a sheet that is
 * itself a scroll container: it scrolls the PAGE, which is locked, and the field stays hidden. The
 * report calls this "the name field is half hidden".
 *
 * `block: "center"` rather than `nearest`, because a field that ends up flush against the top of
 * the keyboard is technically visible and still feels wrong. The delay lets the keyboard animation
 * finish, since scrolling to a position the viewport is still moving away from achieves nothing.
 */
export function scrollFocusedIntoView(delayMs = 250): void {
  window.setTimeout(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return;
    if (!/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return;
    active.scrollIntoView({ block: "center", behavior: "smooth" });
  }, delayMs);
}
