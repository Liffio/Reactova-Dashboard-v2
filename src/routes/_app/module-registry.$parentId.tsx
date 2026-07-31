import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Blocks, Link2, Link2Off, Plus, Search, X } from "lucide-react";
import { toast } from "@/lib/toast";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformPermissionRoute } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  BackLink,
  CopyableKey,
  EmptyState,
  Field,
  FormActions,
  FormSection,
  SaveCancel,
  ToggleRow,
} from "@/components/admin/form-page";
import { NAV_GROUPS } from "@/lib/registry-constants";
import { useDebounced } from "@/hooks/use-debounced";
import { deriveKey, isValidKey } from "@/lib/module-key";
import {
  createChildModule,
  getDisableImpact,
  getRegistryTree,
  listChildModules,
  mapChildToParent,
  unmapChildFromParent,
  updateParentModule,
  type RegistryTreeNode,
} from "@/lib/api/registry-api";

const MODULE_MANAGE = "platform:module_manage";
const PAGE_SIZE = 15;

export const Route = createFileRoute("/_app/module-registry/$parentId")({
  head: () => ({ meta: [{ title: "Module — Admin" }] }),
  component: ModuleDetailRoute,
});

function ModuleDetailRoute() {
  return (
    <PlatformPermissionRoute permission={MODULE_MANAGE}>
      <ModuleDetailPage />
    </PlatformPermissionRoute>
  );
}

function ModuleDetailPage() {
  const { parentId } = useParams({ from: "/_app/module-registry/$parentId" });
  const navigate = useNavigate();

  /**
   * The tree carries every field the form needs in one request and doubles as the source for the
   * mapping panel. There is no `GET /parents/:id` endpoint, and the tree is bounded by the size of
   * the product rather than by tenant data, so this is cheap and stays cheap.
   */
  const treeQuery = useQuery({
    queryKey: ["registry-tree"],
    queryFn: getRegistryTree,
    staleTime: 60 * 1000,
  });

  const module = treeQuery.data?.modules.find((m) => m.id === parentId);

  if (treeQuery.isLoading) {
    return (
      <div className="space-y-4 p-4 sm:p-6 md:p-10">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!module) {
    return (
      <div className="p-4 sm:p-6 md:p-10">
        <EmptyState icon={Blocks} title="Module not found">
          It may have been removed. Go back to the registry to see what exists.
        </EmptyState>
        <div className="mt-4">
          <Button variant="outline" onClick={() => void navigate({ to: "/module-registry" })}>
            Back to Module Registry
          </Button>
        </div>
      </div>
    );
  }

  return <ModuleDetail module={module} />;
}

function ModuleDetail({ module }: { module: RegistryTreeNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState(module.name);
  const [description, setDescription] = useState(module.description ?? "");
  const [route, setRoute] = useState(module.route ?? "");
  const [icon, setIcon] = useState(module.icon ?? "");
  const [navGroup, setNavGroup] = useState(module.navGroup ?? "Workspace");
  const [requiredPermission, setRequiredPermission] = useState(module.requiredPermission ?? "");
  const [apiPrefix, setApiPrefix] = useState(module.apiPrefix ?? "");
  const [showInSidebar, setShowInSidebar] = useState(module.showInSidebar);
  const [confirmDisable, setConfirmDisable] = useState(false);

  // Re-seed when the underlying record changes (a refetch after save, or navigating between
  // modules without unmounting) so the form never shows a stale value as if it were current.
  useEffect(() => {
    setName(module.name);
    setDescription(module.description ?? "");
    setRoute(module.route ?? "");
    setIcon(module.icon ?? "");
    setNavGroup(module.navGroup ?? "Workspace");
    setRequiredPermission(module.requiredPermission ?? "");
    setApiPrefix(module.apiPrefix ?? "");
    setShowInSidebar(module.showInSidebar);
  }, [module]);

  const refreshRegistry = () => {
    void queryClient.invalidateQueries({ queryKey: ["registry-tree"] });
    void queryClient.invalidateQueries({ queryKey: ["registry-parents"] });
    void queryClient.invalidateQueries({ queryKey: ["registry-children"] });
    void queryClient.invalidateQueries({ queryKey: ["navigation"] });
  };

  const dirty =
    name !== module.name ||
    description !== (module.description ?? "") ||
    route !== (module.route ?? "") ||
    icon !== (module.icon ?? "") ||
    navGroup !== (module.navGroup ?? "Workspace") ||
    requiredPermission !== (module.requiredPermission ?? "") ||
    apiPrefix !== (module.apiPrefix ?? "") ||
    showInSidebar !== module.showInSidebar;

  const save = useMutation({
    mutationFn: () =>
      updateParentModule(module.id, {
        name: name.trim(),
        description: description.trim() || null,
        route: route.trim() || null,
        icon: icon.trim() || null,
        navGroup,
        requiredPermission: requiredPermission.trim() || null,
        apiPrefix: apiPrefix.trim() || null,
        showInSidebar,
      }),
    onSuccess: () => {
      toast.success("Module updated");
      refreshRegistry();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const setEnabled = useMutation({
    mutationFn: (isEnabled: boolean) => updateParentModule(module.id, { isEnabled }),
    onSuccess: (_r, isEnabled) => {
      toast.success(isEnabled ? "Module enabled" : "Module disabled");
      setConfirmDisable(false);
      refreshRegistry();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div>
      <PageHeader
        eyebrow={<BackLink to="/module-registry">Module Registry</BackLink>}
        title={module.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <CopyableKey value={module.key} />
            {module.apiPrefix && <CopyableKey value={module.apiPrefix} />}
            {!module.isEnabled && <Badge variant="outline">Disabled</Badge>}
          </span>
        }
        actions={
          module.isEnabled ? (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmDisable(true)}
            >
              Disable module
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEnabled.mutate(true)}>
              Enable module
            </Button>
          )
        }
      />

      <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6 md:p-10">
        <FormSection
          title="Identity"
          description="The key is fixed — code, grants, mappings and packages all reference it."
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" required>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Key" hint="Immutable. Create a new module to change it.">
                <Input className="font-mono" value={module.key} readOnly disabled />
              </Field>
            </div>
            <Field label="Description">
              <Textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this product area covers."
              />
            </Field>
          </div>
        </FormSection>

        <FormSection
          title="Navigation"
          description="Where this appears in a tenant's sidebar, and who sees it."
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Route">
                <Input
                  value={route}
                  onChange={(e) => setRoute(e.target.value)}
                  placeholder="/content"
                />
              </Field>
              <Field label="Icon" hint="A lucide-react icon name.">
                <Input
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  placeholder="Sparkles"
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Sidebar group">
                <Select value={navGroup} onValueChange={setNavGroup}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NAV_GROUPS.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field
                label="Required permission"
                hint="Blank means everyone with a sidebar sees this link."
              >
                <Input
                  className="font-mono"
                  value={requiredPermission}
                  onChange={(e) => setRequiredPermission(e.target.value)}
                  placeholder={`${module.key}:read`}
                />
              </Field>
            </div>
            <ToggleRow
              label="Show in sidebar"
              description="Presentation only — a hidden module still works."
            >
              <Switch checked={showInSidebar} onCheckedChange={setShowInSidebar} />
            </ToggleRow>
          </div>
        </FormSection>

        <FormSection
          title="API surface"
          description="Everything under this path answers 404 while the module is disabled."
        >
          <Field
            label="API prefix"
            hint="Admin, auth, public and external paths are reserved and are never masked."
          >
            <Input
              className="font-mono"
              value={apiPrefix}
              onChange={(e) => setApiPrefix(e.target.value)}
              placeholder="/api/v1/content"
            />
          </Field>
        </FormSection>

        <SubFunctions module={module} onChanged={refreshRegistry} />

        <FormActions hint={dirty ? "Unsaved changes" : "All changes saved"}>
          <SaveCancel
            onCancel={() => void navigate({ to: "/module-registry" })}
            onSave={() => save.mutate()}
            saving={save.isPending}
            disabled={!dirty || !name.trim()}
          />
        </FormActions>
      </div>

      <DisableDialog
        module={module}
        open={confirmDisable}
        onOpenChange={setConfirmDisable}
        onConfirm={() => setEnabled.mutate(false)}
        pending={setEnabled.isPending}
      />
    </div>
  );
}

/**
 * Mapped sub-functions, plus the two ways to add one — link an existing capability, or create a
 * new one. Both are tabs on this page rather than dialogs, so the list you are changing stays
 * visible while you change it.
 */
function SubFunctions({ module, onChanged }: { module: RegistryTreeNode; onChanged: () => void }) {
  const [tab, setTab] = useState("mapped");

  return (
    <FormSection
      title="Sub-functions"
      description="The capabilities inside this module. These are what roles grant and packages include."
      actions={
        <Badge variant="outline" className="font-normal">
          {module.children.length} mapped
        </Badge>
      }
    >
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="mapped">Mapped</TabsTrigger>
          <TabsTrigger value="link">Link existing</TabsTrigger>
          <TabsTrigger value="create">Create new</TabsTrigger>
        </TabsList>

        <TabsContent value="mapped">
          <MappedList module={module} onChanged={onChanged} />
        </TabsContent>
        <TabsContent value="link">
          <LinkExisting module={module} onChanged={onChanged} />
        </TabsContent>
        <TabsContent value="create">
          <CreateChild module={module} onChanged={onChanged} onCreated={() => setTab("mapped")} />
        </TabsContent>
      </Tabs>
    </FormSection>
  );
}

function MappedList({ module, onChanged }: { module: RegistryTreeNode; onChanged: () => void }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebounced(search);
  useEffect(() => setPage(1), [debounced]);

  const query = useQuery({
    queryKey: ["registry-children", module.id, debounced, page],
    // Filtered and counted in SQL by parent — never the full list narrowed in the browser.
    queryFn: () =>
      listChildModules({
        parentModuleId: module.id,
        q: debounced || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const unmap = useMutation({
    mutationFn: (childId: string) => unmapChildFromParent(module.id, childId),
    onSuccess: () => {
      toast.success("Unmapped from this module");
      void query.refetch();
      onChanged();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const data = query.data;

  return (
    <div className="space-y-3">
      <SearchBox value={search} onChange={setSearch} placeholder="Search mapped sub-functions…" />

      {query.isLoading ? (
        <ListSkeleton />
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={Blocks}
          title={debounced ? "Nothing matches that search." : "No sub-functions yet."}
        >
          {!debounced && "Link an existing capability or create a new one."}
        </EmptyState>
      ) : (
        <div className="space-y-1.5">
          {data!.items.map((child) => (
            <div
              key={child.id}
              className="flex items-start gap-2 rounded-lg border bg-card p-2.5 text-sm"
            >
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{child.name}</span>
                  <CopyableKey value={child.key} />
                  {!child.isEnabled && <Badge variant="outline">Disabled</Badge>}
                </span>
                {child.description && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {child.description}
                  </span>
                )}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0 gap-1.5 text-muted-foreground hover:text-destructive"
                onClick={() => unmap.mutate(child.id)}
                disabled={unmap.isPending}
              >
                <Link2Off className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Unmap</span>
              </Button>
            </div>
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
          label="sub-functions"
        />
      )}
    </div>
  );
}

/**
 * Link a capability that already exists elsewhere in the registry.
 *
 * The list is every child module, paginated and searched server-side, with each row showing
 * whether it is already mapped here. Deliberately not filtered down to "unmapped only": that
 * would mean discarding rows from a server-counted page, so the totals and page numbers would
 * stop matching what is on screen.
 */
function LinkExisting({ module, onChanged }: { module: RegistryTreeNode; onChanged: () => void }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebounced(search);
  useEffect(() => setPage(1), [debounced]);

  const query = useQuery({
    queryKey: ["registry-children", "all", debounced, page],
    queryFn: () => listChildModules({ q: debounced || undefined, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const mappedKeys = useMemo(() => new Set(module.children.map((c) => c.key)), [module.children]);

  const map = useMutation({
    mutationFn: (childId: string) => mapChildToParent(module.id, childId),
    onSuccess: () => {
      toast.success(`Linked to ${module.name}`);
      onChanged();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const unmap = useMutation({
    mutationFn: (childId: string) => unmapChildFromParent(module.id, childId),
    onSuccess: () => {
      toast.success("Unlinked");
      onChanged();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const data = query.data;

  return (
    <div className="space-y-3">
      <SearchBox value={search} onChange={setSearch} placeholder="Search all sub-functions…" />

      {query.isLoading ? (
        <ListSkeleton />
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyState icon={Search} title="Nothing matches that search." />
      ) : (
        <div className="space-y-1.5">
          {data!.items.map((child) => {
            const isMapped = mappedKeys.has(child.key);
            return (
              <div
                key={child.id}
                className={`flex items-center gap-2 rounded-lg border p-2.5 text-sm ${
                  isMapped ? "border-primary/30 bg-primary/5" : "bg-card"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{child.name}</span>
                    <CopyableKey value={child.key} />
                  </span>
                  {child.description && (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {child.description}
                    </span>
                  )}
                </span>
                {isMapped ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 gap-1.5 text-muted-foreground hover:text-destructive"
                    onClick={() => unmap.mutate(child.id)}
                    disabled={unmap.isPending}
                  >
                    <X className="h-3.5 w-3.5" />
                    Linked
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1.5"
                    onClick={() => map.mutate(child.id)}
                    disabled={map.isPending}
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Link
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {data && (
        <PaginationBar
          page={data.page}
          pages={data.pages}
          total={data.total}
          limit={data.limit}
          onPageChange={setPage}
          label="sub-functions"
        />
      )}
    </div>
  );
}

function CreateChild({
  module,
  onChanged,
  onCreated,
}: {
  module: RegistryTreeNode;
  onChanged: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState("");

  // Capability keys are namespaced by their module, matching how they resolve at runtime.
  const suffix = keyTouched ? key : deriveKey(name);
  const fullKey = suffix ? `${module.key}_${suffix}` : "";
  const keyError =
    suffix.length > 0 && !isValidKey(fullKey)
      ? "Lowercase letters, digits and underscores, starting with a letter."
      : null;

  const create = useMutation({
    mutationFn: () =>
      createChildModule({
        key: fullKey,
        name: name.trim(),
        description: description.trim() || null,
        parentModuleId: module.id,
      }),
    onSuccess: () => {
      toast.success("Sub-function created and mapped");
      setName("");
      setKey("");
      setKeyTouched(false);
      setDescription("");
      onChanged();
      onCreated();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const canSave = name.trim().length > 0 && suffix.length > 0 && !keyError;

  return (
    <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bulk export" />
        </Field>
        <Field
          label="Key"
          required
          error={keyError}
          hint={fullKey ? `Stored as ${fullKey}` : `Prefixed with ${module.key}_`}
        >
          <Input
            className="font-mono"
            value={suffix}
            onChange={(e) => {
              setKeyTouched(true);
              setKey(e.target.value);
            }}
            placeholder="bulk_export"
          />
        </Field>
      </div>
      <Field label="Description" hint="What this lets someone do. Shown in Access Management.">
        <Textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Export every row matching the current filter."
        />
      </Field>
      <div className="flex justify-end">
        <Button
          size="sm"
          className="gap-1.5"
          disabled={!canSave || create.isPending}
          onClick={() => create.mutate()}
        >
          <Plus className="h-3.5 w-3.5" />
          {create.isPending ? "Creating…" : "Create and map"}
        </Button>
      </div>
    </div>
  );
}

/** Names the blast radius before an operator can confirm. */
function DisableDialog({
  module,
  open,
  onOpenChange,
  onConfirm,
  pending,
}: {
  module: RegistryTreeNode;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  const impactQuery = useQuery({
    queryKey: ["registry-impact", module.id],
    queryFn: () => getDisableImpact(module.id),
    enabled: open,
  });

  const impact = impactQuery.data;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disable {module.name}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>This takes effect for every workspace within seconds.</p>
              <ul className="space-y-1.5 rounded-lg border bg-muted/30 p-3 text-xs">
                <li>
                  {impact?.apiPrefix ? (
                    <>
                      Every request under <code className="font-mono">{impact.apiPrefix}</code> will
                      answer <strong>404</strong>.
                    </>
                  ) : (
                    "This module owns no API prefix, so no endpoints change."
                  )}
                </li>
                <li>
                  {impact?.capabilityCount ?? module.children.length} sub-function
                  {(impact?.capabilityCount ?? module.children.length) === 1 ? "" : "s"} disappear
                  from Access Management.
                </li>
                <li>The sidebar entry is removed for everyone.</li>
              </ul>
              <p>
                Type <code className="font-mono font-semibold">{module.key}</code> to confirm.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Input
          className="font-mono"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={module.key}
          aria-label="Type the module key to confirm"
        />

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={typed.trim() !== module.key || pending}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {pending ? "Disabling…" : "Disable module"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="pl-9"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 rounded-lg" />
      ))}
    </div>
  );
}
