import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { globalSearch, type SearchHit } from "@/lib/api/search-api";
import { OPEN_SEARCH_EVENT } from "@/lib/global-search-events";
import { useDebounced } from "@/hooks/use-debounced";
import { useApp } from "@/state/app-context";
import { cn } from "@/lib/utils";

/**
 * The ⌘K palette. Mounted once, at the layout root.
 *
 * ## Nothing here knows what a module is
 *
 * Groups, their order, their labels and where each hit links all arrive from the server, which
 * builds them from the module registry and filters them by the caller's permissions. So this file
 * names no resource, hides nothing conditionally, and needs no change when a searchable module is
 * added — which is the same reason the sidebar is a registry query rather than a list in the
 * bundle.
 *
 * ## The minimum term length is learned, not assumed
 *
 * The server refuses to query below a threshold that exists for a concrete reason — pg_trgm cannot
 * form a trigram from fewer characters, so every branch would become a sequential scan. That
 * number belongs to the database, not to this component, so it is read off the first response and
 * only then used to skip requests locally. Until it is known the request goes out and the server
 * short-circuits it without touching a table, which costs a round trip exactly once per session
 * and keeps the constant in one place.
 */

const DEBOUNCE_MS = 200;

export function GlobalSearchPalette() {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const trimmed = term.trim();
  const settled = useDebounced(trimmed, DEBOUNCE_MS);
  /**
   * Clearing is deliberately not debounced. `close()` and a workspace switch both blank the
   * field, and a term that outlived either by one delay would reopen the palette on the
   * previous search, or fire a query for the old tenant's term against the new workspace.
   */
  const debounced = trimmed === "" ? "" : settled;
  const { current } = useApp();
  const navigate = useNavigate();

  /**
   * Server-owned, learned from the first response that reports it. `null` means "not yet known",
   * which is deliberately different from zero: it lets the first short term through so the server
   * can tell us the answer.
   */
  const [minTermLength, setMinTermLength] = useState<number | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setTerm("");
  }, []);

  // Both triggers dispatch the same DOM event, and the keyboard shortcut takes the same path, so
  // there is one way in rather than three that can drift.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      setOpen((was) => !was);
    };

    window.addEventListener(OPEN_SEARCH_EVENT, onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // Switching workspace mid-search would otherwise leave the previous tenant's hits on screen
  // until the next keystroke. The query is keyed by workspace too, so nothing is served from the
  // wrong cache entry either.
  useEffect(() => {
    setTerm("");
  }, [current.id]);

  const tooShort = minTermLength !== null && debounced.length < minTermLength;

  const search = useQuery({
    queryKey: ["global-search", current.id, debounced],
    queryFn: ({ signal }) => globalSearch(debounced, signal),
    enabled: open && debounced.length > 0 && !tooShort,
    staleTime: 30_000,
  });

  const reported = search.data?.minTermLength;
  useEffect(() => {
    if (reported !== undefined) setMinTermLength(reported);
  }, [reported]);

  const groups = search.data?.groups ?? [];
  const onSelect = (hit: SearchHit) => {
    close();
    void navigate({ to: hit.route as never });
  };

  return (
    // The server did the matching, against columns this client cannot see, so cmdk's own
    // filter is off — see the note on `CommandDialog`.
    <CommandDialog
      open={open}
      shouldFilter={false}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
    >
      <CommandInput
        value={term}
        onValueChange={setTerm}
        placeholder="Search automations, leads, links…"
      />
      <CommandList>
        <Status
          term={debounced}
          tooShort={tooShort}
          minTermLength={minTermLength}
          loading={search.isFetching}
          failed={search.isError}
          empty={search.isSuccess && groups.length === 0}
        />

        {groups.map((group) => (
          <CommandGroup key={group.key} heading={group.label}>
            {group.items.map((hit) => (
              <CommandItem
                key={`${group.key}:${hit.id}`}
                // cmdk keys selection off `value`; two hits sharing a title would otherwise
                // highlight together and Enter would pick whichever cmdk saw first.
                value={`${group.key}:${hit.id}`}
                onSelect={() => onSelect(hit)}
                className="gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className={cn("truncate text-sm", !hit.title && "text-muted-foreground")}>
                    {/* A scheduled post with no caption has no title. Saying so is better than
                        showing an id or an empty row. */}
                    {hit.title || "Untitled"}
                  </div>
                  {hit.subtitle ? (
                    <div className="truncate text-xs text-muted-foreground">{hit.subtitle}</div>
                  ) : null}
                </div>
                {hit.badge ? (
                  <span className="shrink-0 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                    {hit.badge}
                  </span>
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

/**
 * The empty state, which is four different states wearing one coat.
 *
 * `CommandEmpty` only renders when cmdk has no items, which is exactly when each of these applies.
 * Distinguishing them matters: "keep typing" and "nothing matched" look identical to a user who is
 * told neither, and the first one is not a failed search.
 */
function Status({
  term,
  tooShort,
  minTermLength,
  loading,
  failed,
  empty,
}: {
  term: string;
  tooShort: boolean;
  minTermLength: number | null;
  loading: boolean;
  failed: boolean;
  empty: boolean;
}) {
  if (!term) return <CommandEmpty>Search across your workspace.</CommandEmpty>;
  if (tooShort)
    return <CommandEmpty>Keep typing — at least {minTermLength} characters.</CommandEmpty>;
  if (loading) return <CommandEmpty>Searching…</CommandEmpty>;
  if (failed) return <CommandEmpty>Search is unavailable right now.</CommandEmpty>;
  if (empty) return <CommandEmpty>No matches for “{term}”.</CommandEmpty>;
  return null;
}
