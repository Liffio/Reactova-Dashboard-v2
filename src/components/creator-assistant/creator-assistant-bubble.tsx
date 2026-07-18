import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, X, Paperclip, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LyraThinking } from "@/components/lyra-thinking";
import { useLyra } from "@/hooks/use-lyra";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { lyraStorageKey } from "@/lib/lyra-persist";
import { useApp } from "@/state/app-context";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  uploadSchedulerMedia,
  listPlatformAccounts,
  type PlatformAccountDto,
} from "@/lib/api/scheduler-api";
import type {
  LyraCreatorCopilotOutput,
  LyraPostDraftFields,
  LyraAutomationDraftFields,
} from "@/lib/api/lyra-api";
import { PostPreviewCard, type AttachedMedia } from "@/components/creator-assistant/creator-assistant-post-preview";

export type CopilotMessage = { role: "user" | "assistant"; content: string };

const GREETING: CopilotMessage = {
  role: "assistant",
  content:
    "Hi! Tell me what you'd like to do — \"schedule a reel for tomorrow at 6pm\" or \"when someone comments PRICE, DM them our pricing link\" both work.",
};

export function nowLocalString(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CreatorAssistantBubble() {
  const { user, current } = useApp();
  const workspaceId = current.id;
  const userId = user?.id;
  const base = lyraStorageKey(userId, workspaceId, "creator-assistant");

  const [open, setOpen] = usePersistedState(`${base}:open`, false);
  const [messages, setMessages] = usePersistedState<CopilotMessage[]>(`${base}:messages`, [GREETING]);
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

  const [attachedMedia, setAttachedMedia] = useState<AttachedMedia | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const accountsQuery = useQuery({
    queryKey: ["scheduler-platform-accounts", workspaceId],
    queryFn: () => listPlatformAccounts(workspaceId),
    enabled: Boolean(workspaceId) && open,
  });
  const accounts: PlatformAccountDto[] = accountsQuery.data?.accounts ?? [];

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

  const send = async () => {
    const text = draftText.trim();
    if (!text || lyra.isActive || !workspaceId) return;

    const nextMessages: CopilotMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setDraftText("");

    const result = await lyra.run({
      task: "creator_copilot",
      workspaceId,
      input: {
        messages: nextMessages,
        currentPostDraftState: postDraft,
        currentAutomationDraftState: automationDraft,
        nowLocal: nowLocalString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    });

    if (result.status === "complete" && result.content) {
      const content: LyraCreatorCopilotOutput = result.content;
      setMessages((prev) => [...prev, { role: "assistant", content: content.reply }]);
      setLastIntent(content.intent);
      if (content.intent === "post" && content.postDraft) setPostDraft(content.postDraft);
      if (content.intent === "automation" && content.automationDraft) setAutomationDraft(content.automationDraft);
    }
  };

  return (
    <>
      <div className="fixed bottom-4 left-4 z-50">
        <AnimatePresence>
          {!open && (
            <motion.button
              key="bubble"
              type="button"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              onClick={() => setOpen(true)}
              className="grid h-14 w-14 place-items-center rounded-full bg-brand-gradient shadow-glow"
              aria-label="Open Liffio assistant"
            >
              <Sparkles className="h-6 w-6 text-white" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-4 left-4 z-50 flex max-h-[min(32rem,80vh)] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border bg-card shadow-card"
          >
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-medium">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-gradient">
                  <Sparkles className="h-3 w-3 text-white" />
                </span>
                Liffio Assistant
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                aria-label="Close assistant"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed",
                    m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted/50 text-foreground",
                  )}
                >
                  {m.content}
                </div>
              ))}
              {lastIntent === "post" && postDraft.caption && (
                <PostPreviewCard
                  workspaceId={workspaceId}
                  draft={{
                    caption: postDraft.caption ?? "",
                    hashtags: postDraft.hashtags ?? [],
                    scheduledLocal: postDraft.scheduledLocal ?? "",
                    musicTitle: postDraft.musicTitle ?? "",
                    musicArtist: postDraft.musicArtist ?? "",
                    shareToFeed: postDraft.shareToFeed ?? true,
                  }}
                  media={attachedMedia}
                  accountId={selectedAccountId}
                  timezone={Intl.DateTimeFormat().resolvedOptions().timeZone}
                  onCreated={() => {
                    setPostDraft({});
                    setAttachedMedia(null);
                    setLastIntent(null);
                  }}
                />
              )}
              {lyra.isActive && (
                <LyraThinking status="thinking" startedAt={lyra.startedAt} onCancel={lyra.cancel} size="sm" />
              )}
              {lyra.status === "error" && (
                <LyraThinking status="error" error={lyra.error} onRetry={() => void send()} size="sm" />
              )}
            </div>

            <div className="border-t px-4 py-3">
              {attachedMedia && (
                <div className="mb-2 flex items-center gap-2 rounded-lg border bg-muted/30 px-2 py-1.5 text-xs">
                  <img src={attachedMedia.thumbnailUrl} alt="" className="h-8 w-8 rounded object-cover" />
                  <span className="flex-1 text-muted-foreground">Attached</span>
                  <button
                    type="button"
                    onClick={() => setAttachedMedia(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
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
              <div className="flex items-end gap-2">
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
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingMedia}
                  aria-label="Attach media"
                >
                  {uploadingMedia ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                </Button>
                <Textarea
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  placeholder="Schedule a post, build an automation, or ask a question…"
                  className="min-h-9 flex-1 resize-none text-sm"
                  rows={1}
                  disabled={lyra.isActive}
                />
                <Button
                  type="button"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => void send()}
                  disabled={lyra.isActive || !draftText.trim()}
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
