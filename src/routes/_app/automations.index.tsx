import { useMemo, useState } from "react";
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
import { toast } from "sonner";

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
import {
  deleteAutomation,
  listAutomations,
  updateAutomation,
  type Automation,
  type AutomationStatus,
} from "@/lib/api/automations-api";
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

type Filter = "All" | "Active" | "Paused" | "Drafts";

function AutomationsPage() {
  const { current } = useApp();
  const workspaceId = current.id;
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [deleting, setDeleting] = useState<Automation | null>(null);

  const automationsQuery = useQuery({
    queryKey: ["automations", workspaceId],
    queryFn: () => listAutomations(workspaceId),
    enabled: Boolean(workspaceId) && workspaceId !== "default",
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["automations", workspaceId] });
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

  const automations = useMemo(() => {
    let list = automationsQuery.data ?? [];
    if (filter !== "All") {
      const status = filter === "Drafts" ? "DRAFT" : filter.toUpperCase();
      list = list.filter((a) => a.status === status);
    }
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.keywords.some((k) => k.toLowerCase().includes(q))
      );
    }
    return list;
  }, [automationsQuery.data, filter, searchTerm]);

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
              placeholder="Search automations…"
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(["All", "Active", "Paused", "Drafts"] as Filter[]).map((t) => (
              <Button
                key={t}
                variant={filter === t ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(t)}
              >
                {t}
              </Button>
            ))}
          </div>
        </div>

        {automationsQuery.isError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {(automationsQuery.error as Error).message}
          </div>
        )}

        {automationsQuery.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-2xl" />
            ))}
          </div>
        ) : automations.length === 0 ? (
          <div className="rounded-2xl border bg-card p-10 text-center shadow-soft">
            <Zap className="mx-auto h-8 w-8 text-muted-foreground" />
            <h3 className="mt-3 font-display text-lg font-semibold">No automations found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {automationsQuery.data?.length
                ? "Try a different search or filter."
                : "Create your first automation to start turning comments into DMs."}
            </p>
            <Button asChild size="sm" className="mt-4 gap-1.5">
              <Link to="/automations/new">
                <Plus className="h-4 w-4" />
                New automation
              </Link>
            </Button>
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
                          onClick={() => toggleStatusMutation.mutate({ id: a.id, status: "PAUSED" })}
                        >
                          <Pause className="mr-2 h-4 w-4" /> Pause
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() => toggleStatusMutation.mutate({ id: a.id, status: "ACTIVE" })}
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
