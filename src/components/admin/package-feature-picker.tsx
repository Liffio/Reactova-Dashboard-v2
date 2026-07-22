import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/admin/form-page";
import { getRegistryTree } from "@/lib/api/registry-api";
import type { FeatureSelection } from "@/hooks/use-package-features";

/**
 * The package contents picker: modules as sections, sub-functions as checkboxes.
 *
 * The registry tree is fetched whole here on purpose. It is bounded by the size of the product
 * rather than by tenant data, an operator needs to see all of it to compose a package, and
 * paginating a checklist would make "select all" mean something different on every page. The
 * filter below is a client-side narrowing of that already-loaded tree — it is not a search over
 * tenant records, and it deliberately does not page.
 */

export function PackageFeaturePicker({
  parents,
  setParents,
  children,
  setChildren,
  onSelectionChange,
}: {
  parents: Set<string>;
  setParents: React.Dispatch<React.SetStateAction<Set<string>>>;
  children: Set<string>;
  setChildren: React.Dispatch<React.SetStateAction<Set<string>>>;
  /** Called with the flattened selection whenever it changes, ready to POST. */
  onSelectionChange?: (selection: FeatureSelection[]) => void;
}) {
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const treeQuery = useQuery({
    queryKey: ["registry-tree"],
    queryFn: getRegistryTree,
    staleTime: 5 * 60 * 1000,
  });

  // Only enabled modules can be sold — offering a disabled one would promise something the API
  // masks to 404 the moment a customer touches it.
  const tree = useMemo(
    () => (treeQuery.data?.modules ?? []).filter((m) => m.isEnabled),
    [treeQuery.data],
  );

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return tree;
    return tree
      .map((parent) => {
        const parentHit =
          parent.name.toLowerCase().includes(q) || parent.key.toLowerCase().includes(q);
        const matched = parent.children.filter(
          (c) => c.name.toLowerCase().includes(q) || c.key.toLowerCase().includes(q),
        );
        if (parentHit) return parent;
        if (matched.length > 0) return { ...parent, children: matched };
        return null;
      })
      .filter((p): p is (typeof tree)[number] => p !== null);
  }, [tree, filter]);

  const selection = useMemo(() => {
    const out: FeatureSelection[] = [];
    for (const parent of tree) {
      const picked = parent.children.filter((c) => children.has(c.key));
      if (picked.length > 0) {
        picked.forEach((c) => out.push({ parentKey: parent.key, childKey: c.key }));
      } else if (parents.has(parent.key)) {
        // Module granted with no sub-functions inside it — a valid, deliberate state.
        out.push({ parentKey: parent.key, childKey: null });
      }
    }
    return out;
  }, [tree, parents, children]);

  // Report upward so the parent form can save without re-deriving the tree it does not hold.
  // Keyed on the serialised selection rather than the array, which is a fresh object every render
  // and would otherwise fire this on every keystroke in an unrelated field.
  const selectionKey = JSON.stringify(selection);
  useEffect(() => {
    onSelectionChange?.(selection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey]);

  const toggleChild = (parentKey: string, childKey: string) => {
    setChildren((prev) => {
      const next = new Set(prev);
      if (next.has(childKey)) next.delete(childKey);
      else {
        next.add(childKey);
        // Ticking a sub-function implies its module; without that the customer would own a
        // capability inside a product area they cannot open.
        setParents((p) => new Set(p).add(parentKey));
      }
      return next;
    });
  };

  const toggleParent = (parentKey: string, childKeys: string[]) => {
    const allOn = childKeys.length > 0 && childKeys.every((k) => children.has(k));
    setParents((prev) => {
      const next = new Set(prev);
      if (allOn && next.has(parentKey)) next.delete(parentKey);
      else next.add(parentKey);
      return next;
    });
    setChildren((prev) => {
      const next = new Set(prev);
      childKeys.forEach((k) => (allOn ? next.delete(k) : next.add(k)));
      return next;
    });
  };

  const selectAll = () => {
    setParents(new Set(tree.map((p) => p.key)));
    setChildren(new Set(tree.flatMap((p) => p.children.map((c) => c.key))));
  };

  const clearAll = () => {
    setParents(new Set());
    setChildren(new Set());
  };

  if (treeQuery.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Filter modules and sub-functions…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <Button type="button" size="sm" variant="outline" onClick={selectAll}>
          Select all
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={clearAll}>
          Clear
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={Search} title="Nothing matches that filter." />
      ) : (
        <div className="space-y-2">
          {visible.map((parent) => {
            const childKeys = parent.children.map((c) => c.key);
            const on = childKeys.filter((k) => children.has(k)).length;
            const state: boolean | "indeterminate" =
              on === 0 ? parents.has(parent.key) : on === childKeys.length ? true : "indeterminate";
            // A filter match opens the section — hiding the row that matched would be perverse.
            const isOpen = expanded.has(parent.key) || filter.trim().length > 0;

            return (
              <div key={parent.key} className="rounded-xl border bg-card">
                <div className="flex items-center gap-2 p-3">
                  <Checkbox
                    checked={state}
                    onCheckedChange={() => toggleParent(parent.key, childKeys)}
                    aria-label={parent.name}
                  />
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                    onClick={() =>
                      setExpanded((prev) => {
                        const next = new Set(prev);
                        if (next.has(parent.key)) next.delete(parent.key);
                        else next.add(parent.key);
                        return next;
                      })
                    }
                  >
                    <ChevronRight
                      className={`h-3.5 w-3.5 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
                    />
                    <span className="truncate text-sm font-medium">{parent.name}</span>
                    <Badge variant="outline" className="ml-1 shrink-0 font-normal">
                      {on}/{childKeys.length}
                    </Badge>
                  </button>
                </div>

                {isOpen && childKeys.length > 0 && (
                  <div className="grid gap-1.5 border-t bg-muted/20 p-3 sm:grid-cols-2">
                    {parent.children.map((child) => (
                      <label
                        key={child.key}
                        className="flex cursor-pointer items-start gap-2 rounded-lg bg-card p-2 text-sm hover:bg-muted/50"
                      >
                        <Checkbox
                          className="mt-0.5"
                          checked={children.has(child.key)}
                          onCheckedChange={() => toggleChild(parent.key, child.key)}
                          aria-label={child.name}
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{child.name}</span>
                          {child.description && (
                            <span className="block text-xs text-muted-foreground">
                              {child.description}
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
