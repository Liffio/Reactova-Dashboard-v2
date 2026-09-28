import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

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
  | "NOTIFY";

/** One delivery of a Webhook step, newest first. */
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
export const MAX_FOLLOW_UPS = 2;
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
  tags: string[];
  lastInboundAt: string | null;
  windowExpiresAt: string | null;
  botPausedUntil: string | null;
  pausedReason: "HANDOVER" | "HUMAN_REPLY" | "MANUAL" | null;
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

/** One ready-made flow from the server's library. `gated` ones need `chatbot:templates`. */
export interface ChatbotTemplateSummary {
  key: string;
  icon: string;
  name: string;
  description: string;
  stepCount: number;
  gated: boolean;
}

export const chatbotApi = {
  list: (workspaceId: string) =>
    unwrap(apiRequest<{ data: ChatbotListResponse }>(apiUri.chatbots.list, { workspaceId })),
  templates: (workspaceId: string) =>
    unwrap(
      apiRequest<{ data: ChatbotTemplateSummary[] }>(apiUri.chatbots.templates, { workspaceId }),
    ),
  get: (workspaceId: string, id: string) =>
    unwrap(apiRequest<{ data: Chatbot }>(apiUri.chatbots.byId(id), { workspaceId })),
  create: (
    workspaceId: string,
    body: { name: string; icon?: string; graph?: Omit<GraphInput, "name">; templateKey?: string },
  ) =>
    unwrap(
      apiRequest<{ data: Chatbot }>(apiUri.chatbots.list, { method: "POST", workspaceId, body }),
    ),
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
    body: { contact: TestResult["contact"]; actions: TestAction[]; outsideHours?: boolean },
  ) =>
    unwrap(
      apiRequest<{ data: TestResult }>(apiUri.chatbots.test(id), {
        method: "POST",
        workspaceId,
        body,
      }),
    ),
  alertRecipients: (workspaceId: string) =>
    unwrap(
      apiRequest<{ data: Array<{ id: string; name: string | null; email: string }> }>(
        apiUri.chatbots.alertRecipients,
        { workspaceId },
      ),
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
};
