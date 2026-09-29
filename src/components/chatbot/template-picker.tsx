import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlanChip, useUpgradeSheet } from "@/components/chatbot/upgrade";
import type { ChatbotTemplateCategory, ChatbotTemplateSummary } from "@/lib/api/chatbot-api";
import {
  ALL_CATEGORIES,
  categoryChips,
  missingCapabilities,
  searchTemplates,
} from "@/lib/chatbot/template-search";
import { cn } from "@/lib/utils";

/**
 * New chatbot: "Start blank" first (the most-used option), then the template library with search,
 * industry chips and a grid that stays scannable at 30+ templates.
 *
 * Without `chatbot:templates` a template card is locked and opens the upgrade sheet. With it, a
 * template that uses features the plan lacks still installs (as a draft); its card shows the chip
 * for what going live will need.
 */
export function TemplatePicker({
  open,
  onOpenChange,
  templates,
  categories,
  features,
  pending,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Everything the server listed, "Start blank" included (it is shown on its own, first). */
  templates: ChatbotTemplateSummary[];
  categories: ChatbotTemplateCategory[];
  features: Record<string, boolean | undefined>;
  pending: boolean;
  onPick: (template: ChatbotTemplateSummary) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const openUpgrade = useUpgradeSheet();

  const blank = templates.find((t) => t.key === "blank");
  const library = useMemo(() => templates.filter((t) => t.key !== "blank"), [templates]);
  const chips = useMemo(() => categoryChips(categories, library), [categories, library]);
  const results = useMemo(
    () => searchTemplates(library, { query, category }),
    [library, query, category],
  );
  const filtered = query.trim() !== "" || category !== ALL_CATEGORIES;
  const clear = () => {
    setQuery("");
    setCategory(ALL_CATEGORIES);
  };
  const categoryLabel = chips.find((c) => c.key === category)?.label;

  const startBlank = () => blank && onPick(blank);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) clear();
        onOpenChange(o);
      }}
    >
      <DialogContent className="flex max-h-[88vh] max-w-3xl flex-col gap-4">
        <DialogHeader>
          <DialogTitle>New chatbot</DialogTitle>
          <DialogDescription>Start blank, or pick a template and make it yours.</DialogDescription>
        </DialogHeader>

        {blank && (
          <button
            type="button"
            disabled={pending}
            onClick={startBlank}
            className="flex items-center gap-3 rounded-[14px] border-2 border-dashed border-border bg-background p-3.5 text-left hover:border-primary disabled:opacity-50"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-xl">
              {blank.icon}
            </span>
            <span className="min-w-0">
              <b className="block font-display text-sm">{blank.name}</b>
              <span className="block text-xs text-muted-foreground">{blank.description}</span>
            </span>
          </button>
        )}

        {library.length > 0 && (
          <>
            <div className="flex flex-col gap-2.5">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search templates"
                  aria-label="Search templates"
                  className="pl-9"
                />
              </div>
              {chips.length > 2 && (
                <div
                  className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
                  role="group"
                  aria-label="Filter by category"
                >
                  {chips.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      aria-pressed={category === c.key}
                      onClick={() => setCategory(c.key)}
                      className={cn(
                        "shrink-0 rounded-full border px-3 py-1 text-xs whitespace-nowrap transition-colors",
                        category === c.key
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2">
              {results.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-[14px] border border-dashed border-border px-4 py-10 text-center">
                  <p className="text-sm">
                    {query.trim()
                      ? `No templates match “${query.trim()}”${category !== ALL_CATEGORIES ? ` in ${categoryLabel}` : ""}.`
                      : `No templates in ${categoryLabel} yet.`}
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {blank && (
                      <Button size="sm" onClick={startBlank} disabled={pending}>
                        Start blank
                      </Button>
                    )}
                    {filtered && (
                      <Button size="sm" variant="outline" onClick={clear}>
                        Clear search
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {results.map((t) => {
                    const locked = t.gated && !features.templates;
                    const needs = locked ? [] : missingCapabilities(t, features);
                    return (
                      <button
                        key={t.id ?? t.key}
                        type="button"
                        disabled={pending}
                        title={
                          needs.length ? "Some steps need a higher plan to go live" : undefined
                        }
                        onClick={() =>
                          locked
                            ? openUpgrade({
                                capability: "chatbot:templates",
                                feature: `The ${t.name} template`,
                              })
                            : onPick(t)
                        }
                        className="relative flex min-w-0 flex-col gap-1 rounded-[14px] border border-border bg-background p-3.5 text-left hover:border-primary disabled:opacity-50"
                      >
                        {(locked || needs.length > 0) && (
                          <PlanChip
                            capability={locked ? "chatbot:templates" : needs[0]}
                            className="absolute top-2.5 right-2.5"
                          />
                        )}
                        <i className={cn("text-xl not-italic", locked && "opacity-60")}>{t.icon}</i>
                        <b className="truncate pr-16 font-display text-sm">{t.name}</b>
                        <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                          {t.categoryLabel && <span className="truncate">{t.categoryLabel}</span>}
                          {t.categoryLabel && <span aria-hidden>·</span>}
                          <span className="shrink-0">
                            {t.stepCount} step{t.stepCount === 1 ? "" : "s"}
                          </span>
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {t.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
