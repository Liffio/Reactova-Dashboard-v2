import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ChevronRight, Copy, Package as PackageIcon, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformPermissionRoute } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationBar } from "@/components/ui/pagination-bar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDebounced } from "@/hooks/use-debounced";
import {
  archivePackage,
  createPackage,
  getPackage,
  getRegistryTree,
  listPackages,
  setPackageFeatures,
  updatePackage,
  type PackageRow,
} from "@/lib/api/registry-api";

const PACKAGE_MANAGE = "platform:package_manage";
const PAGE_SIZE = 20;

const money = (cents: number | null | undefined, symbol = "$") =>
  cents == null ? "—" : `${symbol}${(cents / 100).toFixed(2)}`;

export const Route = createFileRoute("/_app/packages")({
  head: () => ({ meta: [{ title: "Packages — Admin" }] }),
  component: PackagesRoute,
});

function PackagesRoute() {
  return (
    <PlatformPermissionRoute permission={PACKAGE_MANAGE}>
      <PackagesPage />
    </PlatformPermissionRoute>
  );
}

function PackagesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const debouncedSearch = useDebounced(search);
  useEffect(() => setPage(1), [debouncedSearch]);

  const listQuery = useQuery({
    queryKey: ["packages", debouncedSearch, page],
    // Search and paging happen in SQL — this only ever holds one page.
    queryFn: () => listPackages({ q: debouncedSearch || undefined, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["packages"] });
    void queryClient.invalidateQueries({ queryKey: ["package-detail"] });
  };

  const data = listQuery.data;

  return (
    <div>
      <PageHeader
        eyebrow="Platform admin"
        title="Packages"
        description="Build and price what you sell. Features come straight from the module registry."
        actions={
          <Button
            size="sm"
            className="gap-1.5 bg-brand-gradient text-primary-foreground shadow-glow hover:opacity-95"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            New package
          </Button>
        }
      />

      <div className="space-y-4 p-4 sm:p-6 md:p-10">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search packages…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {listQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card/50 p-10 text-center">
            <PackageIcon className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {debouncedSearch ? "No packages match that search." : "No packages yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {data!.items.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                onEdit={() => setSelectedId(pkg.id)}
                onChanged={refresh}
              />
            ))}
          </div>
        )}

        {data && (
          <PaginationBar
            page={data.page}
            pages={data.pages}
            total={data.total}
            limit={data.limit}
            onPageChange={setPage}
            label="packages"
          />
        )}
      </div>

      <CreatePackageDialog open={createOpen} onOpenChange={setCreateOpen} onSuccess={refresh} />
      <PackageBuilderDialog
        packageId={selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onSuccess={refresh}
      />
    </div>
  );
}

function PackageCard({
  pkg,
  onEdit,
  onChanged,
}: {
  pkg: PackageRow;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const toggleActive = useMutation({
    mutationFn: () => updatePackage(pkg.id, { isActive: !pkg.isActive }),
    onSuccess: () => {
      toast.success(pkg.isActive ? "Package deactivated" : "Package activated");
      onChanged();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const archive = useMutation({
    mutationFn: () => archivePackage(pkg.id),
    onSuccess: () => {
      toast.success("Package archived");
      onChanged();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className={`rounded-2xl border bg-card p-4 shadow-soft sm:p-5 ${pkg.isActive ? "" : "opacity-60"}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display font-semibold">{pkg.name}</span>
            {pkg.badge && (
              <Badge className="border-primary/40 bg-primary/10 text-primary" variant="outline">
                {pkg.badge}
              </Badge>
            )}
            {pkg.isPublic && <Badge variant="outline">Public</Badge>}
            {!pkg.isActive && <Badge variant="outline">Inactive</Badge>}
          </div>

          <button
            type="button"
            title="Copy package ID"
            className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => {
              void navigator.clipboard.writeText(pkg.humanId).then(
                () => toast.success("Package ID copied"),
                () => toast.message(pkg.humanId)
              );
            }}
          >
            {pkg.humanId}
            <Copy className="h-3 w-3 opacity-60" />
          </button>

          {pkg.description && (
            <p className="mt-2 text-sm text-muted-foreground">{pkg.description}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {money(pkg.monthlyPriceUsdCents)}
              <span className="font-normal text-muted-foreground">/mo</span>
            </span>
            {pkg.monthlyPriceInrPaise != null && <span>₹{(pkg.monthlyPriceInrPaise / 100).toFixed(2)}/mo</span>}
            <span>·</span>
            <span>
              {pkg.moduleCount} module{pkg.moduleCount === 1 ? "" : "s"}, {pkg.featureCount} feature
              {pkg.featureCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Active
            <Switch checked={pkg.isActive} onCheckedChange={() => toggleActive.mutate()} />
          </label>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onEdit}>
            Features
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => archive.mutate()}
          >
            <Archive className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function CreatePackageDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [usd, setUsd] = useState("");
  const [inr, setInr] = useState("");
  const [badge, setBadge] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    if (!open) {
      setName(""); setDescription(""); setUsd(""); setInr(""); setBadge(""); setIsPublic(false);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      createPackage({
        name: name.trim(),
        description: description.trim() || null,
        // Prices are entered in major units but stored in minor units, so nothing rounds badly.
        monthlyPriceUsdCents: usd ? Math.round(Number(usd) * 100) : 0,
        monthlyPriceInrPaise: inr ? Math.round(Number(inr) * 100) : null,
        badge: badge.trim() || null,
        isPublic,
      }),
    onSuccess: () => {
      toast.success("Package created");
      onOpenChange(false);
      onSuccess();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New package</DialogTitle>
          <DialogDescription>
            Name and price it now; pick its features next. A readable package ID is assigned
            automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Growth Pro" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Description</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Who this package is for."
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Monthly (USD)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={usd}
                onChange={(e) => setUsd(e.target.value)}
                placeholder="49.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Monthly (INR)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={inr}
                onChange={(e) => setInr(e.target.value)}
                placeholder="3999.00"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Badge</Label>
            <Input value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="Most popular" />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm">Show on the public pricing page</span>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!name.trim() || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Creating…" : "Create package"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The feature checklist: parent modules as expandable sections, child modules as checkboxes.
 *
 * The registry tree is fetched whole here on purpose — it is bounded by the size of the product
 * (tens of modules), the operator needs to see all of it to compose a package, and paginating a
 * checklist would make "select all" mean something different on every page.
 */
function PackageBuilderDialog({
  packageId,
  onOpenChange,
  onSuccess,
}: {
  packageId: string | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const treeQuery = useQuery({
    queryKey: ["registry-tree"],
    queryFn: getRegistryTree,
    enabled: !!packageId,
    staleTime: 5 * 60 * 1000,
  });

  const detailQuery = useQuery({
    queryKey: ["package-detail", packageId],
    queryFn: () => getPackage(packageId!),
    enabled: !!packageId,
  });

  const [parents, setParents] = useState<Set<string>>(new Set());
  const [children, setChildren] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!detailQuery.data) return;
    setParents(new Set(detailQuery.data.features.map((f) => f.parentKey)));
    setChildren(
      new Set(detailQuery.data.features.filter((f) => f.childKey).map((f) => f.childKey!))
    );
  }, [detailQuery.data]);

  const tree = treeQuery.data?.modules ?? [];

  const toggleChild = (parentKey: string, childKey: string) => {
    setChildren((prev) => {
      const next = new Set(prev);
      if (next.has(childKey)) next.delete(childKey);
      else {
        next.add(childKey);
        // Ticking any capability implies the module itself is in the package; without that the
        // customer would own a feature inside a product area they cannot open.
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

  const selection = useMemo(() => {
    const out: Array<{ parentKey: string; childKey: string | null }> = [];
    for (const parent of tree) {
      const picked = parent.children.filter((c) => children.has(c.key));
      if (picked.length > 0) {
        picked.forEach((c) => out.push({ parentKey: parent.key, childKey: c.key }));
      } else if (parents.has(parent.key)) {
        // Module granted with no capabilities inside it — a valid, deliberate state.
        out.push({ parentKey: parent.key, childKey: null });
      }
    }
    return out;
  }, [tree, parents, children]);

  const save = useMutation({
    mutationFn: () => setPackageFeatures(packageId!, selection),
    onSuccess: () => {
      toast.success("Package features saved");
      onOpenChange(false);
      onSuccess();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const loading = treeQuery.isLoading || detailQuery.isLoading;

  return (
    <Dialog open={!!packageId} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{detailQuery.data?.name ?? "Package"} — features</DialogTitle>
          <DialogDescription>
            Tick the modules and sub-functions this package includes. Ticking a sub-function
            includes its module automatically.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
            {tree.map((parent) => {
              const childKeys = parent.children.map((c) => c.key);
              const on = childKeys.filter((k) => children.has(k)).length;
              const state: boolean | "indeterminate" =
                on === 0 ? parents.has(parent.key) : on === childKeys.length ? true : "indeterminate";
              const isOpen = expanded.has(parent.key);

              return (
                <div key={parent.key} className="rounded-xl border">
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

        <DialogFooter className="items-center justify-between gap-2 sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {selection.filter((s) => s.childKey).length} feature(s) across{" "}
            {new Set(selection.map((s) => s.parentKey)).size} module(s)
          </span>
          <span className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={save.isPending || loading} onClick={() => save.mutate()}>
              {save.isPending ? "Saving…" : "Save features"}
            </Button>
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
