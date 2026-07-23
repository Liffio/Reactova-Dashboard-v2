import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ChevronRight, Package as PackageIcon, Plus, Search } from "lucide-react";
import { toast } from "@/lib/toast";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformPermissionRoute } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationBar } from "@/components/ui/pagination-bar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CopyableKey, EmptyState } from "@/components/admin/form-page";
import { useDebounced } from "@/hooks/use-debounced";
import {
  archivePackage,
  listPackages,
  updatePackage,
  type PackageRow,
} from "@/lib/api/registry-api";

const PACKAGE_MANAGE = "platform:package_manage";
const PAGE_SIZE = 20;

const money = (cents: number | null | undefined, symbol = "$") =>
  cents == null ? "—" : `${symbol}${(cents / 100).toFixed(2)}`;

export const Route = createFileRoute("/_app/packages/")({
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
        description="Build and price what you sell. Contents come straight from the module registry."
        actions={
          <Button
            size="sm"
            asChild
            className="gap-1.5 bg-brand-gradient text-primary-foreground shadow-glow hover:opacity-95"
          >
            <Link to="/packages/new">
              <Plus className="h-3.5 w-3.5" />
              New package
            </Link>
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
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <EmptyState
            icon={PackageIcon}
            title={debouncedSearch ? "No packages match that search." : "No packages yet."}
          >
            {!debouncedSearch && "Create one to start selling."}
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {data!.items.map((pkg) => (
              <PackageCard key={pkg.id} pkg={pkg} onChanged={refresh} />
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
    </div>
  );
}

function PackageCard({ pkg, onChanged }: { pkg: PackageRow; onChanged: () => void }) {
  const navigate = useNavigate();
  const [confirmArchive, setConfirmArchive] = useState(false);

  const open = () => void navigate({ to: "/packages/$packageId", params: { packageId: pkg.id } });

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
      setConfirmArchive(false);
      onChanged();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        }}
        className={`cursor-pointer rounded-2xl border bg-card p-4 shadow-soft transition-colors hover:border-primary/40 hover:bg-muted/30 sm:p-5 ${
          pkg.isActive ? "" : "opacity-60"
        }`}
      >
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

            <div className="mt-1">
              <CopyableKey value={pkg.humanId} />
            </div>

            {pkg.description && (
              <p className="mt-2 text-sm text-muted-foreground">{pkg.description}</p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {money(pkg.monthlyPriceUsdCents)}
                <span className="font-normal text-muted-foreground">/mo</span>
              </span>
              {pkg.monthlyPriceInrPaise != null && (
                <span>₹{(pkg.monthlyPriceInrPaise / 100).toFixed(2)}/mo</span>
              )}
              <span>·</span>
              <span>
                {pkg.moduleCount} module{pkg.moduleCount === 1 ? "" : "s"}, {pkg.featureCount}{" "}
                feature
                {pkg.featureCount === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <div
            className="flex shrink-0 flex-wrap items-center gap-2"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Active
              <Switch checked={pkg.isActive} onCheckedChange={() => toggleActive.mutate()} />
            </label>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmArchive(true)}
              aria-label={`Archive ${pkg.name}`}
            >
              <Archive className="h-3.5 w-3.5" />
            </Button>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </div>

      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {pkg.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              It stops being offered and disappears from this list. Workspaces already on it are not
              changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archive.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={archive.isPending}
              onClick={(e) => {
                e.preventDefault();
                archive.mutate();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {archive.isPending ? "Archiving…" : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
