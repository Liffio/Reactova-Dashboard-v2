import { useRouterState } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { useApp } from "@/state/app-context";
import { WorkspaceIdChip } from "@/components/workspace-id-chip";

/**
 * Page titles already exist — every route's `head` sets one — so the breadcrumb reads them back
 * rather than keeping a second parallel map that drifts the moment someone adds a route.
 *
 * `" — Liffio"` is the suffix those titles carry for the browser tab; it is redundant inside the
 * app chrome, where the product name is already on screen twice.
 */
function usePageTitle(): string {
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

export function BreadcrumbTitle() {
  const { current } = useApp();
  const page = usePageTitle();

  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 lg:flex">
      <span className="max-w-[160px] truncate text-sm text-muted-foreground">{current.name}</span>
      <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
      <span className="max-w-[220px] truncate text-sm font-medium">{page}</span>
    </nav>
  );
}

/**
 * The mobile counterpart. `WorkspaceIdChip` used to sit in the topbar on its own; below `lg` the
 * breadcrumb is hidden, so the id rides along here instead of disappearing from the shell.
 */
export function MobileWorkspaceCrumb() {
  const { current } = useApp();
  const page = usePageTitle();

  return (
    <div className="flex min-w-0 flex-col leading-tight lg:hidden">
      <span className="truncate text-sm font-medium">{page}</span>
      <span className="flex items-center gap-1.5">
        <span className="truncate text-[10px] text-muted-foreground">{current.name}</span>
        <WorkspaceIdChip
          humanId={current.humanId}
          className="hidden h-4 px-1 text-[9px] sm:inline-flex"
        />
      </span>
    </div>
  );
}
