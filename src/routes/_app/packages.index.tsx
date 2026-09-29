import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArrowDownUp,
  Check,
  ChevronDown,
  ChevronRight,
  Globe,
  LayoutGrid,
  Layers,
  Lock,
  Package as PackageIcon,
  PackageCheck,
  Plus,
  Rows3,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "@/lib/toast";

import { PageHeader } from "@/components/dashboard/page-header";
import { PackageLadder } from "@/components/admin/package-ladder";
import { PlatformPermissionRoute } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { ConfirmCodeDialog, useConfirmCode } from "@/components/admin/confirm-code";
import { useDebounced } from "@/hooks/use-debounced";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  archivePackage,
  listPackages,
  updatePackage,
  type PackageRow,
} from "@/lib/api/registry-api";

const PACKAGE_MANAGE = "platform:package_manage";
/**
 * The server's ceiling for one page. The catalogue is tens of packages, so this loads all of it and
 * lets sorting, filtering and counting happen instantly on the client; the pagination bar only
 * appears if the catalogue ever outgrows one page.
 */
const PAGE_SIZE = 100;

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

/* ─── Display preferences ─────────────────────────────────────────────────────────────────── */

type Layout = "cards" | "rows";
type SortKey = "tier" | "price-asc" | "price-desc" | "name" | "features" | "newest";
type Property = "description" | "badge" | "packageId" | "inr" | "contents" | "created";

type DisplayPrefs = {
  layout: Layout;
  columns: 2 | 3 | 4;
  sort: SortKey;
  properties: Record<Property, boolean>;
};

const DEFAULT_PREFS: DisplayPrefs = {
  layout: "cards",
  columns: 3,
  sort: "tier",
  properties: {
    description: true,
    badge: true,
    packageId: true,
    inr: true,
    contents: true,
    created: false,
  },
};

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: "tier", label: "Tier order" },
  { key: "price-asc", label: "Price: low to high" },
  { key: "price-desc", label: "Price: high to low" },
  { key: "features", label: "Most features" },
  { key: "name", label: "Name (A–Z)" },
  { key: "newest", label: "Newest first" },
];

const PROPERTIES: Array<{ key: Property; label: string }> = [
  { key: "description", label: "Description" },
  { key: "badge", label: "Badge" },
  { key: "packageId", label: "Package ID" },
  { key: "inr", label: "INR price" },
  { key: "contents", label: "Contents" },
  { key: "created", label: "Created" },
];

/**
 * Stored preferences merged over the defaults, so a preference saved by an older build (missing a
 * key, or with a value this build no longer offers) can never break the page.
 */
function normalizePrefs(raw: Partial<DisplayPrefs> | null | undefined): DisplayPrefs {
  const layout = raw?.layout === "rows" ? "rows" : "cards";
  const columns = raw?.columns === 2 || raw?.columns === 4 ? raw.columns : 3;
  const sort = SORTS.some((s) => s.key === raw?.sort) ? (raw!.sort as SortKey) : "tier";
  return {
    layout,
    columns,
    sort,
    properties: { ...DEFAULT_PREFS.properties, ...(raw?.properties ?? {}) },
  };
}

type Segment = "all" | "active" | "inactive" | "public" | "private";

const SEGMENTS: Array<{ key: Segment; label: string; test: (p: PackageRow) => boolean }> = [
  { key: "all", label: "All", test: () => true },
  { key: "active", label: "Active", test: (p) => p.isActive },
  { key: "inactive", label: "Inactive", test: (p) => !p.isActive },
  { key: "public", label: "Public", test: (p) => p.isPublic },
  { key: "private", label: "Private", test: (p) => !p.isPublic },
];

function sortPackages(items: PackageRow[], sort: SortKey): PackageRow[] {
  const byTier = (a: PackageRow, b: PackageRow) =>
    a.sortOrder - b.sortOrder || a.monthlyPriceUsdCents - b.monthlyPriceUsdCents;
  const sorted = [...items];
  switch (sort) {
    case "tier":
      return sorted.sort(byTier);
    case "price-asc":
      return sorted.sort((a, b) => a.monthlyPriceUsdCents - b.monthlyPriceUsdCents || byTier(a, b));
    case "price-desc":
      return sorted.sort((a, b) => b.monthlyPriceUsdCents - a.monthlyPriceUsdCents || byTier(a, b));
    case "features":
      return sorted.sort((a, b) => b.featureCount - a.featureCount || byTier(a, b));
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "newest":
      return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

const usd = (cents: number) =>
  cents === 0
    ? "Free"
    : `$${(cents / 100).toLocaleString(undefined, {
        minimumFractionDigits: cents % 100 ? 2 : 0,
        maximumFractionDigits: 2,
      })}`;
const inr = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/* ─── Page ────────────────────────────────────────────────────────────────────────────────── */

function PackagesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [segment, setSegment] = useState<Segment>("all");
  const [storedPrefs, setStoredPrefs] = usePersistedState<Partial<DisplayPrefs> | null>(
    "admin.packages.display.v1",
    null,
  );
  const prefs = normalizePrefs(storedPrefs);
  const setPrefs = (next: DisplayPrefs) => setStoredPrefs(next);

  const debouncedSearch = useDebounced(search);
  useEffect(() => setPage(1), [debouncedSearch]);

  const listQuery = useQuery({
    queryKey: ["packages", debouncedSearch, page],
    queryFn: () => listPackages({ q: debouncedSearch || undefined, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["packages"] });
    void queryClient.invalidateQueries({ queryKey: ["package-detail"] });
  };

  const data = listQuery.data;
  const loaded = useMemo(() => data?.items ?? [], [data]);
  const segmentTest = SEGMENTS.find((s) => s.key === segment)!.test;
  const visible = useMemo(
    () => sortPackages(loaded.filter(segmentTest), prefs.sort),
    [loaded, segmentTest, prefs.sort],
  );
  /** Bar length for the contents meter — relative to the richest package on screen. */
  const maxFeatures = Math.max(1, ...loaded.map((p) => p.featureCount));

  return (
    <div>
      <PageHeader
        eyebrow="Platform admin"
        title="Packages"
        description="Build and price what you sell. Contents come straight from the module registry."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Composing a package and applying it are separate jobs, so both are reachable from
                here. Assigning is the one that makes a package do anything at all. */}
            <Button size="sm" variant="outline" asChild className="gap-1.5">
              <Link to="/packages/assign">
                <PackageCheck className="h-3.5 w-3.5" />
                Assign to workspace
              </Link>
            </Button>
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
          </div>
        }
      />

      <div className="space-y-5 p-4 sm:p-6 md:p-8">
        <CatalogStats items={loaded} loading={listQuery.isLoading} />

        {/* The ordering the save path holds these packages to, shown where they are listed.
            Collapsed by default — it is reference, not something to read on every visit. */}
        <LadderPanel />

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b pb-2">
            <div className="-mx-1 flex gap-1 overflow-x-auto px-1" aria-label="Filter packages">
              {SEGMENTS.map((s) => {
                const count = loaded.filter(s.test).length;
                const active = segment === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSegment(s.key)}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                      active
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {s.label}
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-[10px] tabular-nums",
                        active ? "bg-background/20" : "bg-muted",
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:max-w-sm sm:flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 rounded-lg pl-9"
                placeholder="Search packages"
                aria-label="Search packages"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <LayoutSwitch
                value={prefs.layout}
                onChange={(layout) => setPrefs({ ...prefs, layout })}
              />
              <DisplayMenu prefs={prefs} onChange={setPrefs} />
            </div>
          </div>
        </div>

        {listQuery.isLoading ? (
          <div className={gridClass(prefs)}>
            {Array.from({ length: prefs.layout === "cards" ? 6 : 5 }).map((_, i) => (
              <Skeleton
                key={i}
                className={prefs.layout === "cards" ? "h-64 rounded-2xl" : "h-16 rounded-xl"}
              />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={PackageIcon}
            title={debouncedSearch || segment !== "all" ? "No packages match." : "No packages yet."}
          >
            {debouncedSearch || segment !== "all"
              ? "Try another search or filter."
              : "Create one to start selling."}
          </EmptyState>
        ) : (
          <div
            className={cn(
              gridClass(prefs),
              listQuery.isFetching && "opacity-70 transition-opacity",
            )}
          >
            {visible.map((pkg) =>
              prefs.layout === "cards" ? (
                <PackageTile
                  key={pkg.id}
                  pkg={pkg}
                  props={prefs.properties}
                  maxFeatures={maxFeatures}
                  onChanged={refresh}
                />
              ) : (
                <PackageLine key={pkg.id} pkg={pkg} props={prefs.properties} onChanged={refresh} />
              ),
            )}
          </div>
        )}

        {data && data.pages > 1 && (
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

function gridClass(prefs: DisplayPrefs): string {
  if (prefs.layout === "rows") return "space-y-2";
  return cn(
    "grid gap-4 sm:grid-cols-2",
    prefs.columns === 3 && "xl:grid-cols-3",
    prefs.columns === 4 && "lg:grid-cols-3 2xl:grid-cols-4",
  );
}

/* ─── Stats ───────────────────────────────────────────────────────────────────────────────── */

function CatalogStats({ items, loading }: { items: PackageRow[]; loading: boolean }) {
  if (loading) return <Skeleton className="h-[84px] rounded-2xl" />;
  const paid = items.filter((p) => p.monthlyPriceUsdCents > 0).map((p) => p.monthlyPriceUsdCents);
  const stats: Array<{ label: string; value: string; hint?: string }> = [
    { label: "Packages", value: String(items.length) },
    { label: "Active", value: String(items.filter((p) => p.isActive).length) },
    { label: "Public", value: String(items.filter((p) => p.isPublic).length) },
    {
      label: "Price range",
      value: paid.length ? `${usd(Math.min(...paid))} – ${usd(Math.max(...paid))}` : "—",
      hint: "Monthly USD, paid packages",
    },
  ];
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-2xl border bg-card shadow-soft md:grid-cols-4">
      {stats.map((s, i) => (
        <div
          key={s.label}
          title={s.hint}
          className={cn(
            "min-w-0 p-4",
            i % 2 === 1 && "border-l",
            i >= 2 && "border-t md:border-t-0",
            i === 2 && "md:border-l",
          )}
        >
          <p className="text-xs text-muted-foreground">{s.label}</p>
          <p className="mt-1 truncate text-2xl font-semibold tabular-nums">{s.value}</p>
        </div>
      ))}
    </div>
  );
}

/* ─── Display controls ────────────────────────────────────────────────────────────────────── */

function LayoutSwitch({ value, onChange }: { value: Layout; onChange: (l: Layout) => void }) {
  return (
    <div
      className="inline-flex rounded-lg border bg-card p-0.5"
      role="radiogroup"
      aria-label="Layout"
    >
      {(
        [
          { key: "cards", label: "Cards", icon: LayoutGrid },
          { key: "rows", label: "Rows", icon: Rows3 },
        ] as const
      ).map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          title={label}
          onClick={() => onChange(key)}
          className={cn(
            "grid h-7 w-8 place-items-center rounded-md transition-colors",
            value === key
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}

/** Lightfield-style "Display" popover: sorting, card density, and which properties show. */
function DisplayMenu({
  prefs,
  onChange,
}: {
  prefs: DisplayPrefs;
  onChange: (p: DisplayPrefs) => void;
}) {
  const customized = JSON.stringify(prefs) !== JSON.stringify(DEFAULT_PREFS);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Display
          {customized && (
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="customized" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4">
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ArrowDownUp className="h-3.5 w-3.5" /> Sort by
          </p>
          <div className="grid grid-cols-2 gap-1">
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => onChange({ ...prefs, sort: s.key })}
                className={cn(
                  "flex items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                  prefs.sort === s.key ? "bg-muted font-medium" : "hover:bg-muted/60",
                )}
              >
                {s.label}
                {prefs.sort === s.key && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            ))}
          </div>
        </div>

        {prefs.layout === "cards" && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Cards per row (wide screens)
            </p>
            <div className="inline-flex rounded-lg border p-0.5">
              {([2, 3, 4] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onChange({ ...prefs, columns: n })}
                  className={cn(
                    "h-7 w-10 rounded-md text-xs font-medium transition-colors",
                    prefs.columns === n
                      ? "bg-muted"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Show on each package</p>
          <div className="flex flex-wrap gap-1.5">
            {PROPERTIES.map((p) => {
              const on = prefs.properties[p.key];
              return (
                <button
                  key={p.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    onChange({ ...prefs, properties: { ...prefs.properties, [p.key]: !on } })
                  }
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    on
                      ? "border-foreground/20 bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-[11px] text-muted-foreground">Saved for you on this browser</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            disabled={!customized}
            onClick={() => onChange(DEFAULT_PREFS)}
          >
            Reset
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ─── Actions shared by both layouts ──────────────────────────────────────────────────────── */

/**
 * Activate/deactivate and archive, with their dialogs.
 *
 * `isActive` is one of S0.11's structural PATCH fields, so the toggle always steps up — there is no
 * unguarded version of it to fall back to. It is also the one guarded call site the compiler cannot
 * catch: `updatePackage`'s `confirmCode` has to stay optional for the name-and-description saves
 * that legitimately go without one.
 */
function usePackageActions(pkg: PackageRow, onChanged: () => void) {
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const toggleCode = useConfirmCode();
  const [toggleError, setToggleError] = useState<string | null>(null);

  const closeToggle = () => {
    setConfirmToggle(false);
    setToggleError(null);
    toggleCode.reset();
  };

  const toggleActive = useMutation({
    mutationFn: (confirmCode: string) =>
      updatePackage(pkg.id, { isActive: !pkg.isActive }, confirmCode),
    onSuccess: () => {
      toast.success(pkg.isActive ? "Package deactivated" : "Package activated");
      closeToggle();
      onChanged();
    },
    onError: (err) => setToggleError(toggleCode.applyError(err)),
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

  const controls = (
    <div
      className="flex shrink-0 items-center gap-2"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        Active
        <Switch
          checked={pkg.isActive}
          disabled={toggleActive.isPending}
          // The switch stays where it was until the server agrees — it renders from
          // `pkg.isActive`, so an abandoned dialog leaves nothing half-flipped.
          onCheckedChange={() => {
            toggleCode.reset();
            setToggleError(null);
            setConfirmToggle(true);
          }}
        />
      </label>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
        onClick={() => setConfirmArchive(true)}
        aria-label={`Archive ${pkg.name}`}
        title="Archive"
      >
        <Archive className="h-3.5 w-3.5" />
      </Button>
    </div>
  );

  const dialogs = (
    <>
      <ConfirmCodeDialog
        open={confirmToggle}
        onOpenChange={(next) => !next && closeToggle()}
        title={pkg.isActive ? `Deactivate ${pkg.name}?` : `Activate ${pkg.name}?`}
        confirmLabel={pkg.isActive ? "Deactivate" : "Activate"}
        pendingLabel="Saving…"
        pending={toggleActive.isPending}
        destructive={pkg.isActive}
        state={toggleCode}
        formError={toggleError}
        onConfirm={() => toggleActive.mutate(toggleCode.code)}
        description={
          pkg.isActive ? (
            <p>
              It stops being sellable and can no longer be made the default. Workspaces already on
              it keep what they have.
            </p>
          ) : (
            <p>It becomes sellable again and can be assigned to new workspaces.</p>
          )
        }
      />

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

  return { controls, dialogs };
}

function useOpenPackage(pkg: PackageRow) {
  const navigate = useNavigate();
  const open = () => void navigate({ to: "/packages/$packageId", params: { packageId: pkg.id } });
  return {
    open,
    cardProps: {
      role: "button" as const,
      tabIndex: 0,
      onClick: open,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      },
    },
  };
}

function StatusDot({ pkg }: { pkg: PackageRow }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        pkg.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {pkg.isActive ? "Active" : "Inactive"}
    </span>
  );
}

function Visibility({ pkg }: { pkg: PackageRow }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
      title={pkg.isPublic ? "Shown on the public pricing page" : "Assignable only by an admin"}
    >
      {pkg.isPublic ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
      {pkg.isPublic ? "Public" : "Private"}
    </span>
  );
}

/* ─── Cards layout ────────────────────────────────────────────────────────────────────────── */

/** A pricing card (1Password / Hex plan cards): identity, then the price, then what's in it. */
function PackageTile({
  pkg,
  props,
  maxFeatures,
  onChanged,
}: {
  pkg: PackageRow;
  props: DisplayPrefs["properties"];
  maxFeatures: number;
  onChanged: () => void;
}) {
  const { cardProps } = useOpenPackage(pkg);
  const { controls, dialogs } = usePackageActions(pkg, onChanged);

  return (
    <>
      <div
        {...cardProps}
        className={cn(
          "group relative flex cursor-pointer flex-col rounded-2xl border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          !pkg.isActive && "bg-muted/30",
        )}
      >
        {props.badge && pkg.badge && (
          <span className="absolute -top-2.5 left-5 rounded-full bg-brand-gradient px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground shadow-glow">
            {pkg.badge}
          </span>
        )}

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3
              className={cn(
                "truncate font-display text-lg font-semibold",
                !pkg.isActive && "text-muted-foreground",
              )}
            >
              {pkg.name}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusDot pkg={pkg} />
              <Visibility pkg={pkg} />
            </div>
          </div>
          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-foreground" />
        </div>

        <div className="mt-4">
          <p className="flex items-baseline gap-1">
            <span className="text-3xl font-semibold tracking-tight tabular-nums">
              {usd(pkg.monthlyPriceUsdCents)}
            </span>
            {pkg.monthlyPriceUsdCents > 0 && (
              <span className="text-sm text-muted-foreground">/mo</span>
            )}
          </p>
          {props.inr && pkg.monthlyPriceInrPaise != null && (
            <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
              {inr(pkg.monthlyPriceInrPaise)}/mo in India
            </p>
          )}
        </div>

        {props.description && pkg.description && (
          <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{pkg.description}</p>
        )}

        {props.contents && (
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Contents</span>
              <span className="font-medium tabular-nums">
                {pkg.moduleCount} module{pkg.moduleCount === 1 ? "" : "s"} · {pkg.featureCount}{" "}
                feature
                {pkg.featureCount === 1 ? "" : "s"}
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-muted"
              title="Features relative to the richest package"
            >
              <div
                className="h-full rounded-full bg-brand-gradient"
                style={{ width: `${Math.round((pkg.featureCount / maxFeatures) * 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="min-h-4 flex-1" />
        <div className="flex items-center justify-between gap-2 border-t pt-3">
          <div className="min-w-0 space-y-0.5">
            {props.packageId && (
              <span onClick={(e) => e.stopPropagation()} className="block">
                <CopyableKey value={pkg.humanId} className="max-w-full text-[10px]" />
              </span>
            )}
            {props.created && (
              <span className="block text-[11px] text-muted-foreground">
                Created {formatDate(pkg.createdAt)}
              </span>
            )}
          </div>
          {controls}
        </div>
      </div>
      {dialogs}
    </>
  );
}

/* ─── Rows layout ─────────────────────────────────────────────────────────────────────────── */

/** One compact line per package — for scanning a long catalogue. Not a table: each row reflows. */
function PackageLine({
  pkg,
  props,
  onChanged,
}: {
  pkg: PackageRow;
  props: DisplayPrefs["properties"];
  onChanged: () => void;
}) {
  const { cardProps } = useOpenPackage(pkg);
  const { controls, dialogs } = usePackageActions(pkg, onChanged);

  return (
    <>
      <div
        {...cardProps}
        className={cn(
          "group flex cursor-pointer flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border bg-card px-4 py-3 transition-colors hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          !pkg.isActive && "bg-muted/30",
        )}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          <PackageIcon className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1 basis-48">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("truncate font-medium", !pkg.isActive && "text-muted-foreground")}>
              {pkg.name}
            </span>
            {props.badge && pkg.badge && (
              <span className="rounded-full border border-primary/40 bg-primary/10 px-1.5 text-[10px] font-medium text-primary">
                {pkg.badge}
              </span>
            )}
            <StatusDot pkg={pkg} />
            <Visibility pkg={pkg} />
          </div>
          {props.description && pkg.description && (
            <p className="truncate text-xs text-muted-foreground">{pkg.description}</p>
          )}
        </div>

        <Cell show label="Price">
          <span className="font-semibold tabular-nums">
            {usd(pkg.monthlyPriceUsdCents)}
            {pkg.monthlyPriceUsdCents > 0 && (
              <span className="font-normal text-muted-foreground">/mo</span>
            )}
          </span>
          {props.inr && pkg.monthlyPriceInrPaise != null && (
            <span className="block text-[11px] text-muted-foreground tabular-nums">
              {inr(pkg.monthlyPriceInrPaise)}
            </span>
          )}
        </Cell>
        <Cell show={props.contents} label="Contents">
          <span className="tabular-nums">
            {pkg.moduleCount} mod · {pkg.featureCount} feat
          </span>
        </Cell>
        <Cell show={props.packageId} label="ID">
          <span onClick={(e) => e.stopPropagation()}>
            <CopyableKey value={pkg.humanId} className="text-[10px]" />
          </span>
        </Cell>
        <Cell show={props.created} label="Created">
          {formatDate(pkg.createdAt)}
        </Cell>

        {controls}
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-foreground" />
      </div>
      {dialogs}
    </>
  );
}

function Cell({ show, label, children }: { show: boolean; label: string; children: ReactNode }) {
  if (!show) return null;
  return (
    <div className="min-w-0 text-sm">
      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

/**
 * The tier ladder, collapsed, above the package list.
 *
 * ## Why it is here at all
 *
 * The ordering was enforced on save and shown nowhere. The only way to learn it existed was to
 * break it, and the only description of it was a refusal naming capability keys. Putting it beside
 * the packages it constrains is the cheap half of making it usable; the override dialog is the
 * other half.
 *
 * Collapsed by default because it costs a query and most visits to this screen are not about the
 * ordering. Expanded state is deliberately not persisted — it is reference material, not a mode.
 */
function LadderPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border bg-card p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
      >
        <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-sm font-medium">Tier ladder</span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          Each tier should include everything the tier below it sells
        </span>
        <ChevronDown
          className={`ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="mt-3">
          <PackageLadder />
        </div>
      )}
    </div>
  );
}
