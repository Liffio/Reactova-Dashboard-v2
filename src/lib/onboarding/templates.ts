/**
 * The onboarding template registry — the ONLY place template copy lives.
 *
 * `plan/onboarding-revamp.md`, `docs/onboarding/liffio-onboarding-stage2.md` §"Template registry".
 *
 * ## Why the copy is here and not on the server
 *
 * `workspace.onboarding_state` stores **ids and ISO timestamps only** — `{ id: "resource",
 * version: 1 }`, never a caption or a DM body. Two consequences, both deliberate:
 *
 * - Changing a suggestion's wording is a frontend deploy, not a data migration. Workspaces that
 *   answered screen 2 last month get the new copy the next time they load the dashboard.
 * - The server's onboarding PATCH schema is a short list of enums with nothing free-text in it,
 *   which is what makes it safe to accept from the client at all.
 *
 * `version` exists so that a *semantic* change — a template that now means something different
 * rather than merely reads better — can be told apart from a wording tweak. Nothing branches on it
 * yet; it is stored so that the day something must, the stored rows can answer.
 *
 * ## What is NOT here
 *
 * The Free branding line, the follow-up DM, its button label and the delay. Those are env-driven
 * on the server and fetched from `GET /workspaces/branding-config` — see `useBrandingConfig`. A
 * copy of them here is a copy that drifts, and what it drifts on is a claim about what we are
 * going to post from the customer's own account.
 */

export type TemplateId = "link" | "resource" | "code" | "prices";

/** What screen 2 records. `unsure` is an answer; it maps to the `resource` template. */
export type OnboardingGoal = TemplateId | "unsure";

export type OnboardingRole = "creator" | "business" | "agency";

export type OnboardingTemplate = {
  id: TemplateId;
  /** Keywords the demo matches on. Lower case here; stored upper case after Go live. */
  demoKeywords: string[];
  /** Placeholder for the keyword field on "Set it up". Never prefilled — people type their own. */
  keywordPlaceholder: string;
  /** Short label used in headings, e.g. "Start with a GUIDE automation". */
  displayKeyword: string;
  /** Caption on the demo's sample post. */
  demoCaption: string;
  /** Placeholder in the demo's comment box. */
  demoInputPlaceholder: string;
  /** The public reply posted under the commenter's comment. */
  publicReply: string;
  /** The DM body. */
  dmMessage: string;
  /** The DM button label. */
  dmButtonLabel: string;
  /** Fills "…they get {what} in their DMs." */
  whatTheyGet: string;
  /** The card body on Home. Written out rather than templated — the prices one reads differently. */
  suggestionBody: string;
  /** Nudge shown when a comment did not match, on the demo. */
  demoMissHint: string;
};

export const TEMPLATES: Record<TemplateId, OnboardingTemplate> = {
  link: {
    id: "link",
    demoKeywords: ["link"],
    keywordPlaceholder: "LINK",
    displayKeyword: "LINK",
    demoCaption: "Comment LINK and I'll send you the shop link 👇",
    demoInputPlaceholder: "Type LINK",
    publicReply: "Sent you the link 📩",
    dmMessage: "Here's the link you asked for 👇",
    dmButtonLabel: "Shop now",
    whatTheyGet: "your link",
    suggestionBody: "When someone comments LINK, they get your link in their DMs.",
    demoMissHint: "That didn't match LINK, so nothing was sent. Only your keyword triggers it.",
  },
  resource: {
    id: "resource",
    demoKeywords: ["guide"],
    keywordPlaceholder: "GUIDE",
    displayKeyword: "GUIDE",
    demoCaption: "Comment GUIDE and I'll send you my free checklist 👇",
    demoInputPlaceholder: "Type GUIDE",
    publicReply: "Check your DMs 📩",
    dmMessage: "Here's your free guide, enjoy! 👇",
    dmButtonLabel: "Get the guide",
    whatTheyGet: "your guide",
    suggestionBody: "When someone comments GUIDE, they get your guide in their DMs.",
    demoMissHint: "That didn't match GUIDE, so nothing was sent. Only your keyword triggers it.",
  },
  code: {
    id: "code",
    demoKeywords: ["code"],
    keywordPlaceholder: "CODE",
    displayKeyword: "CODE",
    demoCaption: "Comment CODE for 10% off the new drop 👇",
    demoInputPlaceholder: "Type CODE",
    publicReply: "Your code is in your DMs 📩",
    dmMessage: "Your code: SAVE10. Use it at checkout 👇",
    dmButtonLabel: "Use my code",
    whatTheyGet: "your code",
    suggestionBody: "When someone comments CODE, they get your code in their DMs.",
    demoMissHint: "That didn't match CODE, so nothing was sent. Only your keyword triggers it.",
  },
  prices: {
    /**
     * The odd one out, in three ways, all of which the screens have to respect:
     *
     * - four keywords rather than one, because "price" and "prices" are separate keywords — the
     *   matcher does whole-word matching and does not stem plurals;
     * - a caption with **no keyword instruction**, because the whole point is answering the
     *   "how much?" comments people already leave; and
     * - a prompt rather than an echo in the input placeholder.
     */
    id: "prices",
    demoKeywords: ["price", "prices", "cost", "how much"],
    keywordPlaceholder: "price, cost, how much",
    displayKeyword: "PRICE",
    demoCaption: "New drop is live 🔥",
    demoInputPlaceholder: "Ask how much it is",
    publicReply: "Just DMed you the details 📩",
    dmMessage: "Thanks for asking! Here are the prices and how to order 👇",
    dmButtonLabel: "See prices",
    whatTheyGet: "the prices",
    suggestionBody: "When someone asks about the price, they get the details in their DMs.",
    demoMissHint: "Nothing was sent. Try asking about the price.",
  },
};

export type GoalOption = {
  goal: OnboardingGoal;
  title: string;
  subtitle: string;
};

const GOAL_COPY: Record<OnboardingGoal, Omit<GoalOption, "goal">> = {
  link: { title: "A link to buy", subtitle: "Shop, product, or booking link" },
  resource: { title: "A free resource", subtitle: "Guide, PDF, checklist, or playlist" },
  code: { title: "A discount code", subtitle: "A code plus a link to use it" },
  prices: { title: "Prices or details", subtitle: 'Answer the "how much?" comments for you' },
  unsure: { title: "Not sure yet", subtitle: "We'll show you a popular one" },
};

/**
 * Screen 2's option order, by the role chosen on screen 1.
 *
 * The only thing screen 1's answer changes on screen 2 — it reorders, it never filters. Someone
 * who says "my own account" can still pick "a link to buy"; it just is not the first thing they
 * read. A skipped screen 1 uses the business ordering, which is what `null` resolves to below.
 */
const GOAL_ORDER: Record<OnboardingRole | "default", OnboardingGoal[]> = {
  creator: ["resource", "link", "code", "prices", "unsure"],
  business: ["link", "prices", "code", "resource", "unsure"],
  agency: ["link", "resource", "prices", "code", "unsure"],
  default: ["link", "prices", "code", "resource", "unsure"],
};

export function goalOptionsForRole(role: OnboardingRole | null): GoalOption[] {
  return (GOAL_ORDER[role ?? "default"] ?? GOAL_ORDER.default).map((goal) => ({
    goal,
    ...GOAL_COPY[goal],
  }));
}

/**
 * The template a goal resolves to.
 *
 * `unsure` — and a skipped screen 2, which stores `goal: null` — both land on `resource`. That is
 * the "popular one" the copy promises, and it is the template whose demo reads best without any
 * context: a free guide needs no shop, no discount and no price list to make sense.
 */
export function templateForGoal(goal: OnboardingGoal | null | undefined): OnboardingTemplate {
  if (goal && goal !== "unsure" && goal in TEMPLATES) {
    return TEMPLATES[goal as TemplateId];
  }
  return TEMPLATES.resource;
}

export function templateById(id: TemplateId | null | undefined): OnboardingTemplate {
  return id && id in TEMPLATES ? TEMPLATES[id] : TEMPLATES.resource;
}
