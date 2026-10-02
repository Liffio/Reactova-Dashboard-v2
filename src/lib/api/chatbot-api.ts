import { apiUri } from "./apiUri";
import { apiRequest, apiUploadRequestWithProgress } from "./http";

/**
 * Chatbots. Types mirror `server/src/types/chatbot.ts` and the views in
 * `server/src/services/chatbot/authoring.ts`; every endpoint answers `{ data }`, unwrapped here.
 */

export type ChatbotStatus = "DRAFT" | "LIVE" | "PAUSED" | "ARCHIVED";
export type StepType =
  | "MESSAGE"
  | "QUESTION"
  | "CONDITION"
  | "HANDOVER"
  | "START_CHATBOT"
  | "WEBHOOK"
  | "NOTIFY"
  | "SPLIT"
  | "FOLLOW_GATE";

/** What an Ask-to-follow check answers in the preview (Instagram is never asked there). */
export type PreviewFollowState = "FOLLOWING" | "NOT_FOLLOWING" | "UNKNOWN";

/** One delivery of a Webhook step, newest first. */
/** The builder's Test send: the status your server answered with, or why nothing was sent. */
export type WebhookTestResult =
  | { ok: boolean; status: number; ms: number }
  | { ok: false; status: null; ms: number; error: string };

export interface WebhookDelivery {
  ok: boolean;
  at: string;
  status?: number;
  error?: string;
  attempt?: number;
  attempts?: number;
}
export type ButtonAction = "NEXT_STEP" | "LINK" | "HANDOVER" | "START_CHATBOT" | "SKIP";
export type AnswerType = "TEXT" | "EMAIL" | "PHONE" | "NUMBER";
export type MatchMode = "CONTAINS" | "EXACT";
export type TriggerType =
  | "KEYWORD"
  | "STORY_REPLY"
  | "STORY_MENTION"
  | "DEFAULT_REPLY"
  | "COMMENT_AUTOMATION";

export const MAX_DELAY_SECONDS = 82_800;
export const MAX_QUICK_REPLIES = 13;
export const MAX_BUTTON_LABEL = 20;
export const MAX_CONDITION_RULES = 5;
/** Ceiling under every plan; the plan's `limits.followUpsPerStep` sets the real number (see `followUpCap`). */
export const MAX_FOLLOW_UPS = 3;
export const MAX_FOLLOW_UP_BUTTONS = 3;
export const DEFAULT_STEP_DELAY_SECONDS = 2;

export interface ChatbotButton {
  id: string;
  label: string;
  action: ButtonAction;
  targetStepId: string | null;
  targetChatbotId: string | null;
  url: string | null;
  tagToAdd: string | null;
}

export interface ChatbotFollowUp {
  id: string;
  afterSeconds: number;
  message: string;
  order: number;
  buttons: ChatbotButton[];
}

export type Rule =
  | { kind: "has_tag"; name: string }
  | { kind: "not_tag"; name: string }
  | {
      kind: "answer";
      name: string;
      op: "is" | "contains" | "gt" | "lt" | "is_set";
      value?: string;
    };

export interface ChatbotStep {
  id: string;
  type: StepType;
  name: string;
  position: number;
  delaySeconds: number;
  body: string | null;
  mediaAssetId: string | null;
  tagToAdd: string | null;
  config: Record<string, unknown>;
  buttons: ChatbotButton[];
  followUps: ChatbotFollowUp[];
}

export interface ChatbotTrigger {
  id: string;
  type: TriggerType;
  value: string | null;
  matchMode: MatchMode;
  isEnabled: boolean;
}

/** How long a handover and a human reply keep the bot quiet for a person (chatbot_global_settings). */
export interface ChatbotPauseSettings {
  handoverPauseMinutes: number;
  humanReplyPauseMinutes: number;
}

export type ChatbotMediaKind = "image" | "video" | "audio";

/**
 * A step's file, as the server describes it. `url` and `thumbnailUrl` are signed links that work
 * for 15 minutes from when they were fetched — never store them; the builder refreshes them on
 * every save and on a timer. Null when the file is gone or links can't be signed right now.
 */
export interface ChatbotMedia {
  mediaAssetId: string;
  kind: ChatbotMediaKind;
  url: string | null;
  thumbnailUrl: string | null;
  contentType: string;
  sizeBytes: number;
  /** Instagram's limit for this kind, to show the size against. */
  maxBytes: number;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  originalName: string;
  missing: boolean;
}

export interface Chatbot {
  id: string;
  name: string;
  icon: string;
  status: ChatbotStatus;
  version: number;
  publishedAt: string | null;
  hasUnpublishedChanges: boolean;
  platformAccountId: string | null;
  handoverMessage: string;
  fallbackMessage: string;
  brandingEnabled: boolean;
  firstStepId: string | null;
  steps: ChatbotStep[];
  triggers: ChatbotTrigger[];
  /** Every file the steps use, keyed by id, signed for this load (`GET /:id`, `PUT /:id/graph`). */
  media?: Record<string, ChatbotMedia>;
}

export interface ChatbotListItem {
  id: string;
  name: string;
  icon: string;
  status: ChatbotStatus;
  version: number;
  publishedAt: string | null;
  updatedAt: string;
  stepCount: number;
  chats30d: number;
  triggers: ChatbotTrigger[];
}

/** What `PUT /graph` takes: the whole draft. */
export interface GraphInput {
  name: string;
  icon: string;
  handoverMessage: string;
  fallbackMessage: string;
  firstStepId: string | null;
  steps: ChatbotStep[];
}

export interface PublishProblem {
  code: string;
  severity: "error" | "warning";
  message: string;
  stepId?: string;
  stepIds?: string[];
}

export interface IceBreakerSlot {
  slot: number;
  text: string;
  chatbotId: string | null;
  syncedAt: string | null;
  syncError: string | null;
}

export interface ContactRow {
  id: string;
  igUserId: string;
  igUsername: string | null;
  displayName: string | null;
  profilePicUrl: string | null;
  /** The Instagram profile lookup; `no_consent` / `failed`: Instagram did not share it. */
  profileStatus?: "queued" | "ok" | "no_consent" | "failed" | null;
  tags: string[];
  lastInboundAt: string | null;
  windowExpiresAt: string | null;
  botPausedUntil: string | null;
  pausedReason: "HANDOVER" | "HUMAN_REPLY" | "MANUAL" | null;
  /** Who a handover was assigned to (null: the team). */
  assignedTo?: { id: string; name: string | null } | null;
  activeSession: {
    id: string;
    chatbotId: string;
    chatbotName: string;
    stepName: string | null;
    awaiting: string;
  } | null;
}

export interface ContactDetail extends ContactRow {
  answers: Record<string, { value: string; type: AnswerType; at: string }>;
  sessions: Array<{
    id: string;
    chatbotId: string;
    chatbotName: string;
    status: string;
    entry: string | null;
    startedAt: string | null;
    endedAt: string | null;
    endReason: string | null;
    stepCount: number;
  }>;
}

/**
 * One conversation, read live from Instagram and never stored. When Instagram can't answer, a
 * summary of the run (steps sent, buttons tapped) instead, which has nothing the person typed.
 */
export interface ConversationMessage {
  id: string;
  at: string;
  /** `business`: sent from the account but not by this chatbot, usually a person in Instagram. */
  from: "contact" | "bot" | "business";
  text: string | null;
  /** The step file this bot message carried (see `ConversationTranscript.media`). */
  mediaAssetId?: string | null;
}
export type ConversationSummaryItem =
  | { kind: "started"; at: string; entry: string | null }
  | {
      kind: "step";
      at: string;
      stepName: string;
      text: string | null;
      mediaAssetId?: string | null;
    }
  | { kind: "follow_up"; at: string; stepName: string; text: string | null }
  | { kind: "fallback"; at: string; text: string | null }
  | { kind: "tap"; at: string; label: string }
  | { kind: "answer"; at: string; key: string; valid: boolean }
  | { kind: "handover"; at: string }
  | { kind: "ended"; at: string; reason: string };
export type ConversationSummaryReason =
  "account_disconnected" | "instagram_unavailable" | "too_old" | "not_found";
export type ConversationTranscript =
  | {
      mode: "transcript";
      messages: ConversationMessage[];
      partial: boolean;
      summary: ConversationSummaryItem[];
      /** The files it shows, keyed by id, signed for this page load. */
      media?: Record<string, ChatbotMedia>;
    }
  | {
      mode: "summary";
      reason: ConversationSummaryReason;
      summary: ConversationSummaryItem[];
      media?: Record<string, ChatbotMedia>;
    };

export type TestAction =
  | { kind: "tap"; buttonId: string }
  | { kind: "text"; text: string }
  | { kind: "wait" };

export interface TranscriptEntry {
  from: "bot" | "person" | "system";
  text: string;
  stepId?: string;
  kind?: string;
  buttons?: Array<{ id: string; label: string; action: ButtonAction; url: string | null }>;
  delaySeconds?: number;
  mediaAssetId?: string | null;
}

export interface TestResult {
  transcript: TranscriptEntry[];
  state: {
    currentStepId: string | null;
    awaiting: string;
    ended: boolean;
    endReason: string | null;
    chatbotId: string;
  };
  contact: {
    tags: string[];
    answers: Record<string, { value: string; type: AnswerType; at: string }>;
  };
}

export interface ChatbotAnalytics {
  days: number;
  summary: {
    started: number;
    completed: number;
    handedOver: number;
    expired: number;
    byTrigger: Record<string, number>;
  };
  funnel: Array<{
    stepId: string;
    name: string;
    position: number;
    sent: number;
    taps: number;
    dropOffs: number;
    followUps: number;
    /** A/B split steps: runs sent down each path (0-based) in the window. */
    splitPaths?: Array<{ path: number; runs: number }>;
  }>;
}

const unwrap = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);

/** The plan's builder limits as the server resolves them. `null` is unlimited. */
export interface ChatbotLimits {
  stepsPerBot: number | null;
  keywordsPerBot: number | null;
  buttonsPerStep: number | null;
  conditionRules: number | null;
  followUpsPerStep: number | null;
  conversationsPerMonth: number | null;
}

export interface ChatbotListResponse {
  chatbots: ChatbotListItem[];
  /** Live chatbots allowed at once (a large number when unlimited). */
  limit: number;
  live: number;
  limits: ChatbotLimits;
  usage: { conversationsThisMonth: number };
}

export const WEEK_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];
/** Per day, same-day intervals as 24-hour "HH:MM" pairs. An empty day is closed. */
export type WeeklySchedule = Record<WeekDay, Array<[string, string]>>;
export interface BusinessHours {
  timezone: string;
  schedule: WeeklySchedule;
}
export interface BusinessHoursState {
  platformAccountId: string | null;
  /** Null until hours are set: always open. */
  hours: BusinessHours | null;
  openNow: boolean | null;
}

/**
 * One ready-made flow from the server's library. `gated` ones need `chatbot:templates`; "Start
 * blank" (`key: "blank"`, `id: null`) never does. `requiredCapabilities` are plan features the
 * flow uses: installing works without them, going live needs them.
 */
export interface ChatbotTemplateSummary {
  id: string | null;
  key: string;
  icon: string;
  name: string;
  description: string;
  stepCount: number;
  gated: boolean;
  categoryKey: string | null;
  categoryLabel: string | null;
  keywords: string[];
  featured: boolean;
  requiredCapabilities: string[];
}

/** A picker chip: an industry with at least one live template. */
export interface ChatbotTemplateCategory {
  key: string;
  label: string;
}

export const chatbotApi = {
  list: (workspaceId: string) =>
    unwrap(apiRequest<{ data: ChatbotListResponse }>(apiUri.chatbots.list, { workspaceId })),
  templates: (workspaceId: string) =>
    apiRequest<{ data: ChatbotTemplateSummary[]; categories?: ChatbotTemplateCategory[] }>(
      apiUri.chatbots.templates,
      { workspaceId },
    ).then((r) => ({ templates: r.data, categories: r.categories ?? [] })),
  get: (workspaceId: string, id: string) =>
    unwrap(apiRequest<{ data: Chatbot }>(apiUri.chatbots.byId(id), { workspaceId })),
  create: (
    workspaceId: string,
    body: {
      name: string;
      icon?: string;
      graph?: Omit<GraphInput, "name">;
      templateId?: string;
      templateKey?: string;
    },
  ) =>
    unwrap(
      apiRequest<{ data: Chatbot }>(apiUri.chatbots.list, { method: "POST", workspaceId, body }),
    ),
  updateMeta: (
    workspaceId: string,
    id: string,
    patch: Partial<{
      name: string;
      icon: string;
      handoverMessage: string;
      fallbackMessage: string;
      brandingEnabled: boolean;
    }>,
  ) =>
    unwrap(
      apiRequest<{ data: Chatbot }>(apiUri.chatbots.byId(id), {
        method: "PATCH",
        workspaceId,
        body: patch,
      }),
    ),
  /** One file for a Message step. The server decides the kind from the bytes; `kind` is what the
   *  author picked, so a mismatch comes back as a clear error rather than a surprise. */
  uploadMedia: (
    workspaceId: string,
    id: string,
    file: File,
    kind: ChatbotMediaKind,
    opts: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
  ) => {
    const form = new FormData();
    form.append("kind", kind);
    form.append("file", file);
    return unwrap(
      apiUploadRequestWithProgress<{ data: ChatbotMedia }>(apiUri.chatbots.media(id), form, {
        workspaceId,
        ...opts,
      }),
    );
  },
  /** 409 CHATBOT_MEDIA_IN_USE while a draft step or a published version still uses the file. */
  deleteMedia: (workspaceId: string, id: string, mediaId: string) =>
    apiRequest<void>(apiUri.chatbots.mediaItem(id, mediaId), { method: "DELETE", workspaceId }),
  saveGraph: (workspaceId: string, id: string, graph: GraphInput) =>
    unwrap(
      apiRequest<{ data: Chatbot }>(apiUri.chatbots.graph(id), {
        method: "PUT",
        workspaceId,
        body: graph,
      }),
    ),
  remove: (workspaceId: string, id: string) =>
    apiRequest<void>(apiUri.chatbots.byId(id), { method: "DELETE", workspaceId }),
  duplicate: (workspaceId: string, id: string) =>
    unwrap(
      apiRequest<{ data: Chatbot }>(apiUri.chatbots.duplicate(id), { method: "POST", workspaceId }),
    ),
  publish: (workspaceId: string, id: string) =>
    unwrap(
      apiRequest<{ data: Chatbot }>(apiUri.chatbots.publish(id), { method: "POST", workspaceId }),
    ),
  pause: (workspaceId: string, id: string) =>
    unwrap(
      apiRequest<{ data: Chatbot }>(apiUri.chatbots.pause(id), { method: "POST", workspaceId }),
    ),
  resume: (workspaceId: string, id: string) =>
    unwrap(
      apiRequest<{ data: Chatbot }>(apiUri.chatbots.resume(id), { method: "POST", workspaceId }),
    ),
  addTrigger: (
    workspaceId: string,
    id: string,
    body: {
      type: Exclude<TriggerType, "COMMENT_AUTOMATION">;
      value?: string | null;
      matchMode?: MatchMode;
    },
  ) =>
    unwrap(
      apiRequest<{
        data: {
          trigger: ChatbotTrigger;
          warnings: Array<{ keyword: string; chatbotName: string; winsOverThis: boolean }>;
        };
      }>(apiUri.chatbots.triggers(id), { method: "POST", workspaceId, body }),
    ),
  removeTrigger: (workspaceId: string, id: string, triggerId: string) =>
    apiRequest<void>(apiUri.chatbots.trigger(id, triggerId), { method: "DELETE", workspaceId }),
  analytics: (workspaceId: string, id: string, days = 30) =>
    unwrap(
      apiRequest<{ data: ChatbotAnalytics }>(apiUri.chatbots.analytics(id, days), { workspaceId }),
    ),
  test: (
    workspaceId: string,
    id: string,
    body: {
      contact: TestResult["contact"];
      actions: TestAction[];
      outsideHours?: boolean;
      followState?: PreviewFollowState;
    },
  ) =>
    unwrap(
      apiRequest<{ data: TestResult }>(apiUri.chatbots.test(id), {
        method: "POST",
        workspaceId,
        body,
      }),
    ),
  /** The real pause lengths, in minutes, for copy that explains them. */
  pauseSettings: (workspaceId: string) =>
    unwrap(
      apiRequest<{ data: ChatbotPauseSettings }>(apiUri.chatbots.pauseSettings, { workspaceId }),
    ),
  alertRecipients: (workspaceId: string) =>
    unwrap(
      apiRequest<{ data: Array<{ id: string; name: string | null; email: string }> }>(
        apiUri.chatbots.alertRecipients,
        { workspaceId },
      ),
    ),
  testWebhook: (
    workspaceId: string,
    id: string,
    body: { url: string; secret: string; stepId: string; stepName?: string },
  ) =>
    unwrap(
      apiRequest<{ data: WebhookTestResult }>(apiUri.chatbots.webhookTest(id), {
        method: "POST",
        workspaceId,
        body,
      }),
    ),
  webhookDeliveries: (workspaceId: string, id: string, stepId: string) =>
    unwrap(
      apiRequest<{ data: WebhookDelivery[] }>(apiUri.chatbots.webhookDeliveries(id, stepId), {
        workspaceId,
      }),
    ),
  businessHours: (workspaceId: string) =>
    unwrap(
      apiRequest<{ data: BusinessHoursState }>(apiUri.chatbots.businessHours, { workspaceId }),
    ),
  saveBusinessHours: (workspaceId: string, body: BusinessHours) =>
    unwrap(
      apiRequest<{ data: BusinessHoursState }>(apiUri.chatbots.businessHours, {
        method: "PUT",
        workspaceId,
        body,
      }),
    ),
  clearBusinessHours: (workspaceId: string) =>
    unwrap(
      apiRequest<{ data: BusinessHoursState }>(apiUri.chatbots.businessHours, {
        method: "DELETE",
        workspaceId,
      }),
    ),
  iceBreakers: (workspaceId: string) =>
    unwrap(
      apiRequest<{ data: { platformAccountId: string | null; slots: IceBreakerSlot[] } }>(
        apiUri.chatbots.iceBreakers,
        { workspaceId },
      ),
    ),
  saveIceBreakers: (
    workspaceId: string,
    slots: Array<{ slot: number; text: string; chatbotId: string | null }>,
  ) =>
    unwrap(
      apiRequest<{
        data: {
          platformAccountId: string | null;
          slots: IceBreakerSlot[];
          sync: { ok: boolean; error: string | null };
        };
      }>(apiUri.chatbots.iceBreakers, { method: "PUT", workspaceId, body: { slots } }),
    ),
  contacts: (
    workspaceId: string,
    q: { q?: string; paused?: boolean; cursor?: string | null; limit?: number },
  ) => {
    const qs = new URLSearchParams();
    if (q.q) qs.set("q", q.q);
    if (q.paused) qs.set("paused", "true");
    if (q.cursor) qs.set("cursor", q.cursor);
    if (q.limit) qs.set("limit", String(q.limit));
    return unwrap(
      apiRequest<{ data: { contacts: ContactRow[]; nextCursor: string | null } }>(
        apiUri.chatbots.contacts(qs.toString()),
        { workspaceId },
      ),
    );
  },
  contact: (workspaceId: string, contactId: string) =>
    unwrap(
      apiRequest<{ data: ContactDetail }>(apiUri.chatbots.contact(contactId), { workspaceId }),
    ),
  pauseContact: (workspaceId: string, contactId: string, hours: number) =>
    unwrap(
      apiRequest<{ data: ContactDetail }>(apiUri.chatbots.contactPause(contactId), {
        method: "POST",
        workspaceId,
        body: { hours },
      }),
    ),
  conversation: (workspaceId: string, contactId: string, sessionId: string) =>
    unwrap(
      apiRequest<{ data: ConversationTranscript }>(
        apiUri.chatbots.contactConversation(contactId, sessionId),
        { workspaceId },
      ),
    ),
  resumeContact: (workspaceId: string, contactId: string) =>
    unwrap(
      apiRequest<{ data: ContactDetail }>(apiUri.chatbots.contactResume(contactId), {
        method: "POST",
        workspaceId,
      }),
    ),
};

export const chatbotKeys = {
  list: (ws: string) => ["chatbots", ws] as const,
  templates: (ws: string) => ["chatbot-templates", ws] as const,
  businessHours: (ws: string) => ["chatbot-business-hours", ws] as const,
  one: (ws: string, id: string) => ["chatbot", ws, id] as const,
  ice: (ws: string) => ["chatbot-ice-breakers", ws] as const,
  contacts: (ws: string) => ["chatbot-contacts", ws] as const,
  analytics: (ws: string, id: string, days: number) => ["chatbot-analytics", ws, id, days] as const,
  pauseSettings: (ws: string) => ["chatbot-pause-settings", ws] as const,
};
