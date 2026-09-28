import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, MoreHorizontal, Plus, Users } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/guards";
import { InstagramRequired } from "@/components/auth/instagram-required";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { chatbotApi, chatbotKeys, type ChatbotListItem } from "@/lib/api/chatbot-api";
import { isWorkspaceReady } from "@/lib/api/active-workspace";
import { getUserErrorMessage } from "@/lib/user-facing-error";
import { toast } from "@/lib/toast";
import { useApp } from "@/state/app-context";
import { useCan } from "@/hooks/use-auth";
import { useModuleFeatures } from "@/hooks/use-features";
import { cn } from "@/lib/utils";
import { IceBreakerBand, IceBreakerSheet } from "@/components/chatbot/ice-breakers";
import { ThemeSwitcher } from "@/components/chatbot/theme-switcher";
import { PlanChip, UpgradeSheetProvider, useUpgradeSheet } from "@/components/chatbot/upgrade";
import { BusinessHoursBand } from "@/components/chatbot/business-hours";
import { UsageMeter, atCap } from "@/components/chatbot/usage-meter";
import { StatusPill, publishErrorMessage } from "@/components/chatbot/shared";

export const Route = createFileRoute("/_app/chatbot/")({
  head: () => ({ meta: [{ title: "Chatbots — Liffio" }] }),
  component: () => (
    <ProtectedRoute module="chatbot">
      <InstagramRequired feature="Chatbots">
        <UpgradeSheetProvider>
          <ChatbotListPage />
        </UpgradeSheetProvider>
      </InstagramRequired>
    </ProtectedRoute>
  ),
});

const triggerChip = (t: ChatbotListItem["triggers"][number]) =>
  t.type === "KEYWORD"
    ? `DMs "${t.value}"`
    : t.type === "DEFAULT_REPLY"
      ? "Default reply"
      : t.type === "STORY_MENTION"
        ? "Story mention"
        : t.type === "STORY_REPLY"
          ? "Story reply"
          : "Comment automation";

function ChatbotListPage() {
  const { current } = useApp();
  const ws = current.id;
  const ready = isWorkspaceReady(ws);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canCreate = useCan("chatbot", "create");
  const canUpdate = useCan("chatbot", "update");
  const canDelete = useCan("chatbot", "delete");
  const features = useModuleFeatures("chatbot");
  const [picking, setPicking] = useState(false);
  const [iceOpen, setIceOpen] = useState(false);
  const [deleting, setDeleting] = useState<ChatbotListItem | null>(null);

  const list = useQuery({
    queryKey: chatbotKeys.list(ws),
    queryFn: () => chatbotApi.list(ws),
    enabled: ready,
  });
  const ice = useQuery({
    queryKey: chatbotKeys.ice(ws),
    queryFn: () => chatbotApi.iceBreakers(ws),
    enabled: ready,
  });
  const chatbots = list.data?.chatbots ?? [];
  const slots = ice.data?.slots ?? [];
  const refresh = () => void queryClient.invalidateQueries({ queryKey: chatbotKeys.list(ws) });

  // The template library is the server's; a gated one is installed only with `chatbot:templates`.
  const templates = useQuery({
    queryKey: chatbotKeys.templates(ws),
    queryFn: () => chatbotApi.templates(ws),
    enabled: ready,
    staleTime: 10 * 60 * 1000,
  });
  const openUpgrade = useUpgradeSheet();

  const create = useMutation({
    mutationFn: (key: string) => {
      const t = (templates.data ?? []).find((x) => x.key === key)!;
      const taken = new Set(chatbots.map((c) => c.name.toLowerCase()));
      const base = t.key === "blank" ? "Untitled chatbot" : t.name;
      let name = base;
      for (let i = 2; taken.has(name.toLowerCase()); i++) name = `${base} ${i}`;
      return chatbotApi.create(ws, { name, templateKey: t.key });
    },
    onSuccess: (bot) => {
      refresh();
      setPicking(false);
      void navigate({ to: "/chatbot/$chatbotId", params: { chatbotId: bot.id } });
    },
    onError: (e) => toast.error(getUserErrorMessage(e, "Couldn't create the chatbot.")),
  });

  const toggle = useMutation({
    mutationFn: async (b: ChatbotListItem) => {
      if (b.status === "LIVE") return chatbotApi.pause(ws, b.id);
      if (b.status === "PAUSED" && b.version > 0) return chatbotApi.resume(ws, b.id);
      return chatbotApi.publish(ws, b.id);
    },
    onSuccess: (bot) => {
      refresh();
      toast.success(bot.status === "LIVE" ? `${bot.name} is live` : `${bot.name} paused`);
    },
    onError: (e) => toast.error(publishErrorMessage(e)),
  });

  const duplicate = useMutation({
    mutationFn: (b: ChatbotListItem) => chatbotApi.duplicate(ws, b.id),
    onSuccess: () => {
      refresh();
      toast.success("Copied. Add new keywords to use it.");
    },
    onError: (e) => toast.error(getUserErrorMessage(e, "Couldn't copy the chatbot.")),
  });

  const remove = useMutation({
    mutationFn: (b: ChatbotListItem) => chatbotApi.remove(ws, b.id),
    onSuccess: (_r, b) => {
      refresh();
      void queryClient.invalidateQueries({ queryKey: chatbotKeys.ice(ws) });
      toast.success(`${b.name} deleted`);
      setDeleting(null);
    },
    onError: (e) => toast.error(getUserErrorMessage(e, "Couldn't delete the chatbot.")),
  });

  const live = chatbots.filter((c) => c.status === "LIVE").length;
  const limit = list.data?.limit;
  const liveCapReached = atCap(live, limit);
  // Blocked before the request: going live past the cap opens the limit sheet instead.
  const toggleLive = (b: ChatbotListItem) => {
    if (b.status !== "LIVE" && liveCapReached) {
      openUpgrade({
        limit: true,
        title: "You're using all your live chatbots",
        body: `Your plan includes ${limit} live chatbot${limit === 1 ? "" : "s"}. Pause one, or move up for more. Everything you've built stays exactly as it is.`,
      });
      return;
    }
    toggle.mutate(b);
  };

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex min-h-16 items-center gap-2.5 border-b border-border px-6 py-3 max-md:px-4">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight">Chatbots</h1>
          <p className="text-[13px] text-muted-foreground max-md:hidden">
            Each chatbot handles one job. Its keywords decide when it starts.
          </p>
        </div>
        {list.data && (
          <UsageMeter
            className="ml-4 max-md:hidden"
            label="Conversations this month"
            used={list.data.usage.conversationsThisMonth}
            limit={list.data.limits.conversationsPerMonth}
            note="One person starting a flow, counted once a day."
          />
        )}
        <div className="flex-1" />
        <ThemeSwitcher className="max-md:hidden" />
        <Button variant="outline" size="sm" asChild>
          <Link to="/chatbot/contacts">
            <Users /> <span className="max-sm:hidden">Contacts</span>
          </Link>
        </Button>
        {canCreate && (
          <Button onClick={() => setPicking(true)}>
            <Plus /> <span className="max-sm:hidden">New chatbot</span>
            <span className="sm:hidden">New</span>
          </Button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-6 pt-7 pb-10 max-md:px-4 max-md:pb-24">
        <div className="mx-auto flex max-w-[1000px] flex-col gap-6.5">
          <section>
            <div className="mb-3 flex items-baseline gap-2">
              <h2 className="font-display text-base font-semibold">Your chatbots</h2>
              {limit !== undefined && (
                <UsageMeter compact label="Live" used={live} limit={limit} className="ml-auto" />
              )}
            </div>
            {liveCapReached && (
              <p className="mb-3 text-xs text-warning">
                All your live chatbots are in use. Drafts don't count, only live chatbots: pause one
                to publish another.
              </p>
            )}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-3.5 max-md:grid-cols-1 max-md:gap-2.5">
              {list.isLoading &&
                [0, 1, 2].map((i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
              {chatbots.map((b) => {
                const iceFor = slots.filter((s) => s.chatbotId === b.id && s.text.trim());
                const chips = [
                  ...b.triggers
                    .filter((t) => t.isEnabled)
                    .map((t) => ({ k: t.id, text: triggerChip(t), ice: false })),
                  ...iceFor.map((s) => ({ k: `ice-${s.slot}`, text: `❓ ${s.text}`, ice: true })),
                ];
                return (
                  <article
                    key={b.id}
                    tabIndex={0}
                    aria-label={`Edit ${b.name}`}
                    onClick={(e) => {
                      if (!(e.target as HTMLElement).closest("button,[role=menu],[role=switch]"))
                        void navigate({ to: "/chatbot/$chatbotId", params: { chatbotId: b.id } });
                    }}
                    onKeyDown={(e) => {
                      if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        void navigate({ to: "/chatbot/$chatbotId", params: { chatbotId: b.id } });
                      }
                    }}
                    className="flex min-w-0 cursor-pointer flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-[border-color,box-shadow] hover:border-primary hover:shadow-card"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px] bg-secondary text-lg">
                        {b.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-display text-[15px] font-semibold">
                          {b.name}
                        </div>
                        <div className="text-xs text-muted-foreground">{b.stepCount} steps</div>
                      </div>
                      {canUpdate && features.go_live && (
                        <Switch
                          checked={b.status === "LIVE"}
                          disabled={toggle.isPending}
                          aria-label={`${b.name} live`}
                          onCheckedChange={() => toggleLive(b)}
                          title={b.status === "LIVE" ? "Pause" : "Go live"}
                        />
                      )}
                    </div>
                    <div className="flex flex-wrap items-start gap-1.5">
                      {chips.length ? (
                        chips.slice(0, 3).map((c) => (
                          <span
                            key={c.k}
                            className={cn(
                              "inline-flex min-w-0 max-w-full rounded-full px-2.5 py-1 text-xs font-medium",
                              c.ice ? "bg-cond text-cond-foreground" : "bg-secondary",
                            )}
                          >
                            <span className="truncate">{c.text}</span>
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full bg-warning-wash px-2.5 py-1 text-xs">
                          No keyword yet, add one to go live
                        </span>
                      )}
                      {chips.length > 3 && (
                        <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                          +{chips.length - 3} more
                        </span>
                      )}
                    </div>
                    <div className="mt-auto flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                      <StatusPill status={b.status} />
                      <span>
                        {b.status === "LIVE" ? `${b.chats30d} chats in 30 days` : "Not live"}
                      </span>
                      <span className="flex-1" />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="rounded-lg p-1.5 hover:bg-muted"
                            aria-label="Chatbot options"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() =>
                              void navigate({
                                to: "/chatbot/$chatbotId",
                                params: { chatbotId: b.id },
                              })
                            }
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() =>
                              void navigate({
                                to: "/chatbot/$chatbotId/analytics",
                                params: { chatbotId: b.id },
                              })
                            }
                          >
                            <BarChart3 className="h-3.5 w-3.5" /> Analytics
                          </DropdownMenuItem>
                          {canCreate && (
                            <DropdownMenuItem onSelect={() => duplicate.mutate(b)}>
                              Duplicate
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-primary"
                                onSelect={() => setDeleting(b)}
                              >
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </article>
                );
              })}
              {canCreate && (
                <button
                  type="button"
                  onClick={() => setPicking(true)}
                  className="flex min-h-40 flex-col items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-dashed border-border font-medium text-muted-foreground hover:border-primary hover:text-primary max-md:min-h-[72px] max-md:flex-row"
                >
                  <b className="text-[26px] leading-none font-normal max-md:text-xl">+</b>New
                  chatbot
                </button>
              )}
            </div>
          </section>

          <BusinessHoursBand
            workspaceId={ws}
            enabled={features.business_hours}
            canEdit={canUpdate}
          />

          {features.ice_breakers && (
            <IceBreakerBand
              slots={slots}
              chatbots={chatbots}
              onEdit={() => setIceOpen(true)}
              canEdit={canUpdate}
            />
          )}
        </div>
      </div>

      <Dialog open={picking} onOpenChange={setPicking}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New chatbot</DialogTitle>
            <DialogDescription>
              Start from a template and edit it, or start blank.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2.5">
            {(templates.data ?? []).map((t) => {
              const locked = t.gated && !features.templates;
              return (
                <button
                  key={t.key}
                  type="button"
                  disabled={create.isPending}
                  onClick={() =>
                    locked
                      ? openUpgrade({
                          capability: "chatbot:templates",
                          feature: `The ${t.name} template`,
                        })
                      : create.mutate(t.key)
                  }
                  className="relative flex flex-col gap-0.5 rounded-[14px] border border-border bg-background p-3.5 text-left hover:border-primary disabled:opacity-50"
                >
                  {locked && (
                    <PlanChip
                      capability="chatbot:templates"
                      className="absolute top-2.5 right-2.5"
                    />
                  )}
                  <i className={cn("mb-1 text-xl not-italic", locked && "opacity-60")}>{t.icon}</i>
                  <b className="font-display text-sm">{t.name}</b>
                  <span className="text-xs text-muted-foreground">
                    {t.stepCount} step{t.stepCount > 1 ? "s" : ""} · {t.description}
                  </span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <IceBreakerSheet
        workspaceId={ws}
        open={iceOpen}
        onOpenChange={setIceOpen}
        slots={slots}
        chatbots={chatbots}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Its keywords and ice breakers are freed, and anyone mid-conversation with it stops
              getting replies.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && remove.mutate(deleting)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
