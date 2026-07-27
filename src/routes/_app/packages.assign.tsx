import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Check, Minus, Plus, Search, Users } from "lucide-react";
import { toast } from "@/lib/toast";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformPermissionRoute } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationBar } from "@/components/ui/pagination-bar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  assignWorkspacePackage,
  clearWorkspacePackage,
  getPackage,
  listAssignableWorkspaces,
  listPackages,
  type AssignableWorkspace,
} from "@/lib/api/registry-api";

const PACKAGE_MANAGE = "platform:package_manage";
const PAGE_SIZE = 20;

export const Route = createFileRoute("/_app/packages/assign")({
  head: () => ({ meta: [{ title: "Assign packages — Admin" }] }),
  component: AssignRoute,
});

function AssignRoute() {
  return (
    <PlatformPermissionRoute permission={PACKAGE_MANAGE}>
      <AssignPage />
    </PlatformPermissionRoute>
  );
}

/** `parentKey` with a null `childKey` means the whole module; otherwise one capability. */
const featureKey = (f: { parentKey: string; childKey: string | null }) =>
  f.childKey ?? `${f.parentKey}:*`;

function AssignPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<AssignableWorkspace | null>(null);
  const [nextPackageId, setNextPackageId] = useState<string>("");
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);

  const debouncedSearch = useDebounced(search);
  useEffect(() => setPage(1), [debouncedSearch]);

  const workspacesQuery = useQuery({
    queryKey: ["assignable-workspaces", debouncedSearch, page],
    // Filtering and counting happen in SQL — this only ever holds one page.
    queryFn: () =>
      listAssignableWorkspaces({ q: debouncedSearch || undefined, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  // Every package, so the operator can pick any. The catalogue is small (6 in production) and
  // this is a select, not a table — paging it would add a control nobody needs.
  const packagesQuery = useQuery({
    queryKey: ["packages", "all-for-assign"],
    queryFn: () => listPackages({ page: 1, limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const currentPackageId = target?.packageId ?? null;

  const currentDetail = useQuery({
    queryKey: ["package-detail", currentPackageId],
    queryFn: () => getPackage(currentPackageId!),
    enabled: !!currentPackageId,
  });

  const nextDetail = useQuery({
    queryKey: ["package-detail", nextPackageId],
    queryFn: () => getPackage(nextPackageId),
    enabled: !!nextPackageId,
  });

  /**
   * What actually changes for this workspace's members.
   *
   * Computed from both packages' real feature lists rather than from counts. A count tells an
   * operator that something changes; it does not tell them a tenant is about to lose the one
   * capability their whole workflow depends on. This is the screen where that has to be visible
   * before the button is pressed, because afterwards it is only visible as a support ticket.
   *
   * With no package currently assigned the workspace is unrestricted, so everything the new
   * package omits is a genuine loss — that case is called out separately below rather than
   * rendered as an empty diff.
   */
  const diff = useMemo(() => {
    if (!nextDetail.data) return null;
    const nextKeys = new Set(nextDetail.data.features.map(featureKey));
    const currentKeys = new Set((currentDetail.data?.features ?? []).map(featureKey));

    const added = [...nextKeys].filter((k) => !currentKeys.has(k)).sort();
    const removed = [...currentKeys].filter((k) => !nextKeys.has(k)).sort();
    return { added, removed, nextCount: nextKeys.size, currentCount: currentKeys.size };
  }, [nextDetail.data, currentDetail.data]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["assignable-workspaces"] });
    void queryClient.invalidateQueries({ queryKey: ["package-detail"] });
  };

  const assignMutation = useMutation({
    mutationFn: () =>
      assignWorkspacePackage(target!.id, {
        packageId: nextPackageId,
        note: note.trim() || null,
      }),
    onSuccess: () => {
      toast.success(`Package assigned to ${target!.name}`);
      setConfirming(false);
      setNote("");
      setTarget(null);
      setNextPackageId("");
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const clearMutation = useMutation({
    mutationFn: () => clearWorkspacePackage(target!.id),
    onSuccess: () => {
      toast.success(`${target!.name} is now unrestricted`);
      setTarget(null);
      setNextPackageId("");
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const rows = workspacesQuery.data?.items ?? [];
  const packages = packagesQuery.data?.items ?? [];
  const nextPackage = packages.find((p) => p.id === nextPackageId) ?? null;

  return (
    <div>
      <PageHeader
        eyebrow="Platform admin"
        title="Assign packages"
        description="Put a workspace on a package, or take the ceiling off entirely."
        actions={
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link to="/packages">
              <ArrowLeft className="h-4 w-4" />
              All packages
            </Link>
          </Button>
        }
      />

      <div className="space-y-5 p-4 sm:p-6 md:p-10">
        <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            A workspace with <span className="font-medium">no package</span> is unrestricted, not
            entitled to nothing. Assigning one applies a ceiling: members keep only the capabilities
            the package includes, on top of whatever their role already allows.
          </p>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search workspaces by name or id…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Workspace</th>
                  <th className="px-4 py-3 text-left font-medium">Current package</th>
                  <th className="px-4 py-3 text-center font-medium">Members</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {workspacesQuery.isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td colSpan={4} className="px-4 py-3">
                        <Skeleton className="h-6 rounded" />
                      </td>
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      No workspaces match “{search}”.
                    </td>
                  </tr>
                ) : (
                  rows.map((w) => (
                    <tr key={w.id} className="border-b hover:bg-muted/30">
                      <td className="px-4 py-2.5">
                        <span className="block font-medium">{w.name}</span>
                        {w.humanId && (
                          <code className="text-[11px] text-muted-foreground">{w.humanId}</code>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {w.packageName ? (
                          <Badge variant="outline" className="font-normal">
                            {w.packageName}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Unrestricted — no ceiling
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          {w.memberCount}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button
                          size="sm"
                          variant={target?.id === w.id ? "default" : "outline"}
                          onClick={() => {
                            setTarget(w);
                            setNextPackageId("");
                          }}
                        >
                          {target?.id === w.id ? "Selected" : "Change"}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {(workspacesQuery.data?.pages ?? 1) > 1 && (
            <PaginationBar
              page={page}
              pages={workspacesQuery.data!.pages}
              total={workspacesQuery.data!.total}
              limit={PAGE_SIZE}
              onPageChange={setPage}
            />
          )}
        </div>

        {target && (
          <div className="space-y-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
            <div>
              <h2 className="font-display text-base font-semibold">{target.name}</h2>
              <p className="text-xs text-muted-foreground">
                {target.packageName
                  ? `Currently on ${target.packageName}.`
                  : "Currently unrestricted."}{" "}
                {target.memberCount} member{target.memberCount === 1 ? "" : "s"} affected.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm">New package</Label>
                <Select value={nextPackageId} onValueChange={setNextPackageId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a package" />
                  </SelectTrigger>
                  <SelectContent>
                    {packages.map((p) => (
                      <SelectItem key={p.id} value={p.id} disabled={p.id === target.packageId}>
                        {p.name}
                        {p.id === target.packageId ? " (current)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Note (recorded in the audit log)</Label>
                <Input
                  value={note}
                  maxLength={1000}
                  placeholder="e.g. custom deal, migrated from Pro"
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>

            {nextPackageId && nextDetail.isLoading && <Skeleton className="h-24 rounded-xl" />}

            {diff && (
              <div className="space-y-3">
                {!target.packageId && (
                  <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                    This workspace has no ceiling today, so its members can use anything their role
                    allows. Everything not listed below becomes unavailable to them.
                  </p>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <DiffList
                    tone="add"
                    title={`Gained (${diff.added.length})`}
                    keys={diff.added}
                    empty="Nothing new."
                  />
                  <DiffList
                    tone="remove"
                    title={`Lost (${diff.removed.length})`}
                    keys={diff.removed}
                    empty="Nothing removed."
                  />
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                className="bg-brand-gradient text-primary-foreground shadow-glow hover:opacity-95"
                disabled={!nextPackageId || nextDetail.isLoading || assignMutation.isPending}
                onClick={() => setConfirming(true)}
              >
                Assign package
              </Button>
              {target.packageId && (
                <Button
                  variant="outline"
                  disabled={clearMutation.isPending}
                  onClick={() => clearMutation.mutate()}
                >
                  {clearMutation.isPending ? "Removing…" : "Remove ceiling"}
                </Button>
              )}
              <Button variant="ghost" onClick={() => setTarget(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Put {target?.name} on {nextPackage?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  This applies immediately to all {target?.memberCount} member
                  {target?.memberCount === 1 ? "" : "s"}. Everyone connected is notified and their
                  session refreshes its permissions.
                </p>
                {diff && diff.removed.length > 0 && (
                  <p className="font-medium text-destructive">
                    {diff.removed.length} capabilit
                    {diff.removed.length === 1 ? "y" : "ies"} will stop working for them.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                assignMutation.mutate();
              }}
              disabled={assignMutation.isPending}
            >
              {assignMutation.isPending ? "Assigning…" : "Assign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DiffList({
  tone,
  title,
  keys,
  empty,
}: {
  tone: "add" | "remove";
  title: string;
  keys: string[];
  empty: string;
}) {
  const Icon = tone === "add" ? Plus : Minus;
  const toneClass =
    tone === "add"
      ? "border-emerald-500/40 bg-emerald-500/5"
      : "border-destructive/40 bg-destructive/5";

  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </p>
      {keys.length === 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5" />
          {empty}
        </p>
      ) : (
        // Capped so a package with a hundred capabilities does not push the confirm button off
        // the screen — the count in the title stays exact either way.
        <ul className="space-y-0.5">
          {keys.slice(0, 12).map((k) => (
            <li key={k}>
              <code className="text-[11px]">{k}</code>
            </li>
          ))}
          {keys.length > 12 && (
            <li className="text-[11px] text-muted-foreground">
              …and {keys.length - 12} more
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
