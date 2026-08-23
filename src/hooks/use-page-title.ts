import { useRouterState } from "@tanstack/react-router";

/**
 * The current page's title, read back from the route that set it.
 *
 * Every route's `head` already sets one, so this reads them rather than keeping a second parallel
 * map that drifts the moment someone adds a route. `" — Liffio"` is the suffix those titles carry
 * for the browser tab; it is redundant inside the app chrome, where the product name is already on
 * screen twice.
 *
 * Its own module rather than a second export from the component that used to own it: a file that
 * exports both a hook and a component loses fast refresh for the component.
 */
export function usePageTitle(): string {
  return useRouterState({
    select: (state) => {
      for (let i = state.matches.length - 1; i >= 0; i -= 1) {
        const meta = state.matches[i]?.meta;
        const title = meta?.find((tag) => typeof tag?.title === "string")?.title;
        if (title) return String(title).split("—")[0]!.trim();
      }
      // A route without a `head` falls back to its last path segment, humanised. Better a rough
      // label than an empty crumb that makes the bar look broken.
      const last = state.location.pathname.split("/").filter(Boolean).pop();
      if (!last) return "Dashboard";
      return last.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
    },
  });
}
