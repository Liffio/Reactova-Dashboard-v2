import { useEffect, useRef, useState } from "react";
import {
  ArrowRightToLine,
  Loader2,
  Paperclip,
  Send,
  Sparkles,
  Square,
  SquarePen,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { LyraThinking } from "@/components/lyra-thinking";
import { useLyra } from "@/hooks/use-lyra";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { lyraStorageKey } from "@/lib/lyra-persist";
import { useApp } from "@/state/app-context";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  uploadSchedulerMedia,
  listPlatformAccounts,
  type PlatformAccountDto,
} from "@/lib/api/scheduler-api";
import type {
  LyraCreatorCopilotOutput,
  LyraError,
  LyraPostDraftFields,
  LyraAutomationDraftFields,
} from "@/lib/api/lyra-api";
import {
  quickAsk,
  listConversations,
  createConversation,
  listConversationMessages,
  appendConversationMessages,
  deleteConversation,
  type AssistantStoredMessage,
} from "@/lib/api/assistant-api";
import { urlToDataUrl } from "@/lib/image-data-url";
import { useNavigate } from "@tanstack/react-router";
import { savePostHandoff, saveAutomationHandoff } from "@/lib/lyra-handoff";
import { PostPreviewCard, type AttachedMedia } from "@/components/creator-assistant/creator-assistant-post-preview";
import { AutomationPreviewCard } from "@/components/creator-assistant/creator-assistant-automation-preview";

export type CopilotMessage = {
  role: "user" | "assistant";
  content: string;
  /** Thumbnail of media attached with this message, rendered above the bubble. */
  imageUrl?: string;
};

const SUGGESTIONS: Array<{ label: string; starter: string }> = [
  { label: "Schedule a post", starter: "Schedule a post " },
  { label: "Create automation", starter: "When someone comments " },
  { label: "My analytics", starter: "How are my posts performing?" },
  { label: "My leads", starter: "How many leads did I get this week?" },
];

export function nowLocalString(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** End users never see raw error payloads — every failure becomes a normal,
 *  friendly assistant bubble in the conversation. */
function friendlyLyraError(error: LyraError | null): string {
  switch (error?.code) {
    case "AI_TOKEN_LIMIT_REACHED":
      return "You've used all your Lyra AI tokens for this billing period — upgrading your plan unlocks more. I can still answer quick workspace questions for free though, like \"how many leads this week?\" or \"what's my engagement?\"";
    case "RATE_LIMITED":
      return "I'm handling a lot of requests right now — give it a few seconds and send that again.";
    default:
      return "Sorry — something went wrong on my end while thinking about that. Mind sending it again?";
  }
}

/** "Ask AI" pill trigger in the TopBar + right-side drawer for Lyra AI.
 *  Mounted inside the TopBar's button row in _app.tsx. */
export function CreatorAssistant() {
  const { user, current } = useApp();
  const workspaceId = current.id;
  const userId = user?.id;
  const firstName = user?.name?.split(" ")[0] || "there";
  const base = lyraStorageKey(userId, workspaceId, "creator-assistant");

  const [open, setOpen] = usePersistedState(`${base}:open`, false);
  const [tab, setTab] = useState<"chat" | "history">("chat");
  const [messages, setMessages] = usePersistedState<CopilotMessage[]>(`${base}:messages`, []);
  /** Server-side conversation this session appends to — created lazily on the
   *  first message. localStorage keeps the live mirror; the DB is the durable
   *  record behind the History tab. */
  const [conversationId, setConversationId] = usePersistedState<string | null>(
    `${base}:conversation-id`,
    null,
  );
  const [draftText, setDraftText] = useState("");
  const [postDraft, setPostDraft] = usePersistedState<Partial<LyraPostDraftFields>>(`${base}:post-draft`, {});
  const [automationDraft, setAutomationDraft] = usePersistedState<Partial<LyraAutomationDraftFields>>(
    `${base}:automation-draft`,
    {},
  );
  const [lastIntent, setLastIntent] = usePersistedState<"post" | "automation" | "chat" | null>(
    `${base}:last-intent`,
    null,
  );
  /** Where the live preview card sits inside the message stream — pinned right
   *  after the assistant reply that produced the draft, so new messages push it
   *  up with the rest of the conversation instead of it floating at the bottom. */
  const [previewAnchor, setPreviewAnchor] = usePersistedState<
    { kind: "post" | "automation"; index: number } | null
  >(`${base}:preview-anchor`, null);

  const [attachedMedia, setAttachedMedia] = useState<AttachedMedia | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const queryClient = useQueryClient();

  const accountsQuery = useQuery({
    queryKey: ["scheduler-platform-accounts", workspaceId],
    queryFn: () => listPlatformAccounts(workspaceId),
    enabled: Boolean(workspaceId) && open,
  });
  const accounts: PlatformAccountDto[] = accountsQuery.data?.accounts ?? [];

  const conversationsQuery = useQuery({
    queryKey: ["assistant-conversations", workspaceId],
    queryFn: () => listConversations(workspaceId),
    enabled: Boolean(workspaceId) && open && tab === "history",
  });
  const conversations = conversationsQuery.data?.conversations ?? [];

  /** Creates the server conversation on first use and appends this turn's
   *  messages — entirely best-effort so history storage can never break chat. */
  const persistTurn = async (turn: CopilotMessage[], titleSeed: string) => {
    try {
      let id = conversationId;
      if (!id) {
        const created = await createConversation(workspaceId, titleSeed.slice(0, 120) || "New chat");
        id = created.id;
        setConversationId(id);
        void queryClient.invalidateQueries({ queryKey: ["assistant-conversations", workspaceId] });
      }
      const stored: AssistantStoredMessage[] = turn.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.imageUrl ? { imageUrl: m.imageUrl } : {}),
      }));
      await appendConversationMessages(workspaceId, id, stored);
    } catch {
      // History is a nice-to-have — never surface storage failures in the chat.
    }
  };

  useEffect(() => {
    if (!selectedAccountId && accounts.length === 1) setSelectedAccountId(accounts[0].id);
  }, [accounts, selectedAccountId]);

  const handleFileSelected = async (file: File) => {
    if (!workspaceId) return;
    setUploadingMedia(true);
    try {
      const isVideo = file.type.startsWith("video/");
      const postType = isVideo ? "REEL" : "FEED";
      const uploaded = await uploadSchedulerMedia(workspaceId, file, postType);
      setAttachedMedia({ url: uploaded.primaryMediaUrl, thumbnailUrl: uploaded.thumbnailUrl, type: postType });
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Couldn't upload that file: ${(err as Error).message}` },
      ]);
    } finally {
      setUploadingMedia(false);
    }
  };

  const lyra = useLyra<"creator_copilot">({ persistKey: `${base}:lyra` });
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, lyra.status]);

  const clearWorkbench = () => {
    setPostDraft({});
    setAutomationDraft({});
    setLastIntent(null);
    setPreviewAnchor(null);
    setAttachedMedia(null);
    setDraftText("");
    lyra.reset();
  };

  const newChat = () => {
    // The server already holds everything persisted so far — just detach.
    setMessages([]);
    setConversationId(null);
    clearWorkbench();
    setTab("chat");
  };

  const openConversation = async (id: string) => {
    try {
      const { messages: stored } = await listConversationMessages(workspaceId, id);
      setMessages(stored.map((m) => ({ role: m.role, content: m.content, imageUrl: m.imageUrl })));
      setConversationId(id);
      clearWorkbench();
      setTab("chat");
    } catch {
      // Leave the history tab open if the fetch fails.
    }
  };

  const removeConversation = async (id: string) => {
    try {
      await deleteConversation(workspaceId, id);
      if (conversationId === id) {
        setConversationId(null);
        setMessages([]);
      }
      void queryClient.invalidateQueries({ queryKey: ["assistant-conversations", workspaceId] });
    } catch {
      // Best-effort.
    }
  };

  const send = async () => {
    const text = draftText.trim();
    if (!text || lyra.isActive || !workspaceId) return;

    // A freshly-attached image belongs to this message — show it in the bubble
    // and stop showing the composer's duplicate thumbnail.
    const sendingMedia = attachedMedia && !attachedMedia.shownInChat ? attachedMedia : null;
    if (sendingMedia) setAttachedMedia({ ...sendingMedia, shownInChat: true });

    const nextMessages: CopilotMessage[] = [
      ...messages,
      { role: "user", content: text, ...(sendingMedia ? { imageUrl: sendingMedia.thumbnailUrl } : {}) },
    ];
    setMessages(nextMessages);
    setDraftText("");

    // Token-free fast path: recognizable workspace questions are answered by the
    // server straight from the database — instant, zero AI tokens. Skipped when
    // media was just attached (the message is about the image, so it needs the
    // LLM). Best-effort: any failure silently falls through to the Lyra call.
    const userMessage = nextMessages[nextMessages.length - 1];

    if (!sendingMedia) {
      try {
        const quick = await quickAsk(workspaceId, text);
        if (quick.matched && quick.reply) {
          const quickReply: CopilotMessage = { role: "assistant", content: quick.reply };
          setMessages((prev) => [...prev, quickReply]);
          void persistTurn([userMessage, quickReply], text);
          return;
        }
      } catch {
        // fall through to Lyra
      }
    }

    // Vision: convert the attachment's JPEG thumbnail to a base64 data URL so the
    // model can actually see it. Best-effort — a failed conversion just means the
    // model answers without the image.
    let images: string[] | undefined;
    if (sendingMedia) {
      const dataUrl = await urlToDataUrl(sendingMedia.thumbnailUrl);
      if (dataUrl) images = [dataUrl];
    }

    const result = await lyra.run({
      task: "creator_copilot",
      workspaceId,
      input: {
        messages: nextMessages.map(({ role, content }) => ({ role, content })),
        currentPostDraftState: postDraft,
        currentAutomationDraftState: automationDraft,
        nowLocal: nowLocalString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...(images ? { images } : {}),
      },
    });

    if (result.status === "complete" && result.content) {
      const content: LyraCreatorCopilotOutput = result.content;
      const replyIndex = nextMessages.length;
      const reply: CopilotMessage = { role: "assistant", content: content.reply };
      setMessages((prev) => [...prev, reply]);
      void persistTurn([userMessage, reply], text);
      setLastIntent(content.intent);
      if (content.intent === "post" && content.postDraft) {
        setPostDraft(content.postDraft);
        setPreviewAnchor({ kind: "post", index: replyIndex });
      }
      if (content.intent === "automation" && content.automationDraft) {
        setAutomationDraft(content.automationDraft);
        setPreviewAnchor({ kind: "automation", index: replyIndex });
      }
    } else if (result.status === "error") {
      const errorReply: CopilotMessage = { role: "assistant", content: friendlyLyraError(result.error) };
      setMessages((prev) => [...prev, errorReply]);
      void persistTurn([userMessage, errorReply], text);
      lyra.reset();
    }
  };

  const navigate = useNavigate();

  /** "Looks good — review & create" on the post card: persist the full draft as
   *  a handoff, close the drawer, and send the user to the scheduler where the
   *  theater prefills the compose dialog. Nothing is created until they press
   *  Schedule there. */
  const handoffPost = async () => {
    if (!workspaceId) return;
    try {
      await savePostHandoff(workspaceId, {
        intent: "post",
        draft: {
          caption: postDraft.caption ?? "",
          hashtags: postDraft.hashtags ?? [],
          scheduledLocal: postDraft.scheduledLocal ?? "",
          musicTitle: postDraft.musicTitle ?? "",
          musicArtist: postDraft.musicArtist ?? "",
          shareToFeed: postDraft.shareToFeed ?? true,
          automation: postDraft.automation ?? {
            enabled: false,
            name: "",
            keywords: [],
            anyComment: false,
            dmMessage: "",
            autoReply: false,
            replyMessages: [],
            dmButtonLabel: "",
            dmButtonUrl: "",
          },
        },
        media: attachedMedia
          ? { url: attachedMedia.url, thumbnailUrl: attachedMedia.thumbnailUrl, type: attachedMedia.type }
          : null,
        accountId: selectedAccountId,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Hmm, I couldn't prepare the handoff just now — mind pressing that button again?" },
      ]);
      return;
    }
    const bubble: CopilotMessage = {
      role: "assistant",
      content: "Taking you to the scheduler — I'm filling everything in there. Review it and hit Schedule when you're happy ✨",
    };
    setMessages((prev) => [...prev, bubble]);
    void persistTurn([bubble], "Scheduled post handoff");
    setPostDraft({});
    setAttachedMedia(null);
    setLastIntent(null);
    setPreviewAnchor(null);
    setOpen(false);
    void navigate({ to: "/scheduler", search: { lyraDraft: true } });
  };

  /** Same flow for automations — lands in the builder wizard, prefilled. */
  const handoffAutomation = async () => {
    if (!workspaceId) return;
    try {
      await saveAutomationHandoff(workspaceId, {
        intent: "automation",
        draft: {
          name: automationDraft.name ?? "New automation",
          postScope: automationDraft.postScope ?? "any",
          anyComment: automationDraft.anyComment ?? false,
          triggerBlocks: automationDraft.triggerBlocks ?? [],
          followBeforeDm: automationDraft.followBeforeDm ?? false,
          followUps: automationDraft.followUps ?? [],
        },
      });
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Hmm, I couldn't prepare the handoff just now — mind pressing that button again?" },
      ]);
      return;
    }
    const bubble: CopilotMessage = {
      role: "assistant",
      content: "Opening the automation builder — everything's filled in for you. Review it and hit Publish when it looks right ✨",
    };
    setMessages((prev) => [...prev, bubble]);
    void persistTurn([bubble], "Automation handoff");
    setAutomationDraft({});
    setLastIntent(null);
    setPreviewAnchor(null);
    setOpen(false);
    void navigate({ to: "/automations/new", search: { lyraDraft: true } });
  };

  const emptyConversation = messages.length === 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open Lyra AI"
        className="flex h-9 rounded-full bg-brand-gradient p-px transition-opacity hover:opacity-90"
      >
        <span className="flex flex-1 items-center gap-1.5 rounded-full bg-card pl-2.5 pr-3">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">Ask AI</span>
        </span>
      </button>

      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md [&>button]:hidden">
        <SheetTitle className="sr-only">Lyra AI</SheetTitle>

        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <div className="flex items-center gap-1 rounded-full border bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setTab("chat")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                tab === "chat" ? "bg-card shadow-soft" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() => setTab("history")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                tab === "history" ? "bg-card shadow-soft" : "text-muted-foreground hover:text-foreground",
              )}
            >
              History
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={newChat}
              aria-label="New chat"
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <SquarePen className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close Lyra AI"
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <ArrowRightToLine className="h-4 w-4" />
            </button>
          </div>
        </div>

        {tab === "history" ? (
          <div className="flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
            {conversationsQuery.isLoading ? (
              <p className="px-1 py-6 text-center text-sm text-muted-foreground">Loading your chats…</p>
            ) : conversations.length === 0 ? (
              <p className="px-1 py-6 text-center text-sm text-muted-foreground">No past chats yet.</p>
            ) : (
              conversations.map((c) => (
                <div
                  key={c.id}
                  className="group flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5 transition-colors hover:bg-accent/50"
                >
                  <button
                    type="button"
                    onClick={() => void openConversation(c.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-sm">{c.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(c.updatedAt)}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeConversation(c.id)}
                    aria-label="Delete chat"
                    className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        ) : emptyConversation ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </span>
            <h3 className="font-display text-lg font-semibold">Hello {firstName} 👋</h3>
            <p className="text-sm text-muted-foreground">How can I help you today?</p>
          </div>
        ) : (
          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((m, i) => (
              <div key={i} className="space-y-3">
                <div
                  className={cn(
                    "flex max-w-[85%] flex-col gap-1.5 animate-in fade-in-0 slide-in-from-bottom-1 duration-200",
                    m.role === "user" ? "ml-auto items-end" : "items-start",
                  )}
                >
                  {m.imageUrl && (
                    <img
                      src={m.imageUrl}
                      alt="Attached media"
                      className="max-h-40 max-w-full rounded-xl border object-cover shadow-soft"
                    />
                  )}
                  <div
                    className={cn(
                      "whitespace-pre-wrap break-words px-3.5 py-2 text-sm leading-relaxed",
                      m.role === "user"
                        ? "rounded-2xl rounded-br-md bg-primary text-primary-foreground shadow-soft"
                        : "rounded-2xl rounded-bl-md border border-border/60 bg-muted/40 text-foreground",
                    )}
                  >
                    {m.content}
                  </div>
                </div>
                {previewAnchor?.index === i && previewAnchor.kind === "post" && postDraft.caption && (
                  <PostPreviewCard
                    draft={{
                      caption: postDraft.caption ?? "",
                      hashtags: postDraft.hashtags ?? [],
                      scheduledLocal: postDraft.scheduledLocal ?? "",
                      musicTitle: postDraft.musicTitle ?? "",
                      musicArtist: postDraft.musicArtist ?? "",
                      shareToFeed: postDraft.shareToFeed ?? true,
                      automation: postDraft.automation ?? {
                        enabled: false,
                        name: "",
                        keywords: [],
                        anyComment: false,
                        dmMessage: "",
                        autoReply: false,
                        replyMessages: [],
                        dmButtonLabel: "",
                        dmButtonUrl: "",
                      },
                    }}
                    media={attachedMedia}
                    onConfirm={handoffPost}
                  />
                )}
                {previewAnchor?.index === i &&
                previewAnchor.kind === "automation" &&
                automationDraft.triggerBlocks?.length ? (
                  <AutomationPreviewCard
                    draft={{
                      name: automationDraft.name ?? "New automation",
                      postScope: automationDraft.postScope ?? "any",
                      anyComment: automationDraft.anyComment ?? false,
                      triggerBlocks: automationDraft.triggerBlocks ?? [],
                      followBeforeDm: automationDraft.followBeforeDm ?? false,
                      followUps: automationDraft.followUps ?? [],
                    }}
                    onConfirm={handoffAutomation}
                  />
                ) : null}
              </div>
            ))}
            {lyra.isActive && (
              <LyraThinking
                status="thinking"
                startedAt={lyra.startedAt}
                onCancel={lyra.cancel}
                size="sm"
                statusMessages={[
                  "Analysing your request…",
                  "Looking at your media…",
                  "Checking your workspace…",
                  "Drafting your content…",
                ]}
              />
            )}
          </div>
        )}

        {tab === "chat" && (
          <div className="border-t px-3 py-3">
            {lastIntent === "post" && !selectedAccountId && accounts.length > 1 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                <span className="w-full text-xs text-muted-foreground">Which account?</span>
                {accounts.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setSelectedAccountId(acc.id)}
                    className="rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                  >
                    @{acc.platformUsername}
                  </button>
                ))}
              </div>
            )}
            {emptyConversation && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => {
                      setDraftText(s.starter);
                      textareaRef.current?.focus();
                    }}
                    className="rounded-full border bg-card px-3 py-1.5 text-xs shadow-soft transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
            <div className="rounded-2xl border bg-card p-2 shadow-soft transition-shadow focus-within:shadow-card">
              {attachedMedia && !attachedMedia.shownInChat && (
                <div className="relative mb-1.5 inline-block p-1">
                  <img
                    src={attachedMedia.thumbnailUrl}
                    alt="Attached media"
                    className="h-16 w-16 rounded-xl border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setAttachedMedia(null)}
                    aria-label="Remove attachment"
                    className="absolute -right-0.5 -top-0.5 grid h-5 w-5 place-items-center rounded-full border bg-background text-muted-foreground shadow-soft transition-colors hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileSelected(file);
                  e.target.value = "";
                }}
              />
              <Textarea
                ref={textareaRef}
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder="Ask Lyra anything…"
                className="min-h-9 w-full resize-none border-0 p-1.5 text-sm shadow-none focus-visible:ring-0"
                rows={2}
              />
              <div className="flex items-center justify-end gap-1.5">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 rounded-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingMedia}
                  aria-label="Attach media"
                >
                  {uploadingMedia ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Paperclip className="h-3.5 w-3.5" />
                  )}
                </Button>
                {lyra.isActive ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="relative h-8 w-8 shrink-0 rounded-full"
                    onClick={() => lyra.cancel()}
                    aria-label="Stop generating"
                  >
                    <span
                      aria-hidden
                      className="absolute -inset-px animate-spin rounded-full border-2 border-primary/20 border-t-primary"
                    />
                    <Square className="h-2.5 w-2.5 fill-current" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-full"
                    onClick={() => void send()}
                    disabled={!draftText.trim()}
                    aria-label="Send"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
            <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
              Lyra can make mistakes. Double-check important replies.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
