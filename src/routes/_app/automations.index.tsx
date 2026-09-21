import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  MessageCircle,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "@/lib/toast";

import { PageHeader } from "@/components/dashboard/page-header";
import { useOnboardingState, useSaveOnboarding, useWorkspaceUsage } from "@/hooks/use-onboarding";
import { templateById } from "@/lib/onboarding/templates";
import { SendRateCard } from "@/components/settings/send-rate-card";
import { ProtectedRoute } from "@/components/auth/guards";
import { InstagramRequired } from "@/components/auth/instagram-required";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  postScopeLabel,
} from "@/lib/api/automations-api";
import { apiUri } from "@/lib/api/apiUri";
import { useServerList } from "@/hooks/use-server-list";
import { formatNum } from "@/lib/format";
import { useApp } from "@/state/app-context";
import { useCan } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { isWorkspaceReady } from "@/lib/api/active-workspace";

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
  const navigate = useNavigate();
  // Shared query keys with the dashboard — arriving from Home costs no extra request.
  const { state: onboarding } = useOnboardingState(workspaceId);
  const { save } = useSaveOnboarding(workspaceId);
  const { data: usage } = useWorkspaceUsage(workspaceId);
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState<Automation | null>(null);

  const workspaceReady = isWorkspaceReady(workspaceId);

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

  // Backend-resolved: the item is hidden rather than shown-and-rejected for a viewer who cannot
  // update automations. Never a role check — the permission is whatever the server granted.
  const canEdit = useCan("automation", "update");

  /**
   * 🔴 The card's status pill moves before the request lands, and moves back if it fails. (A3)
   *
   * The switch is a direct manipulation: the person flips it and expects the card to follow. Before
   * this the mutation only invalidated on success, so the pill sat on the old status until a
   * refetch returned, and on a slow connection the switch and the pill disagreed for a second or
   * two. A toggle that does not appear to do anything gets flipped again.
   *
   * `setQueriesData` with a prefix key, not `setQueryData`: the list's real key carries the
   * workspace and the whole filter/sort/page body (`use-server-list.ts:186`), so there is one cache
   * entry per view and this card can be in several of them.
   */
  const toggleStatusMutation = useMutation({
    mutationFn: (input: { id: string; status: AutomationStatus }) =>
      updateAutomation(workspaceId, input.id, { status: input.status }),

    onMutate: async (input) => {
      // Stop an in-flight refetch resolving after the optimistic write and undoing it.
      await queryClient.cancelQueries({ queryKey: ["automations"] });
      const snapshot = queryClient.getQueriesData({ queryKey: ["automations"] });

      queryClient.setQueriesData<{ items: Automation[] }>({ queryKey: ["automations"] }, (old) =>
        old
          ? {
              ...old,
              items: old.items.map((a) => (a.id === input.id ? { ...a, status: input.status } : a)),
            }
          : old,
      );
      return { snapshot };
    },

    onError: (error, _input, context) => {
      /**
       * Every entry restored, not just the one the card was read from.
       *
       * A partial rollback is worse than none: the card would snap back on this tab and stay wrong
       * on the next one, and the person would have two answers about the same automation.
       */
      context?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast.error(`Could not change that automation. ${(error as Error).message}`);
    },

    onSuccess: (_, input) => {
      toast.success(input.status === "ACTIVE" ? "Automation activated" : "Automation paused");
    },

    /**
     * Counts are NOT optimistic and the refetch belongs here rather than in `onSuccess`.
     *
     * The tab counts are their own aggregate over the whole workspace, so guessing them from one
     * page would be inventing a number. They settle on the refetch, which runs after a failure too
     * so a rolled-back card is reconciled against the server rather than left on a local guess.
     */
    onSettled: () => invalidate(),
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

  /**
   * The dismissed/skipped suggestion, if there is one to bring back.
   *
   * Offered only while the workspace still has no automations — once one exists, the suggestion
   * has nothing left to suggest, and a link restoring it would be an invitation to start over.
   */
  const restorable =
    automations.length === 0 &&
    !list.isNarrowed &&
    onboarding.suggestedTemplate &&
    (onboarding.suggestedTemplate.skippedAt || onboarding.suggestedTemplate.dismissedAt)
      ? onboarding.suggestedTemplate
      : null;

  const restoreSuggestion = () => {
    if (!restorable) return;
    // Both timestamps cleared: the card comes back on Home AND the checklist regains its two
    // automation steps. Clearing only one would half-restore a decision that was made once.
    save({ suggestedTemplate: { id: restorable.id, version: 1 } });
    void navigate({ to: "/automations/new", search: { template: restorable.id } });
  };

  return (
    <TooltipProvider>
      <div>
        <PageHeader
          eyebrow="Automate"
          title="Automations"
          // The allowance, from the usage endpoint. Absent while loading and for unlimited
          // workspaces — the sentence has to be true or not said at all.
          description={
            usage?.automations.limit != null
              ? `${usage.automations.used} of ${usage.automations.limit} used${
                  usage.plan === "FREE" ? " on Free" : ""
                }`
              : "Trigger DMs from comments — every keyword gets its own message and link."
          }
          actions={
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={list.isFetching}
                onClick={() => {
                  void list.refetch();
                  void countsQuery.refetch();
                }}
              >
                <RefreshCw className={list.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                Sync
              </Button>
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
            </div>
          }
        />

        <div className="space-y-5 p-4 sm:p-6 md:p-10">
          {/* The rate control sits with the automations it governs, not only in settings: this is
            where someone comes when they suspect their automations are sending slowly. It carries
            the §13 reduction notice inline, which is why the standalone banner is not also here —
            two copies of the same sentence, one above the other, reads as a bug. */}
          <SendRateCard variant="inline" />

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

          <p className="text-xs text-muted-foreground">
            DM sent counts are not updated automatically. Click Sync to refresh them without
            reloading the page.
          </p>

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
                  : "Build one for any post. Nothing goes live until you say so."}
              </p>
              {list.isNarrowed ? (
                <Button size="sm" variant="outline" className="mt-4" onClick={list.clear}>
                  Clear filters
                </Button>
              ) : (
                <>
                  <Button asChild size="sm" className="mt-4 gap-1.5">
                    <Link to="/automations/new">
                      <Plus className="h-4 w-4" />
                      Create automation
                    </Link>
                  </Button>
                  {/*
                  The one place a dismissed suggestion can be recovered. (`plan/onboarding-revamp.md`)

                  A skip is meant to be final on Home — nothing there asks again. But "final" must
                  not mean "unreachable": someone who said "not now" in week one and comes looking
                  in week three arrives here, and this is where the template they were offered is
                  waiting. Clearing the skip also restores the two automation steps on the
                  dashboard checklist, which is the same decision reversed.
                */}
                  {restorable ? (
                    <button
                      type="button"
                      onClick={restoreSuggestion}
                      className="mx-auto mt-3 block text-sm text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
                    >
                      Show the {templateById(restorable.id).displayKeyword} template again
                    </button>
                  ) : null}
                </>
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
                    {/*
                    Live, in the top right. (A3)

                    Pausing and activating were only in the overflow menu, two taps and a read
                    behind a kebab. On means ACTIVE, off means PAUSED, and the pill beside it moves
                    with the switch because the mutation is optimistic.

                    A DRAFT is not a third position on a two-position switch. It renders off and
                    disabled with the reason attached, rather than being silently unflippable:
                    activating a draft is a decision about whether it is finished, and that belongs
                    in the builder where the unfinished parts are.
                  */}
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={statusStyles[a.status]}>
                        {a.status.toLowerCase()}
                      </Badge>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {/* A span, because a disabled Switch does not emit the events a tooltip needs. */}
                          <span className="inline-flex">
                            <Switch
                              aria-label={
                                a.status === "ACTIVE" ? `Pause ${a.name}` : `Set ${a.name} live`
                              }
                              checked={a.status === "ACTIVE"}
                              disabled={!canEdit || a.status === "DRAFT"}
                              onCheckedChange={(next) =>
                                toggleStatusMutation.mutate({
                                  id: a.id,
                                  status: next ? "ACTIVE" : "PAUSED",
                                })
                              }
                            />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {a.status === "DRAFT"
                            ? "Finish setting this up before it can go live."
                            : !canEdit
                              ? "You do not have permission to change automations."
                              : a.status === "ACTIVE"
                                ? "Live. Turn off to pause."
                                : "Paused. Turn on to go live."}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  <h3 className="font-display text-base font-semibold leading-snug">{a.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {/*
                      The wire value is the stored enum in upper case, so comparing it against the
                      lower-case vocabulary matched nothing and every card read "All posts". (F1)
                    */}
                    {postScopeLabel(a.postScope)} · {a.anyComment ? "any comment" : "keyword match"}
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
                    {/* Delivered only, and the window is named. This used to read "N DMs" over a
                      count of every DM job at every status for all time, so an automation with
                      500 consecutive failures read as the best performer on the page. */}
                    <span
                      className="inline-flex items-center gap-1.5 font-medium tabular-nums"
                      title="Delivered DMs, all time"
                    >
                      <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                      {formatNum(a._count?.dmJobsSent ?? 0)} sent
                      <span className="font-normal text-muted-foreground">· all time</span>
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
                        {canEdit && (
                          <DropdownMenuItem asChild className="cursor-pointer">
                            <Link
                              to="/automations/$automationId/edit"
                              params={{ automationId: a.id }}
                            >
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </Link>
                          </DropdownMenuItem>
                        )}
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
              {/* Deleting an automation hard-deletes its DmJob, Lead, AutomationFollowUp
                and PendingFollowDm rows (server: automations.ts DELETE handler). There is
                no soft-delete and no archive, so captured leads are gone for good. This
                copy previously promised the opposite — see backend issue #7. */}
              <AlertDialogDescription>
                This stops the automation immediately and permanently deletes its DM history and
                every lead it captured. This cannot be undone.
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
    </TooltipProvider>
  );
}
