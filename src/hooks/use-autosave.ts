/**
 * DB-level autosave for create/edit forms. Debounces form snapshots into the
 * drafts API, exposes the restored draft (if any), and clears the draft on
 * successful submit.
 *
 * Usage:
 *   const autosave = useAutosave<MyForm>({ workspaceId, module: "automation", draftKey: "new" });
 *   useEffect(() => autosave.schedule(formValues), [formValues]);
 *   // on submit success: await autosave.clear();
 *   // restore: autosave.draft?.payload
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { deleteDraft, getDraft, saveDraft, type DraftDto } from "@/lib/api/drafts-api";
import { registerAutosaveFlush } from "@/lib/autosave-registry";

export type AutosaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export type UseAutosaveOptions = {
  workspaceId: string;
  module: string;
  draftKey: string;
  /** Debounce in ms before persisting (default 1000). */
  debounceMs?: number;
  /** Disable autosave entirely (e.g. while the form is empty). */
  enabled?: boolean;
};

export function useAutosave<TPayload extends Record<string, unknown>>(
  options: UseAutosaveOptions
) {
  const { workspaceId, module, draftKey, debounceMs = 1000, enabled = true } = options;

  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [draft, setDraft] = useState<DraftDto<TPayload> | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const timerRef = useRef<number | null>(null);
  const latestRef = useRef<TPayload | null>(null);
  const clearedRef = useRef(false);

  // Load any existing draft once the workspace is known.
  useEffect(() => {
    if (!workspaceId || workspaceId === "default" || !enabled) {
      return;
    }
    let cancelled = false;
    setDraftLoaded(false);
    void getDraft<TPayload>(workspaceId, module, draftKey).then((existing) => {
      if (!cancelled) {
        setDraft(existing);
        setDraftLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, module, draftKey, enabled]);

  const flush = useCallback(async () => {
    const payload = latestRef.current;
    if (!payload || !workspaceId || workspaceId === "default" || clearedRef.current) {
      return;
    }
    setStatus("saving");
    try {
      const result = await saveDraft(workspaceId, module, draftKey, payload);
      setDraft(result.draft as DraftDto<TPayload>);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }, [workspaceId, module, draftKey]);

  /** Debounced save — call with the latest form snapshot on every change. */
  const schedule = useCallback(
    (payload: TPayload) => {
      if (!enabled || !workspaceId || workspaceId === "default") {
        return;
      }
      clearedRef.current = false;
      latestRef.current = payload;
      setStatus("pending");
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void flush();
      }, debounceMs);
    },
    [enabled, workspaceId, debounceMs, flush]
  );

  /** Remove the draft (after a successful submit or explicit discard). */
  const clear = useCallback(async () => {
    clearedRef.current = true;
    latestRef.current = null;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setDraft(null);
    setStatus("idle");
    if (workspaceId && workspaceId !== "default") {
      try {
        await deleteDraft(workspaceId, module, draftKey);
      } catch {
        // best-effort — draft cleanup must never block the submit flow
      }
    }
  }, [workspaceId, module, draftKey]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    },
    []
  );

  // Let the session watcher force-flush this form's latest snapshot before a
  // forced logout (session expiry), independent of the debounce timer.
  useEffect(() => registerAutosaveFlush(flush), [flush]);

  return { status, draft, draftLoaded, schedule, flush, clear };
}
