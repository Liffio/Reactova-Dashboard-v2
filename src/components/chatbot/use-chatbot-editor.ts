import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  chatbotApi,
  chatbotKeys,
  type Chatbot,
  type ChatbotMedia,
  type ChatbotStep,
  type GraphInput,
} from "@/lib/api/chatbot-api";
import { isWorkspaceReady } from "@/lib/api/active-workspace";
import { getUserErrorMessage } from "@/lib/user-facing-error";
import { toast } from "@/lib/toast";
import { toGraph } from "./model";

export type SaveState = "idle" | "saving" | "saved" | "error";

const SAVE_DEBOUNCE_MS = 800;
/** Under the 15 minutes a signed media link lives. */
const MEDIA_REFRESH_MS = 12 * 60_000;

/**
 * The builder's draft (code spec §11.2): local-first, saved whole with a debounce.
 *
 * The server copy seeds the draft once; after that the local copy is the truth while the page is
 * open, and a save only folds back the fields the server decides (status, version, "unpublished
 * changes"). Folding back the steps would overwrite whatever the author typed during the request.
 *
 * `revision` increments after every successful save, which is what tells the preview to replay:
 * it runs against the saved draft, so it must wait for the save it depends on.
 */
export function useChatbotEditor(workspaceId: string, chatbotId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: chatbotKeys.one(workspaceId, chatbotId),
    queryFn: () => chatbotApi.get(workspaceId, chatbotId),
    enabled: isWorkspaceReady(workspaceId),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const [bot, setBot] = useState<Chatbot | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [revision, setRevision] = useState(0);
  const pending = useRef<GraphInput | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (query.data && !bot) setBot(query.data);
  }, [query.data, bot]);

  /**
   * Files taken off a step, waiting for a save that no longer refers to them before they are
   * deleted (the server refuses while a draft step uses one). Best effort: a file another step or a
   * published version still uses answers 409 and simply stays.
   */
  const removedMedia = useRef(new Set<string>());
  const dropUnreferencedMedia = useCallback(
    (saved: Chatbot) => {
      const used = new Set(saved.steps.map((s) => s.mediaAssetId).filter(Boolean));
      for (const id of [...removedMedia.current]) {
        if (used.has(id)) continue;
        removedMedia.current.delete(id);
        void chatbotApi.deleteMedia(workspaceId, chatbotId, id).catch(() => undefined);
      }
    },
    [workspaceId, chatbotId],
  );

  const flush = useCallback((): Promise<void> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const graph = pending.current;
    if (!graph) return inflight.current;
    pending.current = null;
    setSaveState("saving");
    // Saves run one after another: two overlapping PUTs could land out of order and leave the
    // older draft on the server.
    inflight.current = inflight.current
      .then(() => chatbotApi.saveGraph(workspaceId, chatbotId, graph))
      .then((saved) => {
        setBot((b) =>
          b
            ? {
                ...b,
                status: saved.status,
                version: saved.version,
                publishedAt: saved.publishedAt,
                hasUnpublishedChanges: saved.hasUnpublishedChanges,
                // Freshly signed links for every file the saved steps use (they last 15 minutes).
                media: { ...b.media, ...saved.media },
              }
            : b,
        );
        dropUnreferencedMedia(saved);
        setSaveState(pending.current ? "saving" : "saved");
        setRevision((r) => r + 1);
        void queryClient.invalidateQueries({ queryKey: chatbotKeys.list(workspaceId) });
      })
      .catch((error) => {
        setSaveState("error");
        toast.error(
          getUserErrorMessage(
            error,
            "Couldn't save your changes. Check the highlighted fields and try again.",
          ),
        );
      });
    return inflight.current;
  }, [workspaceId, chatbotId, queryClient, dropUnreferencedMedia]);

  /** A file just uploaded: known to the builder at once, before any save signs it again. */
  const addMedia = useCallback((view: ChatbotMedia) => {
    setBot((b) => (b ? { ...b, media: { ...b.media, [view.mediaAssetId]: view } } : b));
  }, []);

  /** Delete this file once a save no longer uses it. */
  const releaseMedia = useCallback((mediaAssetId: string) => {
    removedMedia.current.add(mediaAssetId);
  }, []);

  const hasMedia = !!bot?.steps.some((s) => s.mediaAssetId);
  // Links last 15 minutes. A page left open re-signs them before they run out, so previews keep
  // working; only `media` is taken from the fetch, never the steps being edited.
  useEffect(() => {
    if (!hasMedia) return;
    const t = setInterval(() => {
      void chatbotApi
        .get(workspaceId, chatbotId)
        .then((fresh) => setBot((b) => (b ? { ...b, media: { ...b.media, ...fresh.media } } : b)))
        .catch(() => undefined);
    }, MEDIA_REFRESH_MS);
    return () => clearInterval(t);
  }, [workspaceId, chatbotId, hasMedia]);

  const update = useCallback(
    (fn: (b: Chatbot) => Chatbot) => {
      setBot((prev) => {
        if (!prev) return prev;
        const next = fn(prev);
        pending.current = toGraph(next, next.steps);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
        setSaveState("saving");
        return next;
      });
    },
    [flush],
  );

  const updateSteps = useCallback(
    (fn: (steps: ChatbotStep[]) => ChatbotStep[]) => update((b) => ({ ...b, steps: fn(b.steps) })),
    [update],
  );

  /** Server-decided fields after publish/pause/resume or a trigger change, without touching steps. */
  const absorb = useCallback((server: Partial<Chatbot>) => {
    setBot((b) => (b ? { ...b, ...server, steps: b.steps, name: b.name } : b));
  }, []);

  // Never lose the last edits: flush when leaving the page, and warn if the tab closes mid-save.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!pending.current) return;
      void flush();
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      void flush();
    };
  }, [flush]);

  return {
    bot,
    isLoading: query.isLoading,
    error: query.error,
    saveState,
    revision,
    update,
    updateSteps,
    absorb,
    addMedia,
    releaseMedia,
    flush,
  };
}
