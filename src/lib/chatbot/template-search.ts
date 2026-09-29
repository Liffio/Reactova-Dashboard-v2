import type { ChatbotTemplateCategory, ChatbotTemplateSummary } from "@/lib/api/chatbot-api";

/**
 * The New chatbot picker's search and category filter.
 *
 * Search matches a template's name, keywords, category (its use case / industry) and description,
 * ignoring case and accents; every word typed must match somewhere, so "salon promo" narrows rather
 * than widens. Categories are data from the server: the chip row is "All" plus each category that
 * has a template, in the server's order, so a template in a new category brings its chip with it.
 */

export const ALL_CATEGORIES = "all";

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const haystack = (t: ChatbotTemplateSummary) =>
  fold([t.name, t.categoryLabel ?? "", t.description, ...t.keywords].join(" "));

export function searchTemplates(
  templates: ChatbotTemplateSummary[],
  { query, category }: { query: string; category: string },
): ChatbotTemplateSummary[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  return templates.filter(
    (t) =>
      (category === ALL_CATEGORIES || t.categoryKey === category) &&
      words.every((w) => haystack(t).includes(w)),
  );
}

/** "All", then the categories that have at least one template, in the server's order. */
export function categoryChips(
  categories: ChatbotTemplateCategory[],
  templates: ChatbotTemplateSummary[],
): ChatbotTemplateCategory[] {
  const used = new Set(templates.map((t) => t.categoryKey));
  return [{ key: ALL_CATEGORIES, label: "All" }, ...categories.filter((c) => used.has(c.key))];
}

/** The capabilities a template uses that this workspace's plan lacks (`features` keyed by suffix). */
export function missingCapabilities(
  t: Pick<ChatbotTemplateSummary, "requiredCapabilities">,
  features: Record<string, boolean | undefined>,
): string[] {
  return t.requiredCapabilities.filter((c) => !features[c.replace(/^chatbot:/, "")]);
}
