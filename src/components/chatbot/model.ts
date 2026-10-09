import {
  DEFAULT_STEP_DELAY_SECONDS,
  MAX_CONDITION_RULES,
  MAX_FOLLOW_UPS,
  MAX_QUICK_REPLIES,
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

/**
 * How many the builder offers on this plan: the package's limit (`null` is unlimited) under the
 * code's ceiling. `undefined` while the limits are still loading.
 */
function planCap(limit: number | null | undefined, ceiling: number): number | undefined {
  if (limit === undefined) return undefined;
  return limit === null ? ceiling : Math.min(Math.max(limit, 0), ceiling);
}

/** Follow-ups per step: `limits.followUpsPerStep` under `MAX_FOLLOW_UPS`. */
export const followUpCap = (limit: number | null | undefined) => planCap(limit, MAX_FOLLOW_UPS);

/** Reply buttons per step: `limits.buttonsPerStep` under `MAX_QUICK_REPLIES`. */
export const buttonCap = (limit: number | null | undefined) => planCap(limit, MAX_QUICK_REPLIES);

/** Rules per condition: `limits.conditionRules` under `MAX_CONDITION_RULES`. */
export const conditionRuleCap = (limit: number | null | undefined) => planCap(limit, MAX_CONDITION_RULES);

/**
 * A Webhook step's signing secret: 24 random bytes as hex, the same shape the server makes.
 * Created the moment the step is added, so it can be shown and copied before anything is saved;
 * the server keeps whatever the builder sends from then on.
 */
export const newWebhookSecret = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");

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
  WEBHOOK: "Webhook",
  NOTIFY: "Notify the team",
  SPLIT: "A/B split",
  FOLLOW_GATE: "Ask to follow",
};

/**
 * The name `newStep` gives each type, and the one `isDefaultStepName` (auto-name.ts) checks a step
 * against to tell "still the default" from "someone typed their own name" (spec: chatbot-ui-fixes
 * item 7). Handover, Start-another-chatbot, Webhook, Notify and A/B split get a name here that
 * never needs to change again — there is no varying content to name them from, so item 7's auto-
 * naming only ever touches Message, Question and Condition.
 */
export const DEFAULT_STEP_NAME: Record<StepType, string> = {
  MESSAGE: "New step",
  QUESTION: "New question",
  CONDITION: "New condition",
  HANDOVER: "Hand to a person",
  START_CHATBOT: "Start another chatbot",
  WEBHOOK: "Webhook",
  NOTIFY: "Notify the team",
  SPLIT: "A/B split",
  FOLLOW_GATE: "Ask to follow",
};

/** A fresh Message step's sample body — not "content the person added" (auto-name.ts). */
export const DEFAULT_MESSAGE_BODY = "Type your reply here";

export function newStep(type: StepType, position: number): ChatbotStep {
  const base = {
    id: uid(),
    type,
    position,
    // R8: every new message step waits 2 seconds, so the bot reads as typing, not instant.
    delaySeconds:
      type === "CONDITION" ||
      type === "START_CHATBOT" ||
      type === "WEBHOOK" ||
      type === "NOTIFY" ||
      type === "SPLIT"
        ? 0
        : DEFAULT_STEP_DELAY_SECONDS,
    mediaAssetId: null,
    tagToAdd: null,
    buttons: [] as ChatbotButton[],
    followUps: [],
  };
  switch (type) {
    case "MESSAGE":
      return {
        ...base,
        name: DEFAULT_STEP_NAME.MESSAGE,
        body: DEFAULT_MESSAGE_BODY,
        config: { nextStepId: null },
      };
    case "QUESTION":
      return {
        ...base,
        name: DEFAULT_STEP_NAME.QUESTION,
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
        name: DEFAULT_STEP_NAME.CONDITION,
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
        name: DEFAULT_STEP_NAME.HANDOVER,
        body: "Got it! Someone from our team will reply here soon 🙌",
        config: { nextStepId: null },
      };
    case "START_CHATBOT":
      return {
        ...base,
        name: DEFAULT_STEP_NAME.START_CHATBOT,
        body: null,
        config: { targetChatbotId: "" },
      };
    case "WEBHOOK":
      return {
        ...base,
        name: DEFAULT_STEP_NAME.WEBHOOK,
        body: null,
        config: { url: "", nextStepId: null, secret: newWebhookSecret() },
      };
    case "NOTIFY":
      return {
        ...base,
        name: DEFAULT_STEP_NAME.NOTIFY,
        body: null,
        config: { memberIds: [], message: "{{username|Someone}} needs a hand", nextStepId: null },
      };
    case "SPLIT":
      return {
        ...base,
        name: DEFAULT_STEP_NAME.SPLIT,
        body: null,
        config: {
          paths: [
            { label: "A", percent: 50, stepId: null },
            { label: "B", percent: 50, stepId: null },
          ],
        },
      };
    case "FOLLOW_GATE":
      return {
        ...base,
        name: DEFAULT_STEP_NAME.FOLLOW_GATE,
        body: "Follow us and I'll send it your way 👇",
        config: {
          visitLabel: "Visit profile",
          followingLabel: "Following ✅",
          // The comment automation's follow-gate wording, so both read the same.
          retryMessage:
            "We still don't see a follow on your account. Open Visit profile, tap Follow, then tap Following ✅ again.",
          followingStepId: null,
          notFollowingStepId: null,
          // Default true (spec: chatbot-ui-fixes item 4) — keep reminding rather than falling
          // through to Not following after the reprompt count.
          loopIfNotFollowing: true,
          followingRowLabel: "Following",
          notFollowingRowLabel: "Not following",
        },
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
  if (s.type === "SPLIT") {
    const paths = Array.isArray(s.config.paths)
      ? (s.config.paths as Array<{ label?: string; percent: number }>)
      : [];
    return `Splits ${paths.map((p, i) => `${p.label || String.fromCharCode(65 + i)} ${p.percent}%`).join(" / ")}`;
  }
  if (s.type === "NOTIFY")
    return cfgStr(s, "message")
      ? `Alerts the team: ${cfgStr(s, "message")}`
      : "Alert message not set";
  if (s.type === "WEBHOOK")
    return cfgStr(s, "url") ? `Sends to ${cfgStr(s, "url")}` : "Webhook address not set";
  if (s.type === "FOLLOW_GATE")
    return `Asks them to follow: ${(s.body ?? "").split("\n")[0] || "no message yet"}`;
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
  const copy = structuredClone(s);
  // One secret per step: a copied Webhook step signs with its own, never the original's.
  if (copy.type === "WEBHOOK") copy.config = { ...copy.config, secret: newWebhookSecret() };
  return {
    ...copy,
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

/**
 * Links a step just added from the "Add step" menu into the step that was open, without ever
 * overwriting a link: the first empty slot in the order that step's editor shows them. Returns the
 * updated step and the slot's name for the notice, or null when nothing was empty.
 *
 * Condition and Split have no single "next": the first empty branch is filled (Yes before
 * Otherwise, paths in order) and the notice names it, so the choice is visible and easy to change.
 */
export function autoLink(
  prev: ChatbotStep,
  newId: string,
): { step: ChatbotStep; slot: string } | null {
  const c = prev.config;
  const empty = (key: string) => !cfgStr(prev, key);
  const withConfig = (key: string, slot: string) => ({
    step: { ...prev, config: { ...c, [key]: newId } },
    slot,
  });
  const firstFreeButton = () => {
    const i = prev.buttons.findIndex((b) => b.action === "NEXT_STEP" && !b.targetStepId);
    if (i < 0) return null;
    const buttons = prev.buttons.map((b, j) => (j === i ? { ...b, targetStepId: newId } : b));
    return { step: { ...prev, buttons }, slot: `the "${prev.buttons[i].label}" button` };
  };

  switch (prev.type) {
    case "MESSAGE": {
      const viaButton = firstFreeButton();
      if (viaButton) return viaButton;
      // Without flow buttons a Message chains straight on; with them, "next" is never used.
      const hasFlowButtons = prev.buttons.some((b) => b.action !== "LINK");
      return !hasFlowButtons && empty("nextStepId")
        ? withConfig("nextStepId", "its next step")
        : null;
    }
    case "HANDOVER":
      return firstFreeButton();
    case "QUESTION":
      return empty("nextStepId") ? withConfig("nextStepId", "Then") : null;
    case "WEBHOOK":
    case "NOTIFY":
      return empty("nextStepId") ? withConfig("nextStepId", "its next step") : null;
    case "FOLLOW_GATE":
      if (empty("followingStepId")) return withConfig("followingStepId", "Following");
      return empty("notFollowingStepId") ? withConfig("notFollowingStepId", "Not following") : null;
    case "CONDITION":
      if (empty("yesStepId")) return withConfig("yesStepId", "Yes");
      return empty("elseStepId") ? withConfig("elseStepId", "Otherwise") : null;
    case "SPLIT": {
      const paths = Array.isArray(c.paths)
        ? (c.paths as Array<{ label?: string; percent?: number; stepId?: string | null }>)
        : [];
      const i = paths.findIndex((p) => !p.stepId);
      if (i < 0) return null;
      const next = paths.map((p, j) => (j === i ? { ...p, stepId: newId } : p));
      return {
        step: { ...prev, config: { ...c, paths: next } },
        slot: `path ${paths[i].label ?? i + 1}`,
      };
    }
    default:
      // Start another chatbot ends this flow; nothing comes after it.
      return null;
  }
}
