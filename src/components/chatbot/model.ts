import {
  DEFAULT_STEP_DELAY_SECONDS,
  type ButtonAction,
  type Chatbot,
  type ChatbotButton,
  type ChatbotStep,
  type GraphInput,
  type Rule,
  type StepType,
} from "@/lib/api/chatbot-api";

/**
 * Builder model: pure helpers shared by the list, the builder and the preview.
 *
 * Ids are created here (`crypto.randomUUID`) rather than by the server, so a button can point at a
 * step that has not been saved yet and the whole graph still saves in one request.
 */

export const uid = (): string => crypto.randomUUID();

/** Delay presets, in seconds (prototype `DELAYS`). */
export const DELAY_PRESETS = [0, 2, 5, 10, 30, 60, 300, 3600] as const;
/** Follow-up presets, measured from the step's own send (prototype `FU_TIMES`). */
export const FOLLOW_UP_PRESETS = [300, 900, 1800, 3600, 10800, 21600, 43200, 82800] as const;

export function formatDelay(sec: number | null | undefined): string {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  if (!s) return "Instant";
  if (s < 60) return `${s} sec`;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h ? (m ? `${h} hr ${m} min` : `${h} hr`) : `${m} min`;
}

export const STEP_LABEL: Record<StepType, string> = {
  MESSAGE: "Message",
  QUESTION: "Question",
  CONDITION: "Condition",
  HANDOVER: "Hand to a person",
  START_CHATBOT: "Start chatbot",
};

export function newStep(type: StepType, position: number): ChatbotStep {
  const base = {
    id: uid(),
    type,
    position,
    // R8: every new message step waits 2 seconds, so the bot reads as typing, not instant.
    delaySeconds: type === "CONDITION" || type === "START_CHATBOT" ? 0 : DEFAULT_STEP_DELAY_SECONDS,
    mediaAssetId: null,
    tagToAdd: null,
    buttons: [] as ChatbotButton[],
    followUps: [],
  };
  switch (type) {
    case "MESSAGE":
      return {
        ...base,
        name: "New step",
        body: "Type your reply here",
        config: { nextStepId: null },
      };
    case "QUESTION":
      return {
        ...base,
        name: "New question",
        body: "What's your email?",
        config: {
          answerKey: "email",
          answerType: "EMAIL",
          retryMessage: "That doesn't look quite right, mind trying again?",
          nextStepId: null,
          skipStepId: null,
        },
      };
    case "CONDITION":
      return {
        ...base,
        name: "New condition",
        body: null,
        config: {
          match: "all",
          rules: [{ kind: "has_tag", name: "" }],
          yesStepId: null,
          elseStepId: null,
        },
      };
    case "HANDOVER":
      return {
        ...base,
        name: "Hand to a person",
        body: "Got it! Someone from our team will reply here soon 🙌",
        config: { nextStepId: null },
      };
    case "START_CHATBOT":
      return {
        ...base,
        name: "Start another chatbot",
        body: null,
        config: { targetChatbotId: "" },
      };
  }
}

export function newButton(action: ButtonAction = "NEXT_STEP", label = "New button"): ChatbotButton {
  return {
    id: uid(),
    label,
    action,
    targetStepId: null,
    targetChatbotId: null,
    url: action === "LINK" ? "https://" : null,
    tagToAdd: null,
  };
}

const OPS: Record<string, string> = {
  is: "is",
  contains: "contains",
  gt: "more than",
  lt: "less than",
  is_set: "is saved",
};

export function ruleText(r: Rule): string {
  const n = r.name?.trim() || "…";
  if (r.kind === "has_tag") return `has tag ${n}`;
  if (r.kind === "not_tag") return `doesn't have tag ${n}`;
  return r.op === "is_set" ? `${n} is saved` : `${n} ${OPS[r.op]} ${r.value?.trim() || "…"}`;
}

export const conditionRules = (s: ChatbotStep): Rule[] =>
  Array.isArray(s.config.rules) ? (s.config.rules as Rule[]) : [];
export const cfgStr = (s: ChatbotStep, key: string): string | null =>
  typeof s.config[key] === "string" && s.config[key] ? (s.config[key] as string) : null;

export function stepSummary(s: ChatbotStep): string {
  if (s.type === "CONDITION") {
    const match = s.config.match === "any" ? "any" : "all";
    return (
      `If ${match.toUpperCase()}: ` +
      conditionRules(s)
        .map(ruleText)
        .join(match === "all" ? " and " : " or ")
    );
  }
  if (s.type === "START_CHATBOT") return "Continues in another chatbot";
  return (s.body ?? "").split("\n")[0] || (s.mediaAssetId ? "Media" : "Empty message");
}

/** The whole draft as `PUT /graph` takes it. Positions follow array order. */
export function toGraph(
  bot: Pick<Chatbot, "name" | "icon" | "handoverMessage" | "fallbackMessage" | "firstStepId">,
  steps: ChatbotStep[],
): GraphInput {
  return {
    name: bot.name.trim() || "Untitled chatbot",
    icon: bot.icon,
    handoverMessage: bot.handoverMessage,
    fallbackMessage: bot.fallbackMessage,
    firstStepId: steps[0]?.id ?? null,
    steps: steps.map((s, i) => ({ ...s, position: i })),
  };
}

/** Removes a step and clears every link into it (the buttons stay, now "Pick next step"), so the
 *  draft never points at nothing. */
export function removeStep(steps: ChatbotStep[], id: string): ChatbotStep[] {
  const unlink = (v: unknown) => (v === id ? null : v);
  const unlinkButton = (b: ChatbotButton) =>
    b.targetStepId === id ? { ...b, targetStepId: null } : b;
  return steps
    .filter((s) => s.id !== id)
    .map((s) => ({
      ...s,
      config: Object.fromEntries(Object.entries(s.config).map(([k, v]) => [k, unlink(v)])),
      buttons: s.buttons.map(unlinkButton),
      followUps: s.followUps.map((f) => ({ ...f, buttons: f.buttons.map(unlinkButton) })),
    }));
}

export function duplicateStep(s: ChatbotStep): ChatbotStep {
  return {
    ...structuredClone(s),
    id: uid(),
    name: `${s.name} copy`,
    buttons: s.buttons.map((b) => ({ ...b, id: uid() })),
    followUps: s.followUps.map((f) => ({
      ...f,
      id: uid(),
      buttons: f.buttons.map((b) => ({ ...b, id: uid() })),
    })),
  };
}

/* Templates are the server's library (GET /chatbots/templates, chatbot:templates). */
