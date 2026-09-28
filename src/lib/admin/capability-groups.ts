/**
 * Package Management: capabilities shown in named groups rather than one flat list, for modules
 * with many of them (liffio-chatbot-gating-ui.html §6). A group's checkbox sets every capability
 * inside it. A capability not listed in any group still appears, under "Other", so adding a scope on
 * the server can never hide it from the package editor.
 */
export interface CapabilityGroup {
  name: string;
  sub: string;
  /** Full capability keys, `module:action`. */
  keys: string[];
}

export const CAPABILITY_GROUPS: Record<string, CapabilityGroup[]> = {
  chatbot: [
    { name: "Core", sub: "every plan", keys: ["chatbot:go_live", "chatbot:contacts_manage"] },
    {
      name: "Richer messages",
      sub: "the Starter ladder",
      keys: [
        "chatbot:media_messages",
        "chatbot:link_buttons",
        "chatbot:tags",
        "chatbot:questions",
        "chatbot:follow_ups",
        "chatbot:analytics",
        "chatbot:from_comment",
        "chatbot:branding_control",
      ],
    },
    {
      name: "Smart flows",
      sub: "branching and logic",
      keys: [
        "chatbot:conditions",
        "chatbot:chain_bots",
        "chatbot:personalization",
        "chatbot:business_hours",
        "chatbot:templates",
      ],
    },
    {
      name: "Reach",
      sub: "more ways in",
      keys: ["chatbot:story_triggers", "chatbot:ice_breakers", "chatbot:default_reply"],
    },
    {
      name: "Business tools",
      sub: "data out and routing",
      keys: [
        "chatbot:lead_capture",
        "chatbot:webhook_step",
        "chatbot:notify_step",
        "chatbot:handover_routing",
        "chatbot:ab_testing",
      ],
    },
  ],
};

/** A module's children split into its groups, with anything ungrouped under "Other". */
export function groupChildren<T extends { key: string }>(
  parentKey: string,
  children: T[],
): Array<{ group: CapabilityGroup; children: T[] }> | null {
  const groups = CAPABILITY_GROUPS[parentKey];
  if (!groups) return null;
  const placed = new Set<string>();
  const out = groups
    .map((group) => {
      const inGroup = children.filter((c) => group.keys.includes(c.key));
      inGroup.forEach((c) => placed.add(c.key));
      return { group, children: inGroup };
    })
    .filter((g) => g.children.length > 0);
  const rest = children.filter((c) => !placed.has(c.key));
  if (rest.length)
    out.push({
      group: { name: "Other", sub: "not in a group yet", keys: rest.map((c) => c.key) },
      children: rest,
    });
  return out;
}
