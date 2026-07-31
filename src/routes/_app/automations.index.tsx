import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  MessageCircle,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Search,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "@/lib/toast";

import { PageHeader } from "@/components/dashboard/page-header";
import { ProtectedRoute } from "@/components/auth/guards";
import { InstagramRequired } from "@/components/auth/instagram-required";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { PaginationBar } from "@/components/ui/pagination-bar";
import {
  deleteAutomation,
  getAutomationStatusCounts,
  updateAutomation,
  type Automation,
  type AutomationStatus,
} from "@/lib/api/automations-api";
import { apiUri } from "@/lib/api/apiUri";
import { useServerList } from "@/hooks/use-server-list";
import { formatNum } from "@/lib/format";
import { useApp } from "@/state/app-context";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/motion";

export const Route = createFileRoute("/_app/automations/")({
  head: () => ({ meta: [{ title: "Automations — Liffio" }] }),
  component: AutomationsRoute,
});

function AutomationsRoute() {
  return (
    <ProtectedRoute module="automation">
      <InstagramRequired feature="Automations">
        <AutomationsPage />
      </InstagramRequired>
    </ProtectedRoute>
  );
}

const statusStyles: Record<AutomationStatus, string> = {
  ACTIVE: "border-success/30 bg-success/10 text-success",
  PAUSED: "border-warning/30 bg-warning/10 text-warning",
  DRAFT: "border-border bg-muted text-muted-foreground",
};

/** Tab label → the status it filters on. `All` clears the filter rather than sending one. */
const TABS = [
  { label: "All", status: null },
  { label: "Active", status: "ACTIVE" },
  { label: "Paused", status: "PAUSED" },
  { label: "Drafts", status: "DRAFT" },
] as const;

function AutomationsPage() {
  const { current } = useApp();
  const workspaceId = current.id;
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState<Automation | null>(null);

  const workspaceReady = Boolean(workspaceId) && workspaceId !== "default";

  /**
   * Search, status filter, sort and paging all resolve in SQL. This holds one page — there is no
   * full list in the browser to narrow, which is the whole point of the change.
   */
  const list = useServerList<Automation>({
    path: apiUri.automations.search,
    queryKey: "automations",
    workspaceId,
    defaultSort: { key: "createdAt", dir: "desc" },
    defaultLimit: 24,
    enabled: workspaceReady,
  });

  /**
   * Tab counts come from their own aggregate rather than the current page.
   *
   * Deriving them from `list.items` would make each tab report how many of *this page's* 24 rows
   * matched, so "Active (7)" would change as you paged. The counts describe the workspace.
   */
  const countsQuery = useQuery({
    queryKey: ["automation-status-counts", workspaceId],
    queryFn: () => getAutomationStatusCounts(workspaceId),
    enabled: workspaceReady,
  });

  const activeStatus = (list.getFilter("status") as AutomationStatus | undefined) ?? null;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["automations"] });
    void queryClient.invalidateQueries({ queryKey: ["automation-status-counts", workspaceId] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
  };

  const toggleStatusMutation = useMutation({
    mutationFn: (input: { id: string; status: AutomationStatus }) =>
      updateAutomation(workspaceId, input.id, { status: input.status }),
    onSuccess: (_, input) => {
      toast.success(input.status === "ACTIVE" ? "Automation activated" : "Automation paused");
      invalidate();
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAutomation(workspaceId, id),
    onSuccess: () => {
      toast.success("Automation deleted");
      setDeleting(null);
      invalidate();
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const automations = list.items;

  return (
    <div>
      <PageHeader
        eyebrow="Automate"
        title="Automations"
        description="Trigger DMs from comments — every keyword gets its own message and link."
        actions={
          <Button
            size="sm"
            asChild
            className="gap-1.5 bg-brand-gradient text-primary-foreground shadow-glow hover:opacity-95"
          >
            <Link to="/automations/new">
              <Plus className="h-4 w-4" />
              New automation
            </Link>
          </Button>
        }
      />

      <div className="space-y-5 p-4 sm:p-6 md:p-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name or keyword…"
              className="pl-9"
              value={list.search}
              onChange={(e) => list.setSearch(e.target.value)}
            />
            {/* The term is typed but not yet sent. Without this the list looks unresponsive
                during the debounce, and people retype. */}
            {list.searchPending && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                …
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <Button
                key={t.label}
                variant={activeStatus === t.status ? "default" : "outline"}
                size="sm"
                className="gap-1.5"
                onClick={() => list.setFilter("status", "eq", t.status ?? undefined)}
              >
                {t.label}
                {countsQuery.data && (
                  <span className="text-[10px] opacity-70">
                    {t.status ? (countsQuery.data[t.status] ?? 0) : countsQuery.data.all}
                  </span>
                )}
              </Button>
            ))}
          </div>
        </div>

        {list.error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {list.error.message}
          </div>
        )}

        {list.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-2xl" />
            ))}
          </div>
        ) : automations.length === 0 ? (
          <div className="rounded-2xl border bg-card p-10 text-center shadow-soft">
            <Zap className="mx-auto h-8 w-8 text-muted-foreground" />
            <h3 className="mt-3 font-display text-lg font-semibold">
              {list.isNarrowed ? "No automations match" : "No automations yet"}
            </h3>
            {/* `isNarrowed` rather than a row count: with server-side paging an empty page no
                longer tells you whether the workspace is empty or the filter is just too narrow. */}
            <p className="mt-1 text-sm text-muted-foreground">
              {list.isNarrowed
                ? "Try a different search or filter."
                : "Create your first automation to start turning comments into DMs."}
            </p>
            {list.isNarrowed ? (
              <Button size="sm" variant="outline" className="mt-4" onClick={list.clear}>
                Clear filters
              </Button>
            ) : (
              <Button asChild size="sm" className="mt-4 gap-1.5">
                <Link to="/automations/new">
                  <Plus className="h-4 w-4" />
                  New automation
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {automations.map((a) => (
              <motion.article
                key={a.id}
                variants={staggerItem}
                whileHover={{ y: -2, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] } }}
                className="group relative flex flex-col rounded-2xl border bg-card p-5 shadow-soft transition-shadow hover:shadow-glow"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent">
                    <Zap className="h-4 w-4 text-accent-foreground" />
                  </div>
                  <Badge variant="outline" className={statusStyles[a.status]}>
                    {a.status.toLowerCase()}
                  </Badge>
                </div>
                <h3 className="font-display text-base font-semibold leading-snug">{a.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {a.postScope === "specific"
                    ? "Specific post"
                    : a.postScope === "next"
                      ? "Next post"
                      : "All posts"}{" "}
                  · {a.anyComment ? "any comment" : "keyword match"}
                </p>
                {a.keywords.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {a.keywords.slice(0, 6).map((k) => (
                      <span
                        key={k}
                        className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] font-medium tracking-wide"
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{a.dmMessage}</p>
                <div className="mt-auto flex items-center justify-between border-t pt-4 text-xs">
                  <span className="inline-flex items-center gap-1.5 font-medium tabular-nums">
                    <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    {formatNum(a._count?.dmJobs ?? 0)} DMs
                  </span>
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(a.updatedAt).toLocaleDateString()}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="rounded-md p-1 hover:bg-muted">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {a.status === "ACTIVE" ? (
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() =>
                            toggleStatusMutation.mutate({ id: a.id, status: "PAUSED" })
                          }
                        >
                          <Pause className="mr-2 h-4 w-4" /> Pause
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() =>
                            toggleStatusMutation.mutate({ id: a.id, status: "ACTIVE" })
                          }
                        >
                          <Play className="mr-2 h-4 w-4" /> Activate
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="cursor-pointer text-destructive focus:text-destructive"
                        onClick={() => setDeleting(a)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </motion.article>
            ))}
          </motion.div>
        )}

        {list.total > 0 && (
          <PaginationBar
            page={list.page}
            pages={list.pages}
            total={list.total}
            limit={list.limit}
            onPageChange={list.setPage}
            label="automations"
          />
        )}
      </div>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleting?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This stops the automation immediately. DM history and captured leads are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
