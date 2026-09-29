import { describe, expect, it } from "vitest";
import type { ChatbotTemplateSummary } from "@/lib/api/chatbot-api";
import { ALL_CATEGORIES, categoryChips, missingCapabilities, searchTemplates } from "./template-search";

const t = (over: Partial<ChatbotTemplateSummary>): ChatbotTemplateSummary => ({
  id: over.key ?? "x",
  key: "x",
  icon: "💬",
  name: "Template",
  description: "Does a thing",
  stepCount: 3,
  gated: true,
  categoryKey: "retail-ecommerce",
  categoryLabel: "Retail & Ecommerce",
  keywords: [],
  featured: false,
  requiredCapabilities: [],
  ...over,
});

const pricing = t({ key: "pricing", name: "Pricing questions", keywords: ["plans", "cost"], description: "Walk people through your plans" });
const discount = t({ key: "discount", name: "Discount code", keywords: ["coupon", "promo"], requiredCapabilities: ["chatbot:conditions", "chatbot:tags"] });
const collab = t({ key: "collab", name: "Collab requests", keywords: ["brand deal"], categoryKey: "creators-agencies", categoryLabel: "Creators & Agencies" });
const facial = t({ key: "facial", name: "Book a facial", keywords: ["esthétique"], categoryKey: "beauty-aesthetics", categoryLabel: "Beauty & Aesthetics" });
const all = [pricing, discount, collab, facial];
const q = (query: string, category = ALL_CATEGORIES) => searchTemplates(all, { query, category }).map((x) => x.key);

describe("searchTemplates", () => {
  it("everything when empty", () => expect(q("")).toEqual(["pricing", "discount", "collab", "facial"]));
  it("matches the name", () => expect(q("collab")).toEqual(["collab"]));
  it("matches keywords, not just the name", () => expect(q("coupon")).toEqual(["discount"]));
  it("matches the use case / category", () => expect(q("creators")).toEqual(["collab"]));
  it("matches the description", () => expect(q("walk people")).toEqual(["pricing"]));
  it("ignores case and accents", () => {
    expect(q("PRICING")).toEqual(["pricing"]);
    expect(q("esthetique")).toEqual(["facial"]);
  });
  it("every word must match somewhere", () => {
    expect(q("retail coupon")).toEqual(["discount"]);
    expect(q("retail brand")).toEqual([]);
  });
  it("filters by category, and combines with search", () => {
    expect(q("", "creators-agencies")).toEqual(["collab"]);
    expect(q("plans", "creators-agencies")).toEqual([]);
  });
});

describe("categoryChips", () => {
  const cats = [
    { key: "beauty-aesthetics", label: "Beauty & Aesthetics" },
    { key: "real-estate", label: "Real Estate" },
    { key: "retail-ecommerce", label: "Retail & Ecommerce" },
    { key: "creators-agencies", label: "Creators & Agencies" },
  ];
  it("All first, then only categories with a template, in the server's order", () => {
    expect(categoryChips(cats, all).map((c) => c.label)).toEqual(["All", "Beauty & Aesthetics", "Retail & Ecommerce", "Creators & Agencies"]);
  });
  it("a template in a new category brings its chip; an emptied one loses it", () => {
    expect(categoryChips(cats, [...all, t({ key: "house", categoryKey: "real-estate" })]).map((c) => c.key)).toContain("real-estate");
    expect(categoryChips(cats, [pricing]).map((c) => c.key)).toEqual([ALL_CATEGORIES, "retail-ecommerce"]);
  });
});

describe("missingCapabilities", () => {
  it("lists what the plan lacks, by capability suffix", () => {
    expect(missingCapabilities(discount, { conditions: true, tags: false })).toEqual(["chatbot:tags"]);
    expect(missingCapabilities(discount, { conditions: true, tags: true })).toEqual([]);
    expect(missingCapabilities(pricing, {})).toEqual([]);
  });
});
