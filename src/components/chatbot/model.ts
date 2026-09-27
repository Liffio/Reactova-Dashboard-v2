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

/* ---------------------------------------------------------------- templates (spec §10.2) */

type TplButton = { label: string; to: string | null | "HUMAN" };
type TplStep =
  | {
      key: string;
      name: string;
      text: string;
      tag?: string;
      buttons: TplButton[];
      followUps?: Array<{ after: number; text: string }>;
    }
  | {
      key: string;
      name: string;
      cond: { match: "all" | "any"; tags: string[]; yes: string; no: string };
    };

interface Template {
  key: string;
  icon: string;
  name: string;
  description: string;
  steps: TplStep[];
}

export const TEMPLATES: Template[] = [
  {
    key: "discount",
    icon: "🏷️",
    name: "Discount code",
    description: "Hand out a code once, remember who has it",
    steps: [
      {
        key: "c1",
        name: "Already has a code?",
        cond: { match: "any", tags: ["Got discount code"], yes: "s5", no: "c2" },
      },
      {
        key: "c2",
        name: "Returning customer?",
        cond: { match: "any", tags: ["VIP", "Bought before"], yes: "s6", no: "s1" },
      },
      {
        key: "s1",
        name: "Offer",
        text: "Want 10% off your first order? 🎉",
        followUps: [{ after: 3600, text: "Your 10% off is still waiting 👀 Want it?" }],
        buttons: [
          { label: "Yes, send code", to: "s2" },
          { label: "No thanks", to: "s3" },
        ],
      },
      {
        key: "s2",
        name: "Send code",
        text: "Here's your code: WELCOME10\nValid for 7 days. Use it at checkout.",
        tag: "Got discount code",
        buttons: [
          { label: "Any other offers?", to: "s4" },
          { label: "Talk to a person", to: "HUMAN" },
        ],
      },
      {
        key: "s3",
        name: "Maybe later",
        text: 'No worries! Just message "discount" anytime if you change your mind.',
        buttons: [],
      },
      {
        key: "s4",
        name: "Other offers",
        text: "Right now it's free shipping on orders above ₹999 too.",
        buttons: [],
      },
      {
        key: "s5",
        name: "Already sent",
        text: "You already have your code: WELCOME10 😊\nIt's valid for 7 days from when we sent it.",
        buttons: [{ label: "Talk to a person", to: "HUMAN" }],
      },
      {
        key: "s6",
        name: "Special code",
        text: "Welcome back! As a returning customer you get 20% off: THANKYOU20 💛",
        tag: "Got discount code",
        buttons: [],
      },
    ],
  },
  {
    key: "support",
    icon: "🛟",
    name: "Customer support",
    description: "Route questions, hand hard ones to your team",
    steps: [
      {
        key: "s1",
        name: "Help menu",
        text: "Hi! What do you need help with?",
        buttons: [
          { label: "Order status", to: "s2" },
          { label: "Return or exchange", to: "s3" },
          { label: "Something else", to: "HUMAN" },
        ],
      },
      {
        key: "s2",
        name: "Order status",
        text: "Send us your order number and our team will check it for you.",
        buttons: [{ label: "Talk to a person", to: "HUMAN" }],
      },
      {
        key: "s3",
        name: "Returns",
        text: "Returns are free within 7 days of delivery. Want to start one?",
        buttons: [
          { label: "Yes, start return", to: "HUMAN" },
          { label: "No, all good", to: "s4" },
        ],
      },
      { key: "s4", name: "Close", text: "Great! Have a nice day 😊", buttons: [] },
    ],
  },
  {
    key: "collab",
    icon: "🤝",
    name: "Collab requests",
    description: "Sort creators from brands, collect details",
    steps: [
      {
        key: "s1",
        name: "Intro",
        text: "Thanks for reaching out about a collab! Are you a creator or a brand?",
        buttons: [
          { label: "Creator", to: "s2" },
          { label: "Brand", to: "s2" },
        ],
      },
      {
        key: "s2",
        name: "Next steps",
        text: "Send your media kit or a few details and our team will get back within 2 days.",
        buttons: [{ label: "Talk to a person", to: "HUMAN" }],
      },
    ],
  },
  {
    key: "pricing",
    icon: "💰",
    name: "Pricing questions",
    description: "Walk people through your plans",
    steps: [
      {
        key: "s1",
        name: "Welcome",
        text: "Hey! Thanks for asking about pricing 👋\nWhat are you looking for?",
        followUps: [
          { after: 1800, text: "Still there? Tap below to see our plans 👇" },
          { after: 10800, text: "Last nudge 🙂 Want the plan details?" },
        ],
        buttons: [
          { label: "See plans", to: "s2" },
          { label: "Is there a free plan?", to: "s3" },
          { label: "Talk to a person", to: "HUMAN" },
        ],
      },
      {
        key: "s2",
        name: "Plans overview",
        text: "We have 3 plans:\nStarter ₹499/mo\nGrowth ₹1,499/mo\nBusiness ₹2,999/mo\n\nWant help picking one?",
        buttons: [
          { label: "Help me pick", to: "s4" },
          { label: "Back to start", to: "s1" },
        ],
      },
      {
        key: "s3",
        name: "Free plan",
        text: "Yes! The free plan gives you 3 automations, no card needed.",
        buttons: [{ label: "See paid plans", to: "s2" }],
      },
      {
        key: "s4",
        name: "Plan picker",
        text: "How many DMs do you send in a month roughly?",
        buttons: [
          { label: "Under 1,000", to: null },
          { label: "1,000 to 10,000", to: null },
          { label: "More than that", to: "HUMAN" },
        ],
      },
    ],
  },
  {
    key: "blank",
    icon: "💬",
    name: "Start blank",
    description: "One welcome message",
    steps: [{ key: "s1", name: "Welcome", text: "Hey! How can we help?", buttons: [] }],
  },
];

/** A template as the steps of a new draft, with fresh ids and every link resolved to them. */
export function templateSteps(t: Template): ChatbotStep[] {
  const ids = new Map(t.steps.map((s) => [s.key, uid()]));
  const to = (k: string | null) => (k && ids.has(k) ? ids.get(k)! : null);
  return t.steps.map((s, i) => {
    const id = ids.get(s.key)!;
    if ("cond" in s) {
      return {
        id,
        type: "CONDITION",
        name: s.name,
        position: i,
        delaySeconds: 0,
        body: null,
        mediaAssetId: null,
        tagToAdd: null,
        config: {
          match: s.cond.match,
          rules: s.cond.tags.map((name) => ({ kind: "has_tag", name })),
          yesStepId: to(s.cond.yes),
          elseStepId: to(s.cond.no),
        },
        buttons: [],
        followUps: [],
      };
    }
    return {
      id,
      type: "MESSAGE",
      name: s.name,
      position: i,
      delaySeconds: DEFAULT_STEP_DELAY_SECONDS,
      body: s.text,
      mediaAssetId: null,
      tagToAdd: s.tag ?? null,
      config: { nextStepId: null },
      buttons: s.buttons.map((b) => ({
        ...newButton(b.to === "HUMAN" ? "HANDOVER" : "NEXT_STEP", b.label),
        targetStepId: b.to === "HUMAN" ? null : to(b.to),
      })),
      followUps: (s.followUps ?? []).map((f, order) => ({
        id: uid(),
        afterSeconds: f.after,
        message: f.text,
        order,
        buttons: [],
      })),
    };
  });
}
