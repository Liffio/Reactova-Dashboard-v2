/**
 * Every field of the inline `automation` object on a scheduled post, as the API accepts it.
 *
 * ## Why this is data rather than markup
 *
 * Run 5 documented these fields and the docs still looked wrong, because the text went into a new
 * section further down the page while "Schedule a post", the section that introduces the endpoint
 * and shows the example people copy, kept its original three-field snippet. Prose in two places
 * drifts; a list rendered once cannot.
 *
 * It is also what the drift check reads. `api-docs-fields.test.ts` compares these names against the
 * field list of `Backend/src/api/schemas/scheduledPostAutomation.schema.ts`, so a field added to
 * the schema and not to this array fails a test rather than quietly going undocumented.
 *
 * **Names must be exactly the ones the API takes.** The follow gate is `followBeforeDm`, not
 * `askToFollow`, whatever the UI calls it.
 */
export type AutomationFieldDoc = {
  name: string;
  type: string;
  required: string;
  /** What the server uses when the field is absent. "none" when absent means absent. */
  fallback: string;
  notes: string;
};

export const SCHEDULED_POST_AUTOMATION_FIELDS: AutomationFieldDoc[] = [
  {
    name: "enabled",
    type: "boolean",
    required: "no",
    fallback: "false",
    notes: "Must be true or no automation is created, whatever else you send.",
  },
  {
    name: "templateAutomationId",
    type: "string or null",
    required: "no",
    fallback: "none",
    notes: "An existing automation to take unset values from. 404 if it is not in this workspace.",
  },
  {
    name: "name",
    type: "string",
    required: "no",
    fallback: '"Automation for <type> post"',
    notes: "Shown on the automations page.",
  },
  {
    name: "keywords",
    type: "string[]",
    required: "yes, unless anyComment is true or triggerBlocks is sent",
    fallback: "[]",
    notes: "Uppercased and de-duplicated. Comments containing one of these trigger the DM.",
  },
  {
    name: "excludedKeywords",
    type: "string[]",
    required: "no",
    fallback: "none",
    notes: "A comment containing any of these never triggers, even if it also matches a keyword.",
  },
  {
    name: "anyComment",
    type: "boolean",
    required: "no",
    fallback: "false",
    notes: "When true every comment triggers and keywords are ignored.",
  },
  {
    name: "triggerBlocks",
    type: "object[]",
    required: "no",
    fallback: "built from keywords and dmMessage",
    notes:
      "Per-keyword flows. Each block takes keyword, dmMessage, autoReply, replyMessage, " +
      "replyMessages, dmButtonLabel, dmButtonUrl, followBeforeDm. Every block needs a keyword " +
      "(unless anyComment) and a dmMessage.",
  },
  {
    name: "dmMessage",
    type: "string",
    required: "yes, unless triggerBlocks carries one per block",
    fallback: "none",
    notes: "The DM sent when the automation triggers.",
  },
  {
    name: "autoReply",
    type: "boolean",
    required: "no",
    fallback: "false",
    notes:
      "Posts a public reply as well as the DM. Needs a non-empty replyMessages, or no reply is " +
      "posted and the request still succeeds.",
  },
  {
    name: "replyMessages",
    type: "string[]",
    required: "no",
    fallback: "[]",
    notes: "Rotated across so repeat commenters do not see the same public reply.",
  },
  {
    name: "dmButtonLabel",
    type: "string",
    required: "no",
    fallback: "none",
    notes: "Ignored without dmButtonUrl.",
  },
  {
    name: "dmButtonUrl",
    type: "string (URL)",
    required: "no",
    fallback: "none",
    notes: "Must be a valid absolute URL. Wrapped in a tracked link when your package allows it.",
  },
  {
    name: "followBeforeDm",
    type: "boolean",
    required: "no",
    fallback: "false",
    notes:
      "The link is delivered only after the commenter follows the account. This is the field " +
      "name, whatever the app calls the control.",
  },
  {
    name: "followUps",
    type: "object[]",
    required: "no",
    fallback: "none",
    notes:
      "Max 10. Each takes delayMinutes (1 to 43200), message (1 to 2000 characters) and an " +
      "optional order. Your plan's follow-up cap applies on top.",
  },
  {
    name: "brandingEnabled",
    type: "boolean",
    required: "no",
    fallback: "follows your package",
    notes:
      "false removes the Liffio line from the DM and needs the automation:branding_control " +
      "capability. Without it the request is refused, never silently saved as true.",
  },
];
