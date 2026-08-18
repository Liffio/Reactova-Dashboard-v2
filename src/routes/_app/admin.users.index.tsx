import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  AlertCircle,
  Bookmark,
  BookmarkPlus,
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  Loader2,
  MoreHorizontal,
  Pencil,
  Search,
  SlidersHorizontal,
  Trash2,
  UserCog,
  UserX,
  X,
} from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformPermissionRoute } from "@/components/auth/guards";
import { PageErrorBoundary } from "@/components/error-boundary";
import { EmptyState } from "@/components/admin/form-page";
import { ImpersonateDialog } from "@/components/admin/impersonate-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useDebounced } from "@/hooks/use-debounced";
import { usePlatformCan } from "@/hooks/use-platform-authz";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { ApiError } from "@/lib/api/http";
import {
  listAdminUsers,
  type AdminUserFlag,
  type AdminUserListItem,
  type AdminUserListParams,
} from "@/lib/api/admin-users-api";
import {
  createSavedView,
  deleteSavedView,
  listSavedViews,
  updateSavedView,
  type AdminSavedView,
} from "@/lib/api/admin-saved-views-api";

const USER_MANAGE = "platform:user_manage";
/** Separate axis from `USER_MANAGE` — Task 18. Gates the `i`-shortcut and the kebab's
 *  "Impersonate" item specifically, so a `user_manage`-only operator doesn't get an affordance
 *  they'd 403 on. */
const IMPERSONATE = "platform:impersonate";
const QUERY_KEY = "admin-users";
const PAGE_SIZE = 50;
/** Fetch the next page once the sentinel — the scroll position — is this close to the bottom. */
const PREFETCH_DISTANCE_PX = 400;
/** Estimated row height for the virtualiser (two-line name/email cell + cell padding). */
const ROW_ESTIMATE_PX = 64;

type SortValue = "created_at" | "email" | "name";
type DirValue = "asc" | "desc";
type StatusValue = "active" | "inactive" | "banned";

const SORT_VALUES: readonly SortValue[] = ["created_at", "email", "name"];
const DIR_VALUES: readonly DirValue[] = ["asc", "desc"];
const STATUS_VALUES: readonly StatusValue[] = ["active", "inactive", "banned"];
const PLAN_VALUES = ["FREE", "STARTER", "PRO", "BUSINESS", "AGENCY"] as const;
// Attested in-repo (src/state/app-context.tsx WorkspaceStatus + agency.tsx's statusStyles) —
// PAYMENT_FAILED/INSTAGRAM_DISCONNECTED are exactly the workspace states two of the §7.1 flag
// conditions key off (PAYMENT_FAILED, IG_DISCONNECTED), so admins filtering by them matters most.
const WORKSPACE_STATUS_VALUES = [
  "ACTIVE",
  "PAUSED",
  "SUSPENDED",
  "PAYMENT_FAILED",
  "INSTAGRAM_DISCONNECTED",
] as const;

type AdminUsersSearch = {
  q?: string;
  sort?: SortValue;
  dir?: DirValue;
  status?: StatusValue;
  plan?: string;
  verified?: boolean;
  has_mfa?: boolean;
  workspace_status?: string;
  created_after?: string;
  created_before?: string;
};

function strParam(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/** Handles both actual booleans and their string form — the router's default search parser
 *  round-trips simple values as native types, but a hand-typed/shared URL carries strings. */
function boolParam(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

function boolToSelectValue(v: boolean | undefined): string {
  return v === undefined ? "all" : String(v);
}

function selectValueToBool(v: string): boolean | undefined {
  return v === "all" ? undefined : v === "true";
}

/** `"INSTAGRAM_DISCONNECTED"` → `"Instagram Disconnected"` — humanizes any `SCREAMING_SNAKE_CASE`
 *  backend enum for display, multi-word values included. */
function humanizeEnum(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

/** `created_after`/`created_before` travel in the URL as plain `YYYY-MM-DD` (readable, shareable);
 *  convert to inclusive UTC day boundaries only when building the request. */
function toIsoDayStart(date: string | undefined): string | undefined {
  return date ? `${date}T00:00:00.000Z` : undefined;
}
function toIsoDayEnd(date: string | undefined): string | undefined {
  return date ? `${date}T23:59:59.999Z` : undefined;
}

/**
 * Saved views (spec §4.3, §7.1) — a view's `filters` blob is the exact wire shape
 * `apiUri.admin.users.list` would encode into the query string (every value stringified),
 * matching the schema `GET /admin/users`'s own query string parses against
 * (task-22-report.md §3/§6 — the server validates `filters` against that same `listQuerySchema`).
 * `filtersToSearch` is the inverse, reusing this route's own `strParam`/`boolParam`/`oneOf`
 * coercion helpers so applying a saved view behaves exactly like following a shared URL.
 */
function searchToFilters(search: AdminUsersSearch): Record<string, string> {
  const out: Record<string, string> = {};
  const entries: Array<[string, string | boolean | undefined]> = [
    ["q", search.q],
    ["sort", search.sort],
    ["dir", search.dir],
    ["status", search.status],
    ["plan", search.plan],
    ["verified", search.verified],
    ["has_mfa", search.has_mfa],
    ["workspace_status", search.workspace_status],
    ["created_after", search.created_after],
    ["created_before", search.created_before],
  ];
  for (const [key, value] of entries) {
    if (value !== undefined && value !== "") out[key] = String(value);
  }
  return out;
}

function filtersToSearch(filters: Record<string, unknown>): AdminUsersSearch {
  return {
    q: strParam(filters.q),
    sort: oneOf(filters.sort, SORT_VALUES),
    dir: oneOf(filters.dir, DIR_VALUES),
    status: oneOf(filters.status, STATUS_VALUES),
    plan: strParam(filters.plan),
    verified: boolParam(filters.verified),
    has_mfa: boolParam(filters.has_mfa),
    workspace_status: strParam(filters.workspace_status),
    created_after: strParam(filters.created_after),
    created_before: strParam(filters.created_before),
  };
}

function savedViewErrorToast(err: unknown, fallback: string) {
  const requestId = err instanceof ApiError ? err.requestId : undefined;
  toast.error(err instanceof Error ? err.message : fallback, {
    description: requestId ? `Request ID: ${requestId}` : undefined,
  });
}

/** Interactive controls (native or ARIA) whose Enter/Space keypress must be left alone — the
 *  global list-navigation shortcuts (`j`/`k`/`Enter`) must never hijack a focused button, link,
 *  select trigger, or anything inside the filters bar (a Select's open listbox items included). */
function isInteractiveElement(el: Element | null): boolean {
  if (!el) return false;
  if (["BUTTON", "A", "SELECT", "SUMMARY"].includes(el.tagName)) return true;
  const role = el.getAttribute("role");
  if (role && ["button", "combobox", "option", "menuitem", "listbox", "menu"].includes(role)) {
    return true;
  }
  return Boolean(el.closest('[data-filters-bar="true"]'));
}

export const Route = createFileRoute("/_app/admin/users/")({
  validateSearch: (search: Record<string, unknown>): AdminUsersSearch => ({
    q: strParam(search.q),
    sort: oneOf(search.sort, SORT_VALUES),
    dir: oneOf(search.dir, DIR_VALUES),
    status: oneOf(search.status, STATUS_VALUES),
    plan: strParam(search.plan),
    verified: boolParam(search.verified),
    has_mfa: boolParam(search.has_mfa),
    workspace_status: strParam(search.workspace_status),
    created_after: strParam(search.created_after),
    created_before: strParam(search.created_before),
  }),
  head: () => ({ meta: [{ title: "Users — Admin" }] }),
  component: AdminUsersRoute,
});

function AdminUsersRoute() {
  return (
    <PlatformPermissionRoute permission={USER_MANAGE}>
      <PageErrorBoundary label="admin-users">
        <AdminUsersPage />
      </PageErrorBoundary>
    </PlatformPermissionRoute>
  );
}

function AdminUsersPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Platform admin"
        title="Users"
        description="Every account on the platform — search, filter, and open a profile to manage access, sessions, and billing."
      />
      <div className="space-y-4 p-4 sm:p-6 md:p-10">
        <UsersTable />
      </div>
    </div>
  );
}

const FLAG_BADGE: Record<AdminUserFlag, { label: string; className: string }> = {
  BANNED: {
    label: "Banned",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  INACTIVE: { label: "Inactive", className: "border-border bg-muted text-muted-foreground" },
  UNVERIFIED: { label: "Unverified", className: "border-warning/30 bg-warning/10 text-warning" },
  NO_MFA: {
    label: "No MFA",
    className: "border-muted-foreground/30 bg-transparent text-muted-foreground",
  },
  PAYMENT_FAILED: {
    label: "Payment failed",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  IG_DISCONNECTED: {
    label: "IG disconnected",
    className: "border-warning/30 bg-warning/10 text-warning",
  },
  LOW_TRUST: { label: "Low trust", className: "border-warning/30 bg-warning/10 text-warning" },
  UNRESTRICTED: {
    label: "Unrestricted",
    className: "border-chart-3/30 bg-chart-3/10 text-chart-3",
  },
  AFFILIATE_SUSPENDED: {
    label: "Affiliate suspended",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
};

function FlagBadge({ flag }: { flag: AdminUserFlag }) {
  // Forward-compatible: an unrecognised flag (server adds one before the client knows about it)
  // still renders instead of crashing the row — neutral styling, raw label.
  const meta = FLAG_BADGE[flag] ?? {
    label: flag,
    className: "border-border bg-muted text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap text-[10px]", meta.className)}>
      {meta.label}
    </Badge>
  );
}

function SortableHeader({
  label,
  value,
  sort,
  dir,
  onSort,
}: {
  label: string;
  value: SortValue;
  sort: SortValue;
  dir: DirValue;
  onSort: (value: SortValue) => void;
}) {
  const active = sort === value;
  return (
    <button
      type="button"
      onClick={() => onSort(value)}
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground",
        active && "text-foreground",
      )}
    >
      {label}
      {active ? (
        dir === "asc" ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )
      ) : (
        <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
      )}
    </button>
  );
}

function initialsFor(name: string | null, email: string): string {
  const source = (name ?? email).trim();
  const initials = source
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return initials || "?";
}

const COLUMN_COUNT = 7;

function ErrorPanel({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  const message = error instanceof Error ? error.message : "Couldn't load users.";
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-8 text-center">
      <AlertCircle className="mx-auto mb-2 h-6 w-6 text-destructive" />
      <p className="text-sm font-medium text-destructive">{message}</p>
      {requestId && (
        <p className="mt-2 text-xs text-muted-foreground">
          Request ID: <span className="font-mono">{requestId}</span> — quote this when reporting.
        </p>
      )}
      <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-soft">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-5 w-16 rounded-md" />
          <Skeleton className="h-3.5 w-8" />
          <Skeleton className="h-3.5 w-14" />
          <Skeleton className="h-3.5 w-20" />
        </div>
      ))}
    </div>
  );
}

function UserRow({
  row,
  selected,
  dimmed,
  canImpersonate,
  onOpen,
  onSelect,
  onImpersonate,
}: {
  row: AdminUserListItem;
  selected: boolean;
  dimmed: boolean;
  canImpersonate: boolean;
  onOpen: () => void;
  onSelect: () => void;
  onImpersonate: () => void;
}) {
  return (
    <TableRow
      data-selected={selected || undefined}
      onClick={() => {
        onSelect();
        onOpen();
      }}
      className={cn(
        "cursor-pointer transition-opacity",
        selected && "bg-muted/60 hover:bg-muted/60",
        dimmed && "opacity-60",
      )}
    >
      <TableCell>
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-8 w-8 shrink-0">
            {row.avatarUrl && <AvatarImage src={row.avatarUrl} alt="" />}
            <AvatarFallback className="bg-brand-gradient text-[11px] font-semibold text-primary-foreground">
              {initialsFor(row.name, row.email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.name || "—"}</p>
            <p className="truncate text-xs text-muted-foreground">{row.email}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {row.flags.length === 0 ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            row.flags.map((flag) => <FlagBadge key={flag} flag={flag} />)
          )}
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums">{row.workspaceCount}</TableCell>
      <TableCell className="text-xs">{row.primaryPlan ?? "—"}</TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
        {new Date(row.createdAt).toLocaleDateString()}
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
        {row.lastActiveAt ? new Date(row.lastActiveAt).toLocaleDateString() : "Never"}
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Row actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to="/admin/users/$userId" params={{ userId: row.id }}>
                Open
              </Link>
            </DropdownMenuItem>
            {canImpersonate && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onImpersonate();
                }}
              >
                <UserCog className="mr-2 h-4 w-4" /> Impersonate
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

/** "Save this view" — captures `search` (the current `validateSearch` state) as a named,
 *  optionally-shared saved view. Cancel/close routes through `handleClose` so a typed
 *  name/share-toggle never survives past a Cancel and repopulates the next time this
 *  always-mounted dialog opens (see `admin.users.$userId.billing.tsx`'s `CompPlanDialog` for the
 *  same convention this mirrors). */
function SaveViewDialog({
  open,
  onOpenChange,
  search,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  search: AdminUsersSearch;
}) {
  const [name, setName] = useState("");
  const [isShared, setIsShared] = useState(false);
  const queryClient = useQueryClient();

  const reset = () => {
    setName("");
    setIsShared(false);
  };
  const handleClose = () => {
    onOpenChange(false);
    reset();
  };

  const mutation = useMutation({
    mutationFn: () =>
      createSavedView({ name: name.trim(), filters: searchToFilters(search), isShared }),
    onSuccess: () => {
      toast.success("View saved.");
      handleClose();
      void queryClient.invalidateQueries({ queryKey: ["admin-saved-views"] });
    },
    onError: (err) => savedViewErrorToast(err, "Failed to save this view."),
  });

  const nameValid = name.trim().length >= 1 && name.trim().length <= 255;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (mutation.isPending) return;
        if (next) onOpenChange(next);
        else handleClose();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Save this view</DialogTitle>
          <DialogDescription>
            Captures the current search, sort, and filters as a reusable view.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="save-view-name">Name</Label>
            <Input
              id="save-view-name"
              value={name}
              maxLength={255}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Unverified, last 30 days"
            />
          </div>
          <label className="flex items-start gap-2.5 rounded-lg border p-3 text-sm">
            <Checkbox
              checked={isShared}
              onCheckedChange={(v) => setIsShared(v === true)}
              className="mt-0.5"
            />
            <span>
              <span className="block font-medium">Share with other admins</span>
              <span className="block text-xs text-muted-foreground">
                Visible to every admin who can reach this page, not just you.
              </span>
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button disabled={!nameValid || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Saving…" : "Save view"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Rename — re-seeds `name` from `view.name` on every open (not just on mount: this dialog stays
 *  mounted across open/close cycles as a sibling of `SavedViewRow`'s other controls), and Cancel
 *  routes through the same `handleClose` the Dialog's own `onOpenChange(false)` branch uses, so a
 *  half-typed rename never survives a Cancel. */
function RenameViewDialog({
  view,
  open,
  onOpenChange,
}: {
  view: AdminSavedView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState(view.name);
  const queryClient = useQueryClient();

  const handleClose = () => {
    onOpenChange(false);
    setName(view.name);
  };

  const mutation = useMutation({
    mutationFn: () => updateSavedView(view.id, { name: name.trim() }),
    onSuccess: () => {
      toast.success("View renamed.");
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: ["admin-saved-views"] });
    },
    onError: (err) => savedViewErrorToast(err, "Failed to rename this view."),
  });

  const nameValid = name.trim().length >= 1 && name.trim().length <= 255;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (mutation.isPending) return;
        if (next) {
          setName(view.name);
          onOpenChange(next);
        } else {
          handleClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename view</DialogTitle>
        </DialogHeader>
        <Input value={name} maxLength={255} onChange={(e) => setName(e.target.value)} />
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button disabled={!nameValid || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Saving…" : "Rename"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One row in the Views dialog. Apply is the row's own click target (own AND shared rows); own
 *  rows additionally get a Share switch (fires immediately — a lightweight preference toggle, no
 *  confirm needed, D5 audit-detached server-side per task-22-report.md §6) plus Rename/Delete.
 *  Shared-not-own rows are apply-only, per the contract's own-only PATCH/DELETE scoping. */
function SavedViewRow({ view, onApply }: { view: AdminSavedView; onApply: () => void }) {
  const queryClient = useQueryClient();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["admin-saved-views"] });

  const shareMutation = useMutation({
    mutationFn: (next: boolean) => updateSavedView(view.id, { isShared: next }),
    onSuccess: invalidate,
    onError: (err) => savedViewErrorToast(err, "Failed to update sharing."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteSavedView(view.id),
    onSuccess: () => {
      toast.success("View deleted.");
      setDeleteOpen(false);
      invalidate();
    },
    onError: (err) => savedViewErrorToast(err, "Failed to delete this view."),
  });

  return (
    <div className="flex items-center gap-2 rounded-lg border p-2.5">
      <button
        type="button"
        onClick={onApply}
        className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:text-primary"
      >
        {view.name}
      </button>
      {!view.isOwn && (
        <Badge variant="outline" className="shrink-0 text-[10px]">
          Shared
        </Badge>
      )}
      {view.isOwn && (
        <>
          <label className="flex shrink-0 items-center gap-1.5 text-[10px] text-muted-foreground">
            Shared
            <Switch
              checked={view.isShared}
              onCheckedChange={(v) => shareMutation.mutate(v)}
              disabled={shareMutation.isPending}
            />
          </label>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            aria-label="Rename view"
            onClick={() => setRenameOpen(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
            aria-label="Delete view"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <RenameViewDialog view={view} open={renameOpen} onOpenChange={setRenameOpen} />
          <AlertDialog
            open={deleteOpen}
            onOpenChange={(next) => !deleteMutation.isPending && setDeleteOpen(next)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete "{view.name}"?</AlertDialogTitle>
                <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={deleteMutation.isPending}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={(e) => {
                    e.preventDefault();
                    deleteMutation.mutate();
                  }}
                >
                  {deleteMutation.isPending ? "Deleting…" : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}

/** Views picker + manager, combined into one dialog (own + shared, shared badged; apply
 *  navigates; own rows get rename/delete/share) — a single surface rather than a picker dropdown
 *  plus a separate manager page, matching the brief's "keep it light" mechanical-UI guidance. */
function ViewsDialog({
  open,
  onOpenChange,
  views,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  views: AdminSavedView[];
  onApply: (view: AdminSavedView) => void;
}) {
  const mine = views.filter((v) => v.isOwn);
  const shared = views.filter((v) => !v.isOwn);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Saved views</DialogTitle>
          <DialogDescription>Apply a saved view, or manage your own.</DialogDescription>
        </DialogHeader>
        {views.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No saved views yet.</p>
        ) : (
          <div className="max-h-96 space-y-4 overflow-y-auto">
            {mine.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Mine
                </p>
                {mine.map((v) => (
                  <SavedViewRow key={v.id} view={v} onApply={() => onApply(v)} />
                ))}
              </div>
            )}
            {shared.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Shared by other admins
                </p>
                {shared.map((v) => (
                  <SavedViewRow key={v.id} view={v} onApply={() => onApply(v)} />
                ))}
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Toolbar entry point — "Save view" opens the save dialog; "Views" opens the picker/manager.
 *  `onApply` is the caller's own navigate-with-search callback, keeping this component decoupled
 *  from `useNavigate`'s typed-route plumbing. */
function SavedViewsControls({
  search,
  onApply,
}: {
  search: AdminUsersSearch;
  onApply: (next: AdminUsersSearch) => void;
}) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  const viewsQuery = useQuery({
    queryKey: ["admin-saved-views"],
    queryFn: () => listSavedViews(),
  });
  const views = viewsQuery.data?.views ?? [];

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSaveOpen(true)}>
        <BookmarkPlus className="h-3.5 w-3.5" /> Save view
      </Button>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setManageOpen(true)}>
        <Bookmark className="h-3.5 w-3.5" /> Views
        {views.length > 0 && (
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
            {views.length}
          </Badge>
        )}
      </Button>
      <SaveViewDialog open={saveOpen} onOpenChange={setSaveOpen} search={search} />
      <ViewsDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        views={views}
        onApply={(view) => {
          onApply(filtersToSearch(view.filters));
          setManageOpen(false);
        }}
      />
    </>
  );
}

function UsersTable() {
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();
  const canImpersonate = usePlatformCan(IMPERSONATE);

  const [searchInput, setSearchInput] = useState(search.q ?? "");
  const debouncedSearch = useDebounced(searchInput, 250);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [impersonateTarget, setImpersonateTarget] = useState<{ id: string; label: string } | null>(
    null,
  );

  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Debounce free-text search into the URL (deep-linkable/shareable per spec §7.1); `replace`
  // so every keystroke doesn't create a back-button stop.
  useEffect(() => {
    if (debouncedSearch !== (search.q ?? "")) {
      void navigate({
        search: (prev) => ({ ...prev, q: debouncedSearch || undefined }),
        replace: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // Keep the box in sync if the URL changes from elsewhere (back/forward, a pasted link).
  useEffect(() => {
    setSearchInput(search.q ?? "");
  }, [search.q]);

  const sort = search.sort ?? "created_at";
  const dir = search.dir ?? "desc";

  const handleSort = useCallback(
    (value: SortValue) => {
      void navigate({
        search: (prev) => {
          const currentSort = prev.sort ?? "created_at";
          const currentDir = prev.dir ?? "desc";
          if (currentSort === value) {
            return { ...prev, sort: value, dir: currentDir === "asc" ? "desc" : "asc" };
          }
          return { ...prev, sort: value, dir: value === "created_at" ? "desc" : "asc" };
        },
      });
    },
    [navigate],
  );

  const setFilter = useCallback(
    <K extends keyof AdminUsersSearch>(key: K, value: AdminUsersSearch[K]) => {
      void navigate({ search: (prev) => ({ ...prev, [key]: value }) });
    },
    [navigate],
  );

  const clearFilters = useCallback(() => {
    void navigate({ search: (prev) => ({ q: prev.q, sort: prev.sort, dir: prev.dir }) });
  }, [navigate]);

  /** Applying a saved view replaces the URL search state wholesale (not merged into `prev`) — a
   *  saved view is a complete snapshot, so any filter not present in it should clear, exactly
   *  like following a shared link would. */
  const applySavedView = useCallback(
    (next: AdminUsersSearch) => {
      void navigate({ search: () => next });
    },
    [navigate],
  );

  const activeFilterCount = [
    search.status,
    search.plan,
    search.verified,
    search.has_mfa,
    search.workspace_status,
    search.created_after,
    search.created_before,
  ].filter((v) => v !== undefined).length;

  const queryParams: Omit<AdminUserListParams, "cursor"> = {
    limit: PAGE_SIZE,
    q: search.q,
    sort,
    dir,
    status: search.status,
    plan: search.plan,
    verified: search.verified,
    has_mfa: search.has_mfa,
    workspace_status: search.workspace_status,
    created_after: toIsoDayStart(search.created_after),
    created_before: toIsoDayEnd(search.created_before),
  };

  const listQuery = useInfiniteQuery({
    queryKey: [
      QUERY_KEY,
      search.q,
      sort,
      dir,
      search.status,
      search.plan,
      search.verified,
      search.has_mfa,
      search.workspace_status,
      search.created_after,
      search.created_before,
    ],
    queryFn: ({ pageParam, signal }: { pageParam: string | undefined; signal: AbortSignal }) =>
      listAdminUsers({ ...queryParams, cursor: pageParam }, { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });

  const rows: AdminUserListItem[] = useMemo(
    () => listQuery.data?.pages.flatMap((p) => (Array.isArray(p?.items) ? p.items : [])) ?? [],
    [listQuery.data],
  );
  const total = listQuery.data?.pages[0]?.total;

  // A refetch triggered by a filter/search/sort change (not "load more") — dim stale rows
  // instead of blanking the table, per spec §7.1.
  const isRefetching = listQuery.isFetching && !listQuery.isFetchingNextPage;
  const isInitialLoading = listQuery.isLoading && rows.length === 0;

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_ESTIMATE_PX,
    overscan: 12,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualItems.length > 0 ? totalSize - virtualItems[virtualItems.length - 1].end : 0;

  const maybeFetchMore = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !listQuery.hasNextPage || listQuery.isFetchingNextPage) return;
    const distanceFromEnd = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromEnd < PREFETCH_DISTANCE_PX) {
      void listQuery.fetchNextPage();
    }
  }, [listQuery]);

  // Covers the case where a filtered result set is shorter than the viewport — no scroll event
  // would ever fire to trigger the check above, so the list would silently stop at page 1.
  useEffect(() => {
    maybeFetchMore();
  }, [rows.length, maybeFetchMore]);

  const openUser = useCallback(
    (userId: string) => {
      void navigate({ to: "/admin/users/$userId", params: { userId } });
    },
    [navigate],
  );

  const openImpersonate = useCallback(
    (row: AdminUserListItem) => {
      if (!canImpersonate) return;
      setImpersonateTarget({ id: row.id, label: row.name || row.email });
    },
    [canImpersonate],
  );

  // Keyboard: `/` focuses search, `j`/`k` move row selection, `Enter` opens it, `i` opens the
  // Impersonate dialog for it (Task 18, only when `platform:impersonate`), `Esc` clears selection
  // and blurs search. Ignored while an input/textarea has focus (except `Esc`), and
  // `j`/`k`/`Enter`/`i` are additionally ignored whenever focus sits on an interactive control
  // (button, link, select trigger/listbox item, anything in the filters bar) — otherwise Tabbing
  // from a `j`-selected row to the Filters toggle, Clear filters, a kebab button, or a Select
  // trigger and pressing Enter/`i` would silently act on the selected user instead of activating
  // the focused control.
  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      return (
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable
      );
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSelectedId(null);
        searchInputRef.current?.blur();
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      // From here down, list-navigation keys only act when focus isn't already on some other
      // interactive control — see the doc comment above.
      if (isInteractiveElement(document.activeElement)) return;
      if (e.key === "j" || e.key === "k") {
        if (rows.length === 0) return;
        e.preventDefault();
        const currentIdx = selectedId ? rows.findIndex((r) => r.id === selectedId) : -1;
        const nextIdx =
          e.key === "j"
            ? Math.min(currentIdx + 1, rows.length - 1)
            : currentIdx === -1
              ? 0
              : Math.max(currentIdx - 1, 0);
        const next = rows[nextIdx];
        if (next) {
          setSelectedId(next.id);
          rowVirtualizer.scrollToIndex(nextIdx, { align: "auto" });
        }
        return;
      }
      if (e.key === "Enter" && selectedId) {
        e.preventDefault();
        openUser(selectedId);
        return;
      }
      if (e.key === "i" && selectedId && canImpersonate) {
        const row = rows.find((r) => r.id === selectedId);
        if (row) {
          e.preventDefault();
          openImpersonate(row);
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [rows, selectedId, rowVirtualizer, openUser, openImpersonate, canImpersonate]);

  // Belt-and-suspenders alongside the activeElement guard above: once focus actually lands on an
  // interactive control, or leaves the table region entirely, the keyboard-selected row no longer
  // reads as "the thing Enter would open" — drop it so the stale highlight doesn't linger either.
  useEffect(() => {
    function onFocusIn(e: FocusEvent) {
      if (!(e.target instanceof Element)) return;
      const insideTable = scrollRef.current?.contains(e.target) ?? false;
      if (!insideTable || isInteractiveElement(e.target)) {
        setSelectedId(null);
      }
    }
    window.addEventListener("focusin", onFocusIn);
    return () => window.removeEventListener("focusin", onFocusIn);
  }, []);

  return (
    <div className="space-y-3">
      <Collapsible data-filters-bar="true" open={filtersOpen} onOpenChange={setFiltersOpen}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search by name, email, phone, or user id… (press / to focus)"
              className="h-9 pl-9 pr-9"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {isRefetching && (
              <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </CollapsibleTrigger>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={clearFilters}>
              <X className="h-3.5 w-3.5" /> Clear filters
            </Button>
          )}
          <SavedViewsControls search={search} onApply={applySavedView} />
          <span className="ml-auto text-xs text-muted-foreground">
            {total !== undefined
              ? `${total.toLocaleString()} user${total === 1 ? "" : "s"}`
              : rows.length > 0
                ? `${rows.length}+ loaded`
                : ""}
          </span>
        </div>

        <CollapsibleContent className="mt-3 grid gap-3 rounded-2xl border bg-card p-4 shadow-soft sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Status</Label>
            <Select
              value={search.status ?? "all"}
              onValueChange={(v) =>
                setFilter("status", v === "all" ? undefined : (v as StatusValue))
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="banned">Banned</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Plan</Label>
            <Select
              value={search.plan ?? "all"}
              onValueChange={(v) => setFilter("plan", v === "all" ? undefined : v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All plans</SelectItem>
                {PLAN_VALUES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Email verified
            </Label>
            <Select
              value={boolToSelectValue(search.verified)}
              onValueChange={(v) => setFilter("verified", selectValueToBool(v))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any</SelectItem>
                <SelectItem value="true">Verified</SelectItem>
                <SelectItem value="false">Unverified</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">MFA</Label>
            <Select
              value={boolToSelectValue(search.has_mfa)}
              onValueChange={(v) => setFilter("has_mfa", selectValueToBool(v))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any</SelectItem>
                <SelectItem value="true">MFA enabled</SelectItem>
                <SelectItem value="false">No MFA</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Workspace status
            </Label>
            <Select
              value={search.workspace_status ?? "all"}
              onValueChange={(v) => setFilter("workspace_status", v === "all" ? undefined : v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any</SelectItem>
                {WORKSPACE_STATUS_VALUES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {humanizeEnum(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Created after
            </Label>
            <Input
              type="date"
              className="h-8 text-xs"
              value={search.created_after ?? ""}
              onChange={(e) => setFilter("created_after", e.target.value || undefined)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Created before
            </Label>
            <Input
              type="date"
              className="h-8 text-xs"
              value={search.created_before ?? ""}
              onChange={(e) => setFilter("created_before", e.target.value || undefined)}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {listQuery.isError ? (
        <ErrorPanel error={listQuery.error} onRetry={() => void listQuery.refetch()} />
      ) : isInitialLoading ? (
        <LoadingSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState icon={UserX} title="No users match your filters">
          Try widening the search or clearing filters.
        </EmptyState>
      ) : (
        <div
          ref={scrollRef}
          onScroll={maybeFetchMore}
          className="h-[calc(100vh-22rem)] min-h-[420px] overflow-auto rounded-2xl border bg-card shadow-soft"
        >
          {/* Raw <table>, not the shadcn `Table` wrapper: `Table` wraps children in its own
              `relative w-full overflow-auto` div (src/components/ui/table.tsx), which — having no
              fixed height — never itself scrolls, but *is* the nearest `overflow != visible`
              ancestor of <thead>. `position: sticky` resolves against the nearest such ancestor,
              so a sticky header inside that wrapper sticks to a div that doesn't scroll, and
              scrolls away with the rest of the table inside `scrollRef` (the div that actually
              scrolls) instead. Composing the table directly here — one overflow container, not
              two nested ones — is what makes `sticky top-0` resolve against `scrollRef`. */}
          <table className="w-full caption-bottom text-sm">
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[300px]">
                  <SortableHeader
                    label="User"
                    value="name"
                    sort={sort}
                    dir={dir}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Workspaces</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>
                  <SortableHeader
                    label="Created"
                    value="created_at"
                    sort={sort}
                    dir={dir}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead>Last active</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paddingTop > 0 && (
                <TableRow className="border-0 hover:bg-transparent">
                  <TableCell colSpan={COLUMN_COUNT} style={{ height: paddingTop, padding: 0 }} />
                </TableRow>
              )}
              {virtualItems.map((virtualRow) => {
                const row = rows[virtualRow.index];
                if (!row) return null;
                return (
                  <UserRow
                    key={row.id}
                    row={row}
                    selected={row.id === selectedId}
                    dimmed={isRefetching}
                    canImpersonate={canImpersonate}
                    onOpen={() => openUser(row.id)}
                    onSelect={() => setSelectedId(row.id)}
                    onImpersonate={() => openImpersonate(row)}
                  />
                );
              })}
              {paddingBottom > 0 && (
                <TableRow className="border-0 hover:bg-transparent">
                  <TableCell colSpan={COLUMN_COUNT} style={{ height: paddingBottom, padding: 0 }} />
                </TableRow>
              )}
            </TableBody>
          </table>
          {listQuery.isFetchingNextPage && (
            <div className="flex justify-center border-t p-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      )}

      <ImpersonateDialog
        targetUserId={impersonateTarget?.id ?? ""}
        targetLabel={impersonateTarget?.label ?? ""}
        open={Boolean(impersonateTarget)}
        onOpenChange={(next) => {
          if (!next) setImpersonateTarget(null);
        }}
      />
    </div>
  );
}
