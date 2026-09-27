import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  ChevronLeft,
  MoreHorizontal,
  Plus,
  Smartphone,
  TriangleAlert,
} from "lucide-react";
import { ProtectedRoute } from "@/components/auth/guards";
import { InstagramRequired } from "@/components/auth/instagram-required";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  chatbotApi,
  chatbotKeys,
  type ChatbotStep,
  type PublishProblem,
  type StepType,
} from "@/lib/api/chatbot-api";
import { isWorkspaceReady } from "@/lib/api/active-workspace";
import { getUserErrorMessage } from "@/lib/user-facing-error";
import { toast } from "@/lib/toast";
import { useApp } from "@/state/app-context";
import { useCan } from "@/hooks/use-auth";
import { useModuleFeatures } from "@/hooks/use-features";
import { cn } from "@/lib/utils";
import { useChatbotEditor } from "@/components/chatbot/use-chatbot-editor";
import { StepCard, type StepAction } from "@/components/chatbot/step-card";
import { ReorderList } from "@/components/chatbot/reorder-list";
import { TriggerCard } from "@/components/chatbot/trigger-card";
import { PreviewPanel } from "@/components/chatbot/preview-panel";
import { IceBreakerSheet } from "@/components/chatbot/ice-breakers";
import { ThemeSwitcher } from "@/components/chatbot/theme-switcher";
import { StatusPill, publishErrorMessage, publishProblems } from "@/components/chatbot/shared";
import { duplicateStep, newStep, removeStep } from "@/components/chatbot/model";

export const Route = createFileRoute("/_app/chatbot/$chatbotId")({
  head: () => ({ meta: [{ title: "Chatbot builder — Liffio" }] }),
  component: () => (
    <ProtectedRoute module="chatbot">
      <InstagramRequired feature="Chatbots">
        <BuilderPage />
      </InstagramRequired>
    </ProtectedRoute>
  ),
});

const ADD_OPTIONS: Array<{ type: StepType; label: string; hint: string; feature?: string }> = [
  { type: "MESSAGE", label: "Message", hint: "Send text with reply buttons" },
  {
    type: "QUESTION",
    label: "Question",
    hint: "Ask for an email, phone, number or text and save it",
  },
  { type: "CONDITION", label: "Condition", hint: "Branch by tags or saved answers" },
  { type: "HANDOVER", label: "Hand to a person", hint: "Pause the bot and notify your team" },
  {
    type: "START_CHATBOT",
    label: "Start another chatbot",
    hint: "Continue in a different chatbot",
  },
];

const useSingleOpen = () => {
  const [single, setSingle] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const on = () => setSingle(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return single;
};

function BuilderPage() {
  const { chatbotId } = Route.useParams();
  const { current } = useApp();
  const ws = current.id;
  const ready = isWorkspaceReady(ws);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canUpdate = useCan("chatbot", "update");
  const features = useModuleFeatures("chatbot");
  const editor = useChatbotEditor(ws, chatbotId);
  const { bot } = editor;

  const others = useQuery({
    queryKey: chatbotKeys.list(ws),
    queryFn: () => chatbotApi.list(ws),
    enabled: ready,
  });
  const ice = useQuery({
    queryKey: chatbotKeys.ice(ws),
    queryFn: () => chatbotApi.iceBreakers(ws),
    enabled: ready,
  });
  const chatbots = useMemo(
    () =>
      (others.data?.chatbots ?? [])
        .filter((c) => c.id !== chatbotId)
        .map((c) => ({ id: c.id, name: c.name })),
    [others.data, chatbotId],
  );

  const singleOpen = useSingleOpen();
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [reorder, setReorder] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [iceOpen, setIceOpen] = useState(false);
  const [problems, setProblems] = useState<PublishProblem[]>([]);
  const [busy, setBusy] = useState(false);

  // First step open on arrival, like the prototype.
  useEffect(() => {
    if (bot && openIds.size === 0 && bot.steps[0]) setOpenIds(new Set([bot.steps[0].id]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bot?.id]);

  const toggleOpen = useCallback(
    (id: string, force?: boolean) => {
      setOpenIds((prev) => {
        const next = new Set(singleOpen ? [] : prev);
        const open = force ?? !prev.has(id);
        if (open) next.add(id);
        else next.delete(id);
        return next;
      });
    },
    [singleOpen],
  );

  const flash = useCallback(
    (id: string, andOpen = false) => {
      if (andOpen) toggleOpen(id, true);
      setFlashId(id);
      setTimeout(() => setFlashId((f) => (f === id ? null : f)), 1300);
      requestAnimationFrame(() =>
        document
          .querySelector(`[data-step-id="${id}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      );
    },
    [toggleOpen],
  );

  if (editor.isLoading || !bot) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6">
        {editor.error ? (
          <p className="text-sm text-muted-foreground">
            {getUserErrorMessage(editor.error, "Couldn't load this chatbot.")}
          </p>
        ) : (
          <>
            <Skeleton className="h-12 w-72" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </>
        )}
      </div>
    );
  }

  const stepRefs = bot.steps.map((s, index) => ({ id: s.id, name: s.name, index }));
  const setSteps = editor.updateSteps;
  const addStep = (type: StepType) => {
    const s = newStep(type, bot.steps.length);
    setSteps((xs) => [...xs, s]);
    toggleOpen(s.id, true);
    setTimeout(() => flash(s.id), 50);
    return s.id;
  };
  const onAction = (s: ChatbotStep, i: number, a: StepAction) => {
    setSteps((xs) => {
      const next = [...xs];
      if (a === "up") [next[i - 1], next[i]] = [next[i], next[i - 1]];
      if (a === "down") [next[i + 1], next[i]] = [next[i], next[i + 1]];
      if (a === "first") {
        next.splice(i, 1);
        next.unshift(s);
      }
      if (a === "dup") next.splice(i + 1, 0, duplicateStep(s));
      if (a === "del") return removeStep(xs, s.id);
      return next;
    });
    if (a === "del") toast(`Deleted "${s.name}"`);
    else setTimeout(() => flash(s.id), 30);
  };

  const live = bot.status === "LIVE";
  const primaryLabel = live
    ? bot.hasUnpublishedChanges
      ? "Publish changes"
      : "Pause"
    : bot.status === "PAUSED" && bot.version > 0 && !bot.hasUnpublishedChanges
      ? "Resume"
      : "Go live";

  const goLive = async () => {
    setBusy(true);
    setProblems([]);
    try {
      await editor.flush();
      const next =
        primaryLabel === "Pause"
          ? await chatbotApi.pause(ws, bot.id)
          : primaryLabel === "Resume"
            ? await chatbotApi.resume(ws, bot.id)
            : await chatbotApi.publish(ws, bot.id);
      editor.absorb(next);
      void queryClient.invalidateQueries({ queryKey: chatbotKeys.list(ws) });
      toast.success(
        next.status === "LIVE"
          ? primaryLabel === "Publish changes"
            ? "Changes are live"
            : `${next.name} is live`
          : `${next.name} paused`,
      );
    } catch (e) {
      const p = publishProblems(e);
      setProblems(p);
      toast.error(publishErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const saveText = { idle: "", saving: "Saving…", saved: "Saved", error: "Not saved" }[
    editor.saveState
  ];
  const blocking = problems.filter((p) => p.severity === "error");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex min-h-16 items-center gap-2.5 border-b border-border bg-background px-6 py-3 max-md:gap-2 max-md:px-3">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back to all chatbots"
          onClick={() => void editor.flush().then(() => navigate({ to: "/chatbot" }))}
        >
          <ChevronLeft className="!size-5" />
        </Button>
        <div className="min-w-0 flex-[1_1_160px]">
          <div className="text-xs leading-tight text-muted-foreground max-md:hidden">Chatbots</div>
          <input
            className="-ml-1.5 w-full max-w-[360px] min-w-0 rounded-md border-0 bg-transparent px-1.5 py-0.5 font-display text-lg font-bold tracking-tight hover:bg-muted focus:bg-muted focus:outline-none"
            value={bot.name}
            aria-label="Chatbot name"
            disabled={!canUpdate}
            onChange={(e) => editor.update((b) => ({ ...b, name: e.target.value }))}
          />
        </div>
        <StatusPill status={bot.status} />
        {bot.status !== "DRAFT" && bot.hasUnpublishedChanges && (
          <span className="text-xs text-warning max-md:hidden">Unpublished changes</span>
        )}
        <span className="w-16 text-xs text-muted-foreground max-md:hidden" aria-live="polite">
          {saveText}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="More options">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link to="/chatbot/$chatbotId/analytics" params={{ chatbotId }}>
                <BarChart3 className="h-3.5 w-3.5" /> Analytics
              </Link>
            </DropdownMenuItem>
            {live && bot.hasUnpublishedChanges && canUpdate && (
              <DropdownMenuItem
                onSelect={() => void chatbotApi.pause(ws, bot.id).then(editor.absorb)}
              >
                Pause chatbot
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Theme</DropdownMenuLabel>
            <div className="px-2 pb-1.5">
              <ThemeSwitcher />
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        {canUpdate && features.go_live && (
          <Button
            className="max-md:hidden"
            variant={primaryLabel === "Pause" ? "outline" : "default"}
            disabled={busy}
            onClick={() => void goLive()}
          >
            {primaryLabel}
          </Button>
        )}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_420px] max-[1180px]:grid-cols-[minmax(0,1fr)_350px] max-[900px]:grid-cols-1">
        <section className="overflow-y-auto px-6 pt-6 pb-16 max-md:px-3 max-md:pb-28">
          <div className="mx-auto max-w-[640px]">
            {blocking.length > 0 && (
              <div className="mb-4 rounded-xl border border-destructive-edge bg-destructive-wash p-3 text-[13px]">
                <div className="mb-1 flex items-center gap-1.5 font-semibold">
                  <TriangleAlert className="h-4 w-4" /> Fix these before going live
                </div>
                <ul className="flex flex-col gap-0.5">
                  {blocking.map((p, i) => {
                    const target = p.stepId ?? p.stepIds?.[0];
                    return (
                      <li key={i}>
                        {target ? (
                          <button
                            type="button"
                            className="text-left hover:underline"
                            onClick={() => flash(target, true)}
                          >
                            {p.message}
                          </button>
                        ) : (
                          p.message
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="mb-3.5 flex items-center gap-2.5">
              <h2 className="font-display text-[15px] font-semibold">Flow</h2>
              <span className="mr-auto text-xs whitespace-nowrap text-muted-foreground">
                {bot.steps.length} step{bot.steps.length === 1 ? "" : "s"}
              </span>
              {reorder && (
                <span className="text-right text-xs leading-snug text-muted-foreground max-md:hidden">
                  Drag the handle or use the arrows. Step 1 stays first.
                </span>
              )}
              {!reorder && openIds.size > 1 && (
                <Button size="sm" variant="outline" onClick={() => setOpenIds(new Set())}>
                  Collapse all
                </Button>
              )}
              {canUpdate && (
                <Button
                  size="sm"
                  variant={reorder ? "default" : "outline"}
                  onClick={() => setReorder(!reorder)}
                >
                  {reorder ? "Done" : "Reorder"}
                </Button>
              )}
            </div>

            <div className="relative pl-11 before:absolute before:top-[22px] before:bottom-[30px] before:left-[15px] before:w-[1.5px] before:rounded-sm before:bg-border max-md:pl-[38px] max-md:before:left-[13px]">
              <TriggerCard
                workspaceId={ws}
                bot={bot}
                ice={ice.data?.slots ?? []}
                onOpenIce={() => setIceOpen(true)}
                onChanged={(triggers) => editor.absorb({ triggers })}
              />

              {reorder ? (
                <ReorderList steps={bot.steps} onChange={(steps) => setSteps(() => steps)} />
              ) : (
                bot.steps.map((s, i) => (
                  <StepCard
                    key={s.id}
                    step={s}
                    index={i}
                    total={bot.steps.length}
                    open={openIds.has(s.id)}
                    flash={flashId === s.id}
                    steps={stepRefs}
                    chatbots={chatbots}
                    canFollowUps={features.follow_ups}
                    onToggle={() => toggleOpen(s.id)}
                    onChange={(next) => setSteps((xs) => xs.map((x) => (x.id === s.id ? next : x)))}
                    onAction={(a) => onAction(s, i, a)}
                    onNewStep={() => addStep("MESSAGE")}
                    onJump={(id) => flash(id, true)}
                  />
                ))
              )}

              {!reorder && canUpdate && (
                <div className="relative mt-1">
                  <span
                    aria-hidden
                    className="absolute top-2.5 -left-11 grid h-[31px] w-[31px] place-items-center rounded-[11px] border border-dashed border-border bg-card text-muted-foreground max-md:-left-[38px] max-md:h-7 max-md:w-7"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="flex w-full items-center justify-center gap-1.5 rounded-[14px] border-[1.5px] border-dashed border-border p-3.5 font-medium text-muted-foreground hover:border-primary hover:text-primary"
                      >
                        Add step
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-[var(--radix-dropdown-menu-trigger-width)]"
                    >
                      {ADD_OPTIONS.map((o) => (
                        <DropdownMenuItem
                          key={o.type}
                          className="flex-col items-start gap-0"
                          onSelect={() => addStep(o.type)}
                        >
                          <b>{o.label}</b>
                          <small className="text-xs text-muted-foreground">{o.hint}</small>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          </div>
        </section>

        <PreviewPanel
          workspaceId={ws}
          bot={bot}
          revision={editor.revision}
          onClose={previewOpen ? () => setPreviewOpen(false) : undefined}
          className={cn(
            "max-[900px]:fixed max-[900px]:inset-0 max-[900px]:z-60 max-[900px]:border-0 max-[900px]:transition-transform max-[900px]:duration-300",
            previewOpen
              ? "max-[900px]:translate-y-0"
              : "max-[900px]:invisible max-[900px]:translate-y-full",
          )}
        />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 hidden gap-2 border-t border-border bg-background/90 px-3 pt-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] backdrop-blur-md max-[900px]:flex">
        <Button
          variant="outline"
          className="h-12 flex-1 rounded-xl text-[15px]"
          onClick={() => setPreviewOpen(true)}
        >
          <Smartphone /> Preview
        </Button>
        {canUpdate && features.go_live && (
          <Button
            className="h-12 flex-1 rounded-xl text-[15px]"
            variant={primaryLabel === "Pause" ? "outline" : "default"}
            disabled={busy}
            onClick={() => void goLive()}
          >
            {primaryLabel}
          </Button>
        )}
      </div>

      <IceBreakerSheet
        workspaceId={ws}
        open={iceOpen}
        onOpenChange={setIceOpen}
        slots={ice.data?.slots ?? []}
        chatbots={[{ id: bot.id, name: bot.name }, ...chatbots]}
      />
    </div>
  );
}
