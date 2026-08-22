import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { openGlobalSearch } from "@/lib/global-search-events";

/** Desktop topbar trigger. A button, not an input — the field it opens lives in the palette. */
export function SearchTrigger({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openGlobalSearch}
      className={cn(
        "flex h-9 w-full max-w-[440px] items-center gap-2 rounded-lg border bg-card px-3 text-muted-foreground shadow-soft transition-colors hover:bg-accent hover:text-accent-foreground",
        className,
      )}
    >
      <Search className="h-4 w-4 shrink-0" />
      <span className="truncate text-sm">Search automations, leads, links…</span>
      <kbd className="ml-auto hidden shrink-0 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium lg:inline">
        ⌘K
      </kbd>
    </button>
  );
}

/** Mobile header trigger. Same event, icon only. */
export function SearchIconTrigger({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openGlobalSearch}
      aria-label="Search"
      className={cn(
        "grid h-9 w-9 place-items-center rounded-lg border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
        className,
      )}
    >
      <Search className="h-4 w-4" />
    </button>
  );
}
