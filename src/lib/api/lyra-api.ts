/**
 * Client for the Lyra AI Gateway endpoint. Unlike every other backend call,
 * Lyra's envelope (`{success, content, execution}` / `{success:false, error}`)
 * and optional SSE streaming don't fit `apiRequest`, so it talks to `fetch`
 * directly here — but reuses the same auth/workspace header + API_BASE
 * conventions as `http.ts`.
 */
import { authStore } from "@/lib/auth/auth-store";
import { apiUri } from "./apiUri";
import { API_BASE } from "./http";

export type LyraTask =
  | "chat"
  | "caption"
  | "keyword"
  | "hashtag"
  | "suggestion"
  | "insight"
  | "analytics"
  | "vision_analysis"
  | "ocr"
  | "image_summary"
  | "custom_prompt"
  | "automation_copilot"
  | "creator_copilot";

export type LyraError = {
  code:
    | "VALIDATION_ERROR"
    | "UNKNOWN_TASK"
    | "UNAUTHENTICATED"
    | "RATE_LIMITED"
    | "EXTERNAL_API_ERROR"
    | "INTERNAL_ERROR"
    | "NETWORK_ERROR"
    | (string & {});
  message: string;
  retryAfterSeconds?: number;
};

export type LyraExecution = {
  retryCount: number;
  validationStatus: string;
  usage?: unknown;
  warnings: string[];
  errors: string[];
  finishReason: string;
};

export type LyraCaptionInput = {
  mode?: "generate" | "rewrite" | "expand" | "shorten" | "brand_voice";
  topic?: string;
  existingCaption?: string;
  images?: string[];
  brandVoice?: string;
  tone?: string;
};
export type LyraKeywordInput = {
  mode?: "extraction" | "seo";
  topic?: string;
  sourceText?: string;
  images?: string[];
};
export type LyraHashtagInput = { topic?: string; caption?: string; count?: number };
export type LyraSuggestionInput = {
  type?: "reel" | "story" | "carousel" | "cta";
  topic?: string;
  count?: number;
};
export type LyraInsightInput = {
  focus?: "business_insights" | "growth_analysis" | "marketing_strategy";
  goal?: string;
};
export type LyraAnalyticsInput = { period?: "weekly" | "monthly" };
export type LyraAnalyticsHighlight = { finding: string; metric: string; severity: string };
export type LyraRecommendation = {
  action: string;
  rationale: string;
  priority: string;
  expectedImpact: string;
};
export type LyraVisionInput = { images: string[]; focus?: string };
export type LyraOcrInput = { images: string[]; focus?: string };
export type LyraImageSummaryInput = { images: string[] };
export type LyraChatInput = {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
};
export type LyraCustomPromptInput = {
  prompt: string;
  systemPrompt?: string;
  images?: string[];
  responseFormat?: "text" | "json";
};

/** Mirrors the automation wizard's real `TriggerBlock`/`BuilderForm` shape
 *  (routes/_app/automations.new.tsx) — not a single flat reply/DM pair, since one
 *  automation can have several independent keyword -> reply/DM blocks. */
export type LyraAutomationTriggerBlockPatch = {
  keyword: string;
  autoReply: boolean;
  replyMessage: string;
  dmMessage: string;
  hasButton: boolean;
  dmButtonLabel: string;
  dmButtonUrl: string;
};
export type LyraAutomationFollowUpPatch = { delayMinutes: number; message: string };
export type LyraAutomationDraftFields = {
  name: string;
  postScope: "specific" | "any" | "next";
  anyComment: boolean;
  triggerBlocks: LyraAutomationTriggerBlockPatch[];
  followBeforeDm: boolean;
  followUps: LyraAutomationFollowUpPatch[];
};
export type LyraAutomationCopilotInput = {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  /** The wizard's current in-progress field values, so multi-turn edits have context. */
  currentDraftState: Partial<LyraAutomationDraftFields>;
};
export type LyraAutomationCopilotOutput = LyraAutomationDraftFields & {
  reply: string;
  changedFields: Array<keyof LyraAutomationDraftFields>;
};

/** Mirrors the scheduler compose dialog's own "Automation" toggle section (scheduler.tsx's
 *  `automationEnabled`/`automationKeywords`/etc. fields) — a single shared keyword set + DM
 *  attached to the SAME post, not a separate standalone automation. Sent as `body.automation`
 *  to `createScheduledPost`, exactly like the composer's own submit does. */
export type LyraPostAutomationFields = {
  enabled: boolean;
  name: string;
  keywords: string[];
  anyComment: boolean;
  dmMessage: string;
  autoReply: boolean;
  replyMessages: string[];
  dmButtonLabel: string;
  dmButtonUrl: string;
};
export type LyraPostDraftFields = {
  caption: string;
  hashtags: string[];
  /** Naive local wall time, "YYYY-MM-DDTHH:mm" — same format the scheduler API's
   *  `scheduledLocal` field expects, so it can be passed straight through on create. */
  scheduledLocal: string;
  musicTitle: string;
  musicArtist: string;
  shareToFeed: boolean;
  automation: LyraPostAutomationFields;
};
export type LyraCreatorCopilotInput = {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  currentPostDraftState: Partial<LyraPostDraftFields>;
  currentAutomationDraftState: Partial<LyraAutomationDraftFields>;
  nowLocal: string;
  timezone: string;
  /** Base64 data URLs of attached media (thumbnails) — switches the server call
   *  to the vision model so "caption this image" requests actually see the image. */
  images?: string[];
};
export type LyraCreatorCopilotOutput = {
  reply: string;
  intent: "post" | "automation" | "chat";
  postDraft?: LyraPostDraftFields;
  automationDraft?: LyraAutomationDraftFields;
  changedFields: string[];
};

export type LyraTaskMap = {
  chat: { input: LyraChatInput; output: { reply: string } };
  caption: { input: LyraCaptionInput; output: { caption: string } };
  keyword: { input: LyraKeywordInput; output: { keywords: string[] } };
  hashtag: { input: LyraHashtagInput; output: { hashtags: string[] } };
  suggestion: { input: LyraSuggestionInput; output: { suggestions: string[] } };
  insight: {
    input: LyraInsightInput;
    output: {
      summary: string;
      insights: LyraAnalyticsHighlight[];
      recommendations: LyraRecommendation[];
    };
  };
  analytics: {
    input: LyraAnalyticsInput;
    output: { period: string; summary: string; highlights: LyraAnalyticsHighlight[] };
  };
  vision_analysis: {
    input: LyraVisionInput;
    output: { imageType: string; summary: string; extractedData: Record<string, unknown> };
  };
  ocr: { input: LyraOcrInput; output: { text: string; tables: string[][] } };
  image_summary: { input: LyraImageSummaryInput; output: { summary: string } };
  custom_prompt: { input: LyraCustomPromptInput; output: { response: string } };
  automation_copilot: { input: LyraAutomationCopilotInput; output: LyraAutomationCopilotOutput };
  creator_copilot: { input: LyraCreatorCopilotInput; output: LyraCreatorCopilotOutput };
};

export type LyraOptions = { resync?: boolean } & Record<string, unknown>;

const STREAMING_TASKS: ReadonlySet<LyraTask> = new Set(["chat", "caption", "custom_prompt"]);

/** Only chat/caption/custom_prompt emit real token-by-token deltas server-side. */
export function lyraTaskSupportsStreaming(task: LyraTask): boolean {
  return STREAMING_TASKS.has(task);
}

export type LyraCallConfig<K extends keyof LyraTaskMap> = {
  task: K;
  input: LyraTaskMap[K]["input"];
  options?: LyraOptions;
  workspaceId?: string;
};

function lyraHeaders(workspaceId?: string): HeadersInit {
  const token = authStore.getState().accessToken;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(workspaceId ? { "x-workspace-id": workspaceId } : {}),
  };
}

/** Non-streaming Lyra call. Resolves with typed `content`, or rejects with a `LyraError`. */
export async function callLyra<K extends keyof LyraTaskMap>(
  config: LyraCallConfig<K> & { signal?: AbortSignal },
): Promise<{ content: LyraTaskMap[K]["output"]; execution: LyraExecution; requestId: string }> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${apiUri.liffio.lyra}`, {
      method: "POST",
      cache: "no-store",
      credentials: "include",
      headers: lyraHeaders(config.workspaceId),
      body: JSON.stringify({
        task: config.task,
        input: config.input,
        options: config.options,
        stream: false,
      }),
      signal: config.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    const netErr: LyraError = { code: "NETWORK_ERROR", message: "Request failed" };
    throw netErr;
  }

  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.success) {
    const err: LyraError = payload?.error ?? { code: "NETWORK_ERROR", message: "Request failed" };
    throw err;
  }
  return { content: payload.content, execution: payload.execution, requestId: payload.requestId };
}

export type LyraStreamHandlers = {
  onStart?: (data: Record<string, unknown>) => void;
  onDelta?: (content: string) => void;
  onMetadata?: (data: Record<string, unknown>) => void;
  onComplete?: (data: Record<string, unknown>) => void;
  onError?: (error: LyraError) => void;
};

/**
 * Streaming Lyra call over SSE. EventSource can't send a Bearer header, so we
 * parse the `event:`/`data:` frames off a manual fetch + ReadableStream reader.
 */
export async function streamLyra<K extends keyof LyraTaskMap>(
  config: LyraCallConfig<K> & { signal?: AbortSignal },
  handlers: LyraStreamHandlers,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${apiUri.liffio.lyra}`, {
      method: "POST",
      cache: "no-store",
      credentials: "include",
      headers: lyraHeaders(config.workspaceId),
      body: JSON.stringify({
        task: config.task,
        input: config.input,
        options: config.options,
        stream: true,
      }),
      signal: config.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    handlers.onError?.({ code: "NETWORK_ERROR", message: "Request failed" });
    return;
  }

  if (!res.ok || !res.body) {
    const errJson = await res.json().catch(() => null);
    handlers.onError?.(errJson?.error ?? { code: "NETWORK_ERROR", message: "Request failed" });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        const lines = frame.split("\n");
        const eventLine = lines.find((l) => l.startsWith("event:"));
        const dataLine = lines.find((l) => l.startsWith("data:"));
        if (!eventLine || !dataLine) continue;
        const event = eventLine.slice("event:".length).trim();

        let data: Record<string, unknown>;
        try {
          data = JSON.parse(dataLine.slice("data:".length).trim());
        } catch {
          continue;
        }

        if (event === "start") handlers.onStart?.(data);
        else if (event === "delta") handlers.onDelta?.(String(data.content ?? ""));
        else if (event === "metadata") handlers.onMetadata?.(data);
        else if (event === "error")
          handlers.onError?.((data.error as LyraError) ?? (data as LyraError));
        else if (event === "complete") handlers.onComplete?.(data);
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    handlers.onError?.({ code: "NETWORK_ERROR", message: "Connection lost" });
  }
}
