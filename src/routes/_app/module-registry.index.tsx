import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Boxes, ChevronRight, Code2, Copy, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlatformPermissionRoute } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { CopyableKey, EmptyState } from "@/components/admin/form-page";
import { useDebounced } from "@/hooks/use-debounced";
import {
  getModuleConstants,
  listParentModules,
  updateParentModule,
  type ParentModule,
} from "@/lib/api/registry-api";

const MODULE_MANAGE = "platform:module_manage";
const PAGE_SIZE = 20;

export const Route = createFileRoute("/_app/module-registry/")({
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
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showCode, setShowCode] = useState(false);

  const debouncedSearch = useDebounced(search);
  // Searching resets to page 1: staying on page 4 of the old result set would show an empty page.
  useEffect(() => setPage(1), [debouncedSearch]);

  const parentsQuery = useQuery({
    queryKey: ["registry-parents", debouncedSearch, page],
    // Search and paging run in SQL — this only ever holds one page.
    queryFn: () => listParentModules({ q: debouncedSearch || undefined, page, limit: PAGE_SIZE }),
    // Keeps the previous page visible while the next loads, instead of collapsing to a skeleton.
    placeholderData: keepPreviousData,
  });

  const toggleSidebar = useMutation({
    mutationFn: (mod: ParentModule) =>
      updateParentModule(mod.id, { showInSidebar: !mod.showInSidebar }),
    onSuccess: () => {
      toast.success("Sidebar visibility updated");
      void queryClient.invalidateQueries({ queryKey: ["registry-parents"] });
      void queryClient.invalidateQueries({ queryKey: ["navigation"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const data = parentsQuery.data;

  return (
    <div>
      <PageHeader
        eyebrow="Platform admin"
        title="Module Registry"
        description="Define product areas and the sub-functions inside them. Drives the sidebar, the package builder, access control and your generated code."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild className="gap-1.5">
              <Link to="/module-registry/docs">
                <BookOpen className="h-3.5 w-3.5" />
                Developer guide
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setShowCode(true)}
            >
              <Code2 className="h-3.5 w-3.5" />
              Get code
            </Button>
            <Button
              size="sm"
              asChild
              className="gap-1.5 bg-brand-gradient text-primary-foreground shadow-glow hover:opacity-95"
            >
              <Link to="/module-registry/new">
                <Plus className="h-3.5 w-3.5" />
                New module
              </Link>
            </Button>
          </div>
        }
      />

      <div className="space-y-4 p-4 sm:p-6 md:p-10">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search modules…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {parentsQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[68px] rounded-xl" />
            ))}
          </div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <EmptyState
            icon={Boxes}
            title={debouncedSearch ? "No modules match that search." : "No modules yet."}
          >
            {!debouncedSearch && "Create one to start describing the product."}
          </EmptyState>
        ) : (
          <div className="space-y-2">
            {data!.items.map((mod) => (
              <div
                key={mod.id}
                role="button"
                tabIndex={0}
                onClick={() =>
                  void navigate({ to: "/module-registry/$parentId", params: { parentId: mod.id } })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    void navigate({
                      to: "/module-registry/$parentId",
                      params: { parentId: mod.id },
                    });
                  }
                }}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 sm:p-4 ${
                  mod.isEnabled ? "" : "opacity-60"
                }`}
              >
                <Boxes className="h-4 w-4 shrink-0 text-muted-foreground" />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{mod.name}</span>
                    <CopyableKey value={mod.key} />
                    {!mod.isEnabled && <Badge variant="outline">Disabled</Badge>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    {mod.route && <span>{mod.route}</span>}
                    {mod.apiPrefix && <span className="font-mono">{mod.apiPrefix}</span>}
                    {mod.navGroup && <span>· {mod.navGroup}</span>}
                  </div>
                </div>

                {/* Stops the row navigation from firing when the switch is what was clicked. */}
                <div
                  className="flex shrink-0 items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <span className="hidden text-[10px] text-muted-foreground sm:inline">
                    Sidebar
                  </span>
                  <Switch
                    checked={mod.showInSidebar}
                    onCheckedChange={() => toggleSidebar.mutate(mod)}
                    aria-label={`Show ${mod.name} in sidebar`}
                  />
                </div>

                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
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
            label="modules"
          />
        )}
      </div>

      {showCode && <ConstantsPanel onClose={() => setShowCode(false)} />}
    </div>
  );
}

/**
 * The generated constants, shown inline rather than in a dialog.
 *
 * Reading code and copying it is a two-handed job — an operator usually wants it beside the module
 * list, not covering it.
 */
function ConstantsPanel({ onClose }: { onClose: () => void }) {
  const codeQuery = useQuery({
    queryKey: ["registry-codegen", "all"],
    queryFn: () => getModuleConstants(),
  });

  const code = typeof codeQuery.data === "string" ? codeQuery.data : "";

  return (
    <div className="px-4 pb-8 sm:px-6 md:px-10">
      <div className="rounded-2xl border bg-card p-4 shadow-soft sm:p-6">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-sm font-semibold">Module constants</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Import these instead of writing module keys as strings — a typo in a literal compiles
              fine and fails at runtime, a missing constant is a build error.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={!code}
              onClick={() => {
                void navigator.clipboard.writeText(code).then(
                  () => toast.success("Copied"),
                  () => toast.error("Clipboard unavailable — select and copy manually"),
                );
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        {codeQuery.isLoading ? (
          <Skeleton className="h-56 rounded-lg" />
        ) : (
          <pre className="max-h-[420px] overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
            {code || "// nothing to generate"}
          </pre>
        )}
      </div>
    </div>
  );
}
