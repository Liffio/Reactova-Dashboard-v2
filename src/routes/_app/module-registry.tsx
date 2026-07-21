import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Code2, Copy, Plus, Search, Unlink } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformPermissionRoute } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  createChildModule,
  createParentModule,
  getModuleConstants,
  listChildModules,
  listParentModules,
  unmapChildFromParent,
  updateParentModule,
  type ParentModule,
} from "@/lib/api/registry-api";

const MODULE_MANAGE = "platform:module_manage";
const PAGE_SIZE = 20;

export const Route = createFileRoute("/_app/module-registry")({
  head: () => ({ meta: [{ title: "Module Registry — Admin" }] }),
  component: ModuleRegistryRoute,
});

function ModuleRegistryRoute() {
  return (
    <PlatformPermissionRoute permission={MODULE_MANAGE}>
      <ModuleRegistryPage />
    </PlatformPermissionRoute>
  );
}

function ModuleRegistryPage() {
  const queryClient = useQueryClient();
  const [parentSearch, setParentSearch] = useState("");
  const [parentPage, setParentPage] = useState(1);
  const [selected, setSelected] = useState<ParentModule | null>(null);
  const [childSearch, setChildSearch] = useState("");
  const [childPage, setChildPage] = useState(1);
  const [newParentOpen, setNewParentOpen] = useState(false);
  const [newChildOpen, setNewChildOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);

  const debouncedParentSearch = useDebounced(parentSearch);
  const debouncedChildSearch = useDebounced(childSearch);

  // Searching resets to page 1: staying on page 4 of the old result set would show an empty page.
  useEffect(() => setParentPage(1), [debouncedParentSearch]);
  useEffect(() => setChildPage(1), [debouncedChildSearch, selected?.id]);

  const parentsQuery = useQuery({
    queryKey: ["registry-parents", debouncedParentSearch, parentPage],
    queryFn: () =>
      listParentModules({ q: debouncedParentSearch || undefined, page: parentPage, limit: PAGE_SIZE }),
    // Keeps the previous page visible while the next one loads, instead of collapsing to a skeleton.
    placeholderData: keepPreviousData,
  });

  const childrenQuery = useQuery({
    queryKey: ["registry-children", selected?.id, debouncedChildSearch, childPage],
    queryFn: () =>
      listChildModules({
        parentModuleId: selected?.id,
        q: debouncedChildSearch || undefined,
        page: childPage,
        limit: PAGE_SIZE,
      }),
    enabled: !!selected,
    placeholderData: keepPreviousData,
  });

  const refreshParents = () => void queryClient.invalidateQueries({ queryKey: ["registry-parents"] });
  const refreshChildren = () => void queryClient.invalidateQueries({ queryKey: ["registry-children"] });

  const toggleSidebar = useMutation({
    mutationFn: (p: ParentModule) => updateParentModule(p.id, { showInSidebar: !p.showInSidebar }),
    onSuccess: () => {
      toast.success("Sidebar visibility updated");
      refreshParents();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const unmap = useMutation({
    mutationFn: (childId: string) => unmapChildFromParent(selected!.id, childId),
    onSuccess: () => {
      toast.success("Unmapped from this module");
      refreshChildren();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const parents = parentsQuery.data;
  const children = childrenQuery.data;

  return (
    <div>
      <PageHeader
        eyebrow="Platform admin"
        title="Module Registry"
        description="Define product areas and the sub-functions inside them. Used by the sidebar, the package builder, and your code."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCodeOpen(true)}>
              <Code2 className="h-3.5 w-3.5" />
              Get code
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-brand-gradient text-primary-foreground shadow-glow hover:opacity-95"
              onClick={() => setNewParentOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              New module
            </Button>
          </div>
        }
      />

      <div className="grid gap-5 p-4 sm:p-6 md:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* ── Parent modules ─────────────────────────────────────────────────────── */}
        <section className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-display text-sm font-semibold">Modules</h2>
            <Badge variant="outline" className="font-normal">
              {parents?.total ?? 0}
            </Badge>
          </div>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search modules…"
              value={parentSearch}
              onChange={(e) => setParentSearch(e.target.value)}
            />
          </div>

          {parentsQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : (parents?.items.length ?? 0) === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No modules found.</p>
          ) : (
            <div className="space-y-2">
              {parents!.items.map((mod) => (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => setSelected(mod)}
                  className={`flex w-full items-start gap-2 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50 ${
                    selected?.id === mod.id ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <Boxes className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{mod.name}</span>
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                        {mod.key}
                      </code>
                      {!mod.isEnabled && <Badge variant="outline">Disabled</Badge>}
                    </span>
                    {mod.route && (
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">{mod.route}</span>
                    )}
                  </span>
                  <span
                    className="flex shrink-0 items-center gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-[10px] text-muted-foreground">Sidebar</span>
                    <Switch
                      checked={mod.showInSidebar}
                      onCheckedChange={() => toggleSidebar.mutate(mod)}
                    />
                  </span>
                </button>
              ))}
            </div>
          )}

          {parents && (
            <div className="mt-3">
              <PaginationBar
                page={parents.page}
                pages={parents.pages}
                total={parents.total}
                limit={parents.limit}
                onPageChange={setParentPage}
                label="modules"
              />
            </div>
          )}
        </section>

        {/* ── Child modules of the selected parent ───────────────────────────────── */}
        <section className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
          {!selected ? (
            <div className="grid h-full min-h-48 place-items-center text-center">
              <p className="text-sm text-muted-foreground">
                Select a module to see and manage its sub-functions.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-sm font-semibold">
                  {selected.name} — sub-functions
                </h2>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setNewChildOpen(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search sub-functions…"
                  value={childSearch}
                  onChange={(e) => setChildSearch(e.target.value)}
                />
              </div>

              {childrenQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 rounded-lg" />
                  ))}
                </div>
              ) : (children?.items.length ?? 0) === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No sub-functions mapped to this module yet.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {children!.items.map((child) => (
                    <div
                      key={child.id}
                      className="flex items-start gap-2 rounded-lg border p-2.5 text-sm"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium">{child.name}</span>
                          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                            {child.key}
                          </code>
                        </span>
                        {child.description && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {child.description}
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        title="Unmap from this module"
                        aria-label={`Unmap ${child.name}`}
                        className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
                        onClick={() => unmap.mutate(child.id)}
                      >
                        <Unlink className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {children && (
                <div className="mt-3">
                  <PaginationBar
                    page={children.page}
                    pages={children.pages}
                    total={children.total}
                    limit={children.limit}
                    onPageChange={setChildPage}
                    label="sub-functions"
                  />
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <NewParentDialog open={newParentOpen} onOpenChange={setNewParentOpen} onSuccess={refreshParents} />
      <NewChildDialog
        open={newChildOpen}
        onOpenChange={setNewChildOpen}
        parent={selected}
        onSuccess={refreshChildren}
      />
      <CodeDialog open={codeOpen} onOpenChange={setCodeOpen} parentKey={selected?.key} />
    </div>
  );
}

const KEY_HINT = "Lowercase letters, digits and underscores. This is what code references — it cannot be changed later.";

function NewParentDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [route, setRoute] = useState("");
  const [icon, setIcon] = useState("");
  const [showInSidebar, setShowInSidebar] = useState(true);

  useEffect(() => {
    if (!open) {
      setKey(""); setName(""); setRoute(""); setIcon(""); setShowInSidebar(true);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      createParentModule({
        key: key.trim(),
        name: name.trim(),
        route: route.trim() || null,
        icon: icon.trim() || null,
        showInSidebar,
      }),
    onSuccess: () => {
      toast.success("Module created");
      onOpenChange(false);
      onSuccess();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New module</DialogTitle>
          <DialogDescription>A top-level product area.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm">Key</Label>
            <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="content_studio" />
            <p className="text-[11px] text-muted-foreground">{KEY_HINT}</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Content Studio" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Route</Label>
              <Input value={route} onChange={(e) => setRoute(e.target.value)} placeholder="/content" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Icon</Label>
              <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="Sparkles" />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm">Show in sidebar</span>
            <Switch checked={showInSidebar} onCheckedChange={setShowInSidebar} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!key.trim() || !name.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Creating…" : "Create module"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewChildDialog({
  open,
  onOpenChange,
  parent,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  parent: ParentModule | null;
  onSuccess: () => void;
}) {
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) { setKey(""); setName(""); setDescription(""); }
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      createChildModule({
        key: key.trim(),
        name: name.trim(),
        description: description.trim() || null,
        parentModuleId: parent?.id ?? null,
      }),
    onSuccess: () => {
      toast.success("Sub-function created and mapped");
      onOpenChange(false);
      onSuccess();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New sub-function</DialogTitle>
          <DialogDescription>
            Created and mapped to {parent?.name ?? "the selected module"} in one step.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm">Key</Label>
            <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="bulk_export" />
            <p className="text-[11px] text-muted-foreground">{KEY_HINT}</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bulk export" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Description</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this sub-function lets someone do."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!key.trim() || !name.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The generated constants an operator pastes into the codebase to reference modules by name. */
function CodeDialog({
  open,
  onOpenChange,
  parentKey,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  parentKey?: string;
}) {
  const codeQuery = useQuery({
    queryKey: ["registry-codegen", parentKey ?? "all"],
    queryFn: () => getModuleConstants(parentKey),
    enabled: open,
  });

  const code = typeof codeQuery.data === "string" ? codeQuery.data : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Module constants</DialogTitle>
          <DialogDescription>
            {parentKey
              ? `Generated for "${parentKey}". Paste into your codebase and reference modules by constant instead of by string.`
              : "Generated for every module. Select a module first to scope this to one."}
          </DialogDescription>
        </DialogHeader>
        {codeQuery.isLoading ? (
          <Skeleton className="h-64 rounded-lg" />
        ) : (
          <pre className="max-h-[50vh] overflow-auto rounded-lg border bg-muted/50 p-3 font-mono text-[11px] leading-relaxed">
            {code || "// nothing to generate"}
          </pre>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() => {
              void navigator.clipboard.writeText(code).then(
                () => toast.success("Copied"),
                () => toast.error("Clipboard unavailable — select and copy manually")
              );
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </Button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
