import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { searchAccessUsers, type AccessUser } from "@/lib/api/access-api";

/**
 * Searchable, multi-select user picker. Search runs server-side (debounced) because the user
 * table is unbounded — filtering a fetched page client-side would silently hide most accounts.
 *
 * Selected users are held in full (not just ids) so chips stay labelled even after the search
 * query changes and the matching result drops out of the current page.
 */
export function UserMultiSelect({
  selected,
  onChange,
  max = 50,
}: {
  selected: AccessUser[];
  onChange: (users: AccessUser[]) => void;
  max?: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const usersQuery = useQuery({
    queryKey: ["access-user-search", debounced],
    queryFn: () => searchAccessUsers(debounced),
    enabled: open,
  });

  const selectedIds = new Set(selected.map((u) => u.id));

  const toggle = (user: AccessUser) => {
    if (selectedIds.has(user.id)) {
      onChange(selected.filter((u) => u.id !== user.id));
    } else if (selected.length < max) {
      onChange([...selected, user]);
    }
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="truncate text-muted-foreground">
              {selected.length === 0
                ? "Search users by email or name…"
                : `${selected.length} user${selected.length === 1 ? "" : "s"} selected`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search users…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {usersQuery.isLoading ? (
                <div className="py-6 text-center text-sm text-muted-foreground">Searching…</div>
              ) : (usersQuery.data?.items.length ?? 0) === 0 ? (
                <CommandEmpty>No users found.</CommandEmpty>
              ) : (
                <CommandGroup>
                  {usersQuery.data!.items.map((user) => (
                    <CommandItem
                      key={user.id}
                      value={user.id}
                      onSelect={() => toggle(user)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 shrink-0",
                          selectedIds.has(user.id) ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="min-w-0">
                        <span className="block truncate">{user.email}</span>
                        {user.name && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {user.name}
                          </span>
                        )}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((user) => (
            <Badge key={user.id} variant="outline" className="gap-1 pr-1 font-normal">
              <span className="max-w-[180px] truncate">{user.email}</span>
              <button
                type="button"
                aria-label={`Remove ${user.email}`}
                className="rounded-sm p-0.5 hover:bg-muted"
                onClick={() => onChange(selected.filter((u) => u.id !== user.id))}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {selected.length > 1 && (
            <button
              type="button"
              className="text-xs text-muted-foreground underline underline-offset-2"
              onClick={() => onChange([])}
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
