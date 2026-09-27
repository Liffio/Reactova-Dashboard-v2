import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  chatbotApi,
  chatbotKeys,
  type Chatbot,
  type ChatbotStep,
  type GraphInput,
} from "@/lib/api/chatbot-api";
import { isWorkspaceReady } from "@/lib/api/active-workspace";
import { getUserErrorMessage } from "@/lib/user-facing-error";
import { toast } from "@/lib/toast";
import { toGraph } from "./model";

export type SaveState = "idle" | "saving" | "saved" | "error";

const SAVE_DEBOUNCE_MS = 800;

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
              }
            : b,
        );
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
  }, [workspaceId, chatbotId, queryClient]);

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
    flush,
  };
}
