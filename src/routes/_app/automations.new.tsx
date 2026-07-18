import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  CloudOff,
  Cloudy,
  Hash,
  Link2,
  Loader2,
  MessageSquare,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/page-header";
import { ProtectedRoute } from "@/components/auth/guards";
import { InstagramRequired } from "@/components/auth/instagram-required";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  createAutomation,
  getAutomationWizardData,
  type CreateAutomationInput,
} from "@/lib/api/automations-api";
import { useAutosave } from "@/hooks/use-autosave";
import { useApp } from "@/state/app-context";
import { LIMITS, urlError, lengthError } from "@/lib/validation";
import { KeywordSuggest } from "@/components/lyra/keyword-suggest";
import { DmMessageAssist } from "@/components/lyra/dm-message-assist";
import { AutomationCopilotPanel } from "@/components/lyra/automation-copilot-panel";
import { LyraHandoffToast } from "@/components/lyra/lyra-handoff-toast";
import { useLyraHandoffTheater, type TheaterStep } from "@/hooks/use-lyra-handoff-theater";
import {
  LYRA_HANDOFF_KEY,
  resolveAutomationHandoff,
  type LyraAutomationHandoff,
} from "@/lib/lyra-handoff";
import { getDraft } from "@/lib/api/drafts-api";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { LyraAutomationCopilotOutput, LyraAutomationDraftFields } from "@/lib/api/lyra-api";

export const Route = createFileRoute("/_app/automations/new")({
  head: () => ({ meta: [{ title: "New automation — Liffio" }] }),
  // `?lyraDraft=true` — arrival from the Ask AI drawer: load the Lyra handoff
  // and prefill the wizard with the step-by-step theater.
  validateSearch: (search: Record<string, unknown>): { lyraDraft?: boolean } => ({
    lyraDraft: search.lyraDraft === true || search.lyraDraft === "true" ? true : undefined,
  }),
  component: AutomationBuilderRoute,
});

function AutomationBuilderRoute() {
  return (
    <ProtectedRoute module="automation" action="create">
      <InstagramRequired feature="Automations">
        <AutomationBuilder />
      </InstagramRequired>
    </ProtectedRoute>
  );
}

type PostScope = "specific" | "any" | "next";

type FollowUpDraft = {
  id: string;
  delayMinutes: number;
  message: string;
};

type TriggerBlock = {
  id: string;
  keyword: string;
  autoReply: boolean;
  replyMessage: string;
  dmMessage: string;
  hasButton: boolean;
  dmButtonLabel: string;
  dmButtonUrl: string;
};

type BuilderForm = {
  name: string;
  postScope: PostScope;
  postId: string | null;
  anyComment: boolean;
  triggerBlocks: TriggerBlock[];
  followBeforeDm: boolean;
  followUps: FollowUpDraft[];
};

const DELAY_OPTIONS: Array<{ label: string; minutes: number }> = [
  { label: "1 hour", minutes: 60 },
  { label: "6 hours", minutes: 360 },
  { label: "1 day", minutes: 1440 },
  { label: "3 days", minutes: 4320 },
  { label: "7 days", minutes: 10080 },
];

const MAX_TRIGGER_BLOCKS = 20;

let triggerBlockSeq = 0;
function createTriggerBlock(overrides: Partial<TriggerBlock> = {}): TriggerBlock {
  triggerBlockSeq += 1;
  return {
    id: `tb-${Date.now()}-${triggerBlockSeq}`,
    keyword: "",
    autoReply: true,
    replyMessage: "",
    dmMessage: "",
    hasButton: false,
    dmButtonLabel: "",
    dmButtonUrl: "",
    ...overrides,
  };
}

const defaultForm: BuilderForm = {
  name: "New automation",
  postScope: "any",
  postId: null,
  anyComment: false,
  triggerBlocks: [
    createTriggerBlock({
      keyword: "GUIDE",
      replyMessage: "Sent! Check your DMs 💌",
      dmMessage: "Hi there! Appreciate your comment 🙌 Here's the link you asked for ⬇️",
      hasButton: true,
      dmButtonLabel: "Open link",
      dmButtonUrl: "https://",
    }),
  ],
  followBeforeDm: false,
  followUps: [],
};

function AutomationBuilder() {
  const navigate = useNavigate();
  const { current, user } = useApp();
  const workspaceId = current.id;
  const [highlightedFields, setHighlightedFields] = useState<Set<string>>(new Set());

  const [form, setForm] = useState<BuilderForm>(defaultForm);
  const [expandedBlockIds, setExpandedBlockIds] = useState<string[]>(
    defaultForm.triggerBlocks.map((b) => b.id),
  );
  const [restoredBannerDismissed, setRestoredBannerDismissed] = useState(false);
  const firstChangeRef = useRef(false);

  // Lyra handoff mode (?lyraDraft=true): the wizard runs against the separate
  // `lyra-handoff` draft slot so the user's own autosaved draft (key "new") is
  // never touched — accepting Lyra's draft and editing it autosaves into Lyra's
  // slot; declining flips the key back to "new" and normal restore takes over.
  const { lyraDraft } = Route.useSearch();
  const handoffMode = Boolean(lyraDraft);

  const autosave = useAutosave<BuilderForm>({
    workspaceId,
    module: "automation",
    draftKey: handoffMode ? LYRA_HANDOFF_KEY : "new",
  });

  const wizardData = useQuery({
    queryKey: ["automation-wizard-data", workspaceId],
    queryFn: () => getAutomationWizardData(workspaceId),
    enabled: Boolean(workspaceId) && workspaceId !== "default",
    retry: false,
  });

  const update = (patch: Partial<BuilderForm>) => {
    firstChangeRef.current = true;
    setForm((prev) => {
      const next = { ...prev, ...patch };
      autosave.schedule(next);
      return next;
    });
  };

  // Offer to restore an existing DB draft once it loads (before any edits).
  const restoreDraft = () => {
    if (autosave.draft) {
      const restored = { ...defaultForm, ...autosave.draft.payload };
      setForm(restored);
      setExpandedBlockIds(restored.triggerBlocks.map((b) => b.id));
      setRestoredBannerDismissed(true);
      toast.success("Draft restored");
    }
  };

  const discardDraft = async () => {
    setRestoredBannerDismissed(true);
    await autosave.clear();
    toast.success("Draft discarded");
  };

  const showRestoreBanner =
    !handoffMode &&
    autosave.draftLoaded &&
    autosave.draft !== null &&
    !restoredBannerDismissed &&
    !firstChangeRef.current;

  // ── Lyra handoff arrival ────────────────────────────────────────────────────
  const theater = useLyraHandoffTheater();
  const [pendingHandoff, setPendingHandoff] = useState<LyraAutomationHandoff | null>(null);
  const [conflictOpen, setConflictOpen] = useState(false);
  const handoffConsumedRef = useRef(false);

  /** Plays Lyra's draft into the form step by step, reusing the copilot's
   *  highlight styling so each section glows as it lands. */
  const runHandoffTheater = (handoff: LyraAutomationHandoff) => {
    const d = handoff.draft;
    const blocks = (d.anyComment ? d.triggerBlocks.slice(0, 1) : d.triggerBlocks).map((b) =>
      createTriggerBlock({ ...b, keyword: d.anyComment ? "" : b.keyword.trim().toUpperCase() }),
    );

    const glow = (field: string) => setHighlightedFields((prev) => new Set(prev).add(field));
    const steps: TheaterStep[] = [];

    steps.push({
      label: `Naming it "${d.name || "New automation"}"`,
      apply: () => {
        update({ name: d.name || "New automation" });
        glow("name");
      },
    });
    steps.push({
      label:
        d.postScope === "any"
          ? "Listening on all your posts"
          : d.postScope === "next"
            ? "Listening on your next post"
            : "Listening on a post you'll pick",
      apply: () => {
        update({ postScope: d.postScope, anyComment: d.anyComment });
        glow("postScope");
        glow("anyComment");
      },
    });
    blocks.forEach((block, i) => {
      steps.push({
        label: d.anyComment
          ? "Writing the reply & DM"
          : `Adding the "${block.keyword || "keyword"}" trigger`,
        apply: () => {
          const next = blocks.slice(0, i + 1);
          update({ triggerBlocks: next });
          setExpandedBlockIds(next.map((b) => b.id));
          glow("triggerBlocks");
        },
      });
    });
    if (d.followBeforeDm) {
      steps.push({
        label: "Turning on the follow-first gate",
        apply: () => {
          update({ followBeforeDm: true });
          glow("followBeforeDm");
        },
      });
    }
    if (d.followUps.length > 0) {
      steps.push({
        label: `Adding ${d.followUps.length} follow-up message${d.followUps.length === 1 ? "" : "s"}`,
        apply: () => {
          update({
            followUps: d.followUps.map((f, i) => ({
              id: `fu-${Date.now()}-${i}`,
              delayMinutes: f.delayMinutes,
              message: f.message,
            })),
          });
          glow("followUps");
        },
      });
    }
    steps.push({ label: "Double-checking everything", apply: () => {} });

    theater.start(steps, {
      onDone: () => {
        window.setTimeout(() => setHighlightedFields(new Set()), 2500);
      },
    });
  };

  useEffect(() => {
    if (!handoffMode || !workspaceId || workspaceId === "default" || handoffConsumedRef.current) {
      return;
    }
    handoffConsumedRef.current = true;

    void resolveAutomationHandoff(workspaceId).then(async (resolution) => {
      if (resolution.kind === "none") {
        toast.error("Couldn't load Lyra's draft", {
          description: "It may have expired — ask Lyra to prepare it again.",
        });
        void navigate({ to: "/automations/new", search: {}, replace: true });
        return;
      }
      // Mid-review edits were autosaved into Lyra's slot — restore them silently.
      if (resolution.kind === "form") {
        const restored = { ...defaultForm, ...(resolution.form as Partial<BuilderForm>) };
        setForm(restored);
        setExpandedBlockIds(restored.triggerBlocks.map((b) => b.id));
        firstChangeRef.current = true;
        return;
      }
      // A genuine handoff: if the user has their own in-progress draft, ask
      // before showing Lyra's — their draft lives in its own slot and is safe
      // either way.
      const ownDraft = await getDraft(workspaceId, "automation", "new").catch(() => null);
      if (ownDraft) {
        setPendingHandoff(resolution.handoff);
        setConflictOpen(true);
        return;
      }
      runHandoffTheater(resolution.handoff);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoffMode, workspaceId]);

  const buildPayload = (status: "ACTIVE" | "DRAFT"): CreateAutomationInput => {
    const normalizedBlocks = form.triggerBlocks.map((block) => ({
      ...block,
      keyword: form.anyComment ? "" : block.keyword.trim().toUpperCase(),
    }));
    const primary = normalizedBlocks[0];
    return {
      name: form.name.trim() || "Untitled automation",
      keywords: form.anyComment ? [] : normalizedBlocks.map((b) => b.keyword).filter(Boolean),
      excludedKeywords: [],
      anyComment: form.anyComment,
      postScope: form.postScope,
      postId: form.postScope === "specific" ? form.postId : null,
      dmMessage: primary.dmMessage.trim(),
      autoReply: primary.autoReply,
      replyMessages:
        primary.autoReply && primary.replyMessage.trim() ? [primary.replyMessage.trim()] : [],
      dmButtonLabel: primary.hasButton ? primary.dmButtonLabel.trim() || undefined : undefined,
      dmButtonUrl: primary.hasButton ? primary.dmButtonUrl.trim() || undefined : undefined,
      followBeforeDm: form.followBeforeDm,
      followUps: form.followUps
        .filter((f) => f.message.trim())
        .map((f, i) => ({ delayMinutes: f.delayMinutes, message: f.message.trim(), order: i })),
      triggerBlocks: normalizedBlocks.map((block) => ({
        id: block.id,
        keyword: block.keyword,
        autoReply: block.autoReply,
        replyMessage: block.replyMessage.trim(),
        dmMessage: block.dmMessage.trim(),
        dmButtonLabel: block.hasButton ? block.dmButtonLabel.trim() || undefined : undefined,
        dmButtonUrl: block.hasButton ? block.dmButtonUrl.trim() || undefined : undefined,
      })),
      status,
    };
  };

  const publishMutation = useMutation({
    mutationFn: (status: "ACTIVE" | "DRAFT") => createAutomation(workspaceId, buildPayload(status)),
    onSuccess: async (_, status) => {
      await autosave.clear();
      toast.success(
        status === "ACTIVE" ? `"${form.name}" is live` : `"${form.name}" saved as draft`,
      );
      void navigate({ to: "/automations" });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const validate = (): string | null => {
    const nameErr = lengthError(form.name, "Automation name", LIMITS.automationName);
    if (nameErr) return nameErr;
    if (form.postScope === "specific" && !form.postId)
      return "Pick the post this automation listens on.";
    if (!form.anyComment) {
      if (form.triggerBlocks.length === 0) return "Add at least one keyword trigger.";
      const seen = new Set<string>();
      for (const [i, block] of form.triggerBlocks.entries()) {
        const kw = block.keyword.trim();
        if (!kw) return `Keyword trigger ${i + 1} needs a trigger word.`;
        const upper = kw.toUpperCase();
        if (seen.has(upper)) return `"${upper}" is used more than once — keywords must be unique.`;
        seen.add(upper);
      }
    }
    for (const [i, block] of form.triggerBlocks.entries()) {
      const label = form.anyComment ? "DM message" : `Keyword trigger ${i + 1}`;
      if (!block.dmMessage.trim()) return `${label}: write the DM message first.`;
      if (block.dmMessage.length > LIMITS.dmMessage.max)
        return `${label}: DM message must be ${LIMITS.dmMessage.max} characters or fewer.`;
      if (block.hasButton) {
        const labelErr = block.dmButtonLabel.trim()
          ? lengthError(block.dmButtonLabel, "Button label", { max: LIMITS.buttonLabel.max })
          : null;
        if (labelErr) return `${label}: ${labelErr}`;
        const btnUrlErr = urlError(block.dmButtonUrl, { max: LIMITS.buttonUrl.max });
        if (btnUrlErr) return `${label}: ${btnUrlErr}`;
      }
    }
    return null;
  };

  const submit = (status: "ACTIVE" | "DRAFT") => {
    const error = validate();
    if (error && status === "ACTIVE") {
      toast.error(error);
      return;
    }
    publishMutation.mutate(status);
  };

  const setAnyComment = (checked: boolean) => {
    if (checked) {
      const kept = { ...form.triggerBlocks[0], keyword: "" };
      update({ anyComment: true, triggerBlocks: [kept] });
      setExpandedBlockIds([kept.id]);
      return;
    }
    update({ anyComment: false });
  };

  const addTriggerBlock = () => {
    if (form.triggerBlocks.length >= MAX_TRIGGER_BLOCKS) {
      toast.error(`Up to ${MAX_TRIGGER_BLOCKS} keyword triggers per automation.`);
      return;
    }
    const block = createTriggerBlock();
    update({ triggerBlocks: [...form.triggerBlocks, block] });
    setExpandedBlockIds((ids) => [...ids, block.id]);
  };

  const removeTriggerBlock = (id: string) => {
    if (form.triggerBlocks.length <= 1) return;
    update({ triggerBlocks: form.triggerBlocks.filter((b) => b.id !== id) });
    setExpandedBlockIds((ids) => ids.filter((x) => x !== id));
  };

  const updateTriggerBlock = (id: string, patch: Partial<TriggerBlock>) => {
    update({
      triggerBlocks: form.triggerBlocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    });
  };

  // The co-pilot always echoes the full draft back (see AutomationCopilotTask's system
  // prompt), so only touch fields it actually says it changed this turn — otherwise an
  // untouched `triggerBlocks` echo could silently clobber ids/positions the user was
  // mid-edit on.
  const applyCopilotPatch = (patch: LyraAutomationCopilotOutput) => {
    const changed = new Set(patch.changedFields);
    const partial: Partial<BuilderForm> = {};
    if (changed.has("name")) partial.name = patch.name;
    if (changed.has("postScope")) partial.postScope = patch.postScope;
    if (changed.has("anyComment")) partial.anyComment = patch.anyComment;
    if (changed.has("followBeforeDm")) partial.followBeforeDm = patch.followBeforeDm;
    if (changed.has("followUps")) {
      partial.followUps = patch.followUps.map((f) => ({
        id: `fu-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        delayMinutes: f.delayMinutes,
        message: f.message,
      }));
    }
    if (changed.has("triggerBlocks")) {
      const nextBlocks = patch.triggerBlocks.map((b, i) => {
        const existing = form.triggerBlocks[i];
        return existing ? { ...existing, ...b } : createTriggerBlock(b);
      });
      partial.triggerBlocks = nextBlocks;
      setExpandedBlockIds(nextBlocks.map((b) => b.id));
    }

    if (Object.keys(partial).length > 0) update(partial);

    setHighlightedFields(new Set(patch.changedFields));
    window.setTimeout(() => setHighlightedFields(new Set()), 1500);
  };

  const currentDraftForCopilot: Partial<LyraAutomationDraftFields> = {
    name: form.name,
    postScope: form.postScope,
    anyComment: form.anyComment,
    followBeforeDm: form.followBeforeDm,
    triggerBlocks: form.triggerBlocks.map(({ id: _id, ...rest }) => rest),
    followUps: form.followUps.map((f) => ({ delayMinutes: f.delayMinutes, message: f.message })),
  };

  useEffect(() => {
    if (form.postScope === "specific" && !form.postId && wizardData.data?.media?.length) {
      update({ postId: wizardData.data.media[0].id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.postScope, wizardData.data?.media]);

  const autosaveBadge =
    autosave.status === "saving" || autosave.status === "pending" ? (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Saving draft…
      </span>
    ) : autosave.status === "saved" ? (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Cloudy className="h-3 w-3" /> Draft saved to cloud
      </span>
    ) : autosave.status === "error" ? (
      <span className="inline-flex items-center gap-1.5 text-xs text-destructive">
        <CloudOff className="h-3 w-3" /> Autosave failed — retrying on next change
      </span>
    ) : null;

  return (
    <div>
      <LyraHandoffToast
        visible={theater.visible}
        phase={theater.phase}
        steps={theater.steps}
        currentIndex={theater.currentIndex}
        title="Lyra is building your automation"
        doneTitle="All set — over to you ✨"
        doneMessage="Review every step, then hit Publish to make it live."
        onDismiss={theater.dismiss}
      />

      <Dialog
        open={conflictOpen}
        onOpenChange={(open) => {
          setConflictOpen(open);
          if (!open && pendingHandoff) {
            // Dismissing counts as "keep my draft" — never silently overwrite.
            setPendingHandoff(null);
            void navigate({ to: "/automations/new", search: {}, replace: true });
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Load Lyra's draft?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            You already have an automation draft in progress. Lyra's draft opens in its own slot —
            your draft stays saved either way.
          </p>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConflictOpen(false);
                setPendingHandoff(null);
                void navigate({ to: "/automations/new", search: {}, replace: true });
              }}
            >
              Keep my draft
            </Button>
            <Button
              type="button"
              onClick={() => {
                const handoff = pendingHandoff;
                setConflictOpen(false);
                setPendingHandoff(null);
                if (handoff) runHandoffTheater(handoff);
              }}
            >
              Load Lyra's draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PageHeader
        eyebrow="Automations"
        title="New automation"
        description="Comment triggers a DM — autosaved to your workspace as you type."
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link to="/automations">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => submit("DRAFT")}
              disabled={publishMutation.isPending}
            >
              <Check className="h-4 w-4" /> Save as draft
            </Button>
            <Button
              size="sm"
              onClick={() => submit("ACTIVE")}
              disabled={publishMutation.isPending}
              className="bg-brand-gradient text-primary-foreground shadow-glow hover:opacity-95"
            >
              {publishMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {publishMutation.isPending ? "Publishing…" : "Publish"}
            </Button>
          </>
        }
      />

      <div className="flex min-h-5 items-center gap-3 px-4 pt-4 text-xs sm:px-6 md:px-10">
        {autosaveBadge}
      </div>

      {showRestoreBanner && (
        <div className="mx-4 mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm sm:mx-6 md:mx-10">
          <RotateCcw className="h-4 w-4 shrink-0 text-primary" />
          <span className="flex-1">
            You have an unsaved draft from{" "}
            {new Date(autosave.draft!.updatedAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            . Restore it?
          </span>
          <div className="flex gap-2">
            <Button size="sm" onClick={restoreDraft}>
              Restore draft
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void discardDraft()}>
              Discard
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-6 p-4 sm:p-6 md:p-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <AutomationCopilotPanel
            workspaceId={workspaceId}
            userId={user?.id}
            currentDraft={currentDraftForCopilot}
            onApplyPatch={applyCopilotPatch}
          />

          {/* Basics */}
          <section
            className={cn(
              "rounded-2xl border bg-card p-5 shadow-soft transition-shadow",
              highlightedFields.has("name") && "ring-2 ring-primary/60 animate-pulse",
            )}
          >
            <div className="space-y-1.5">
              <Label htmlFor="name">Automation name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) =>
                  update({ name: e.target.value.slice(0, LIMITS.automationName.max) })
                }
                maxLength={LIMITS.automationName.max}
              />
            </div>
          </section>

          {/* Trigger */}
          <section
            className={cn(
              "space-y-4 rounded-2xl border bg-card p-5 shadow-soft transition-shadow",
              (highlightedFields.has("postScope") || highlightedFields.has("anyComment")) &&
                "ring-2 ring-primary/60 animate-pulse",
            )}
          >
            <SectionTitle
              icon={MessageSquare}
              title="Trigger"
              subtitle="Which comments start this automation?"
            />
            <div className="inline-flex w-full rounded-lg border bg-background p-1">
              {(
                [
                  { v: "any", l: "All posts" },
                  { v: "next", l: "Next post only" },
                  { v: "specific", l: "Pick a post" },
                ] as Array<{ v: PostScope; l: string }>
              ).map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => update({ postScope: o.v })}
                  className={cn(
                    "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    form.postScope === o.v
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {o.l}
                </button>
              ))}
            </div>

            {form.postScope === "specific" && (
              <>
                {wizardData.isLoading && (
                  <p className="text-xs text-muted-foreground">Loading your Instagram posts…</p>
                )}
                {wizardData.isError && (
                  <p className="text-xs text-destructive">{(wizardData.error as Error).message}</p>
                )}
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {(wizardData.data?.media ?? []).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => update({ postId: item.id })}
                      className={cn(
                        "relative aspect-square overflow-hidden rounded-lg border-2 bg-muted transition-all",
                        form.postId === item.id
                          ? "border-primary"
                          : "border-border hover:border-muted-foreground/50",
                      )}
                    >
                      {item.thumbnailUrl ? (
                        <img
                          src={item.thumbnailUrl}
                          alt={item.caption || "Instagram media"}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10" />
                      )}
                      {form.postId === item.id && (
                        <div className="absolute inset-0 flex items-center justify-center bg-primary/25">
                          <Check className="h-5 w-5 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Trigger on any comment</p>
                <p className="text-xs text-muted-foreground">
                  Skip keyword matching — every comment receives the DM.
                </p>
              </div>
              <Switch checked={form.anyComment} onCheckedChange={setAnyComment} />
            </div>
          </section>

          {/* Keyword triggers */}
          <section
            className={cn(
              "space-y-4 rounded-2xl border bg-card p-5 shadow-soft transition-shadow",
              highlightedFields.has("triggerBlocks") && "ring-2 ring-primary/60 animate-pulse",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <SectionTitle
                icon={Hash}
                title={form.anyComment ? "Reply & DM" : "Keyword triggers"}
                subtitle={
                  form.anyComment
                    ? "Every comment gets this reply and DM."
                    : "Each keyword gets its own reply, DM message, and button."
                }
              />
              {!form.anyComment && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0 border-dashed"
                  onClick={addTriggerBlock}
                >
                  <Plus className="h-3.5 w-3.5" /> Add keyword
                </Button>
              )}
            </div>

            {form.anyComment ? (
              <div className="rounded-xl border bg-background p-4">
                <TriggerBlockFields
                  block={form.triggerBlocks[0]}
                  showKeywordStep={false}
                  onChange={(patch) => updateTriggerBlock(form.triggerBlocks[0].id, patch)}
                />
              </div>
            ) : (
              <Accordion
                type="multiple"
                value={expandedBlockIds}
                onValueChange={setExpandedBlockIds}
                className="space-y-3"
              >
                {form.triggerBlocks.map((block, i) => (
                  <AccordionItem
                    key={block.id}
                    value={block.id}
                    className="rounded-xl border bg-background px-3.5"
                  >
                    <div className="flex items-center gap-2">
                      <AccordionTrigger className="py-3.5 hover:no-underline">
                        <span className="inline-flex items-center gap-2 text-left">
                          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-gradient px-1.5 text-[11px] font-semibold text-primary-foreground shadow-glow">
                            {i + 1}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 font-mono text-xs">
                            <Hash className="h-3 w-3 text-primary" />
                            {block.keyword || "New keyword"}
                          </span>
                        </span>
                      </AccordionTrigger>
                      {form.triggerBlocks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTriggerBlock(block.id)}
                          className="shrink-0 rounded-md p-1.5 text-[crimson] transition-colors hover:bg-[crimson]/10"
                          aria-label="Remove keyword trigger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <AccordionContent>
                      <TriggerBlockFields
                        block={block}
                        showKeywordStep
                        onChange={(patch) => updateTriggerBlock(block.id, patch)}
                      />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </section>

          {/* Follow gate + follow-ups */}
          <section
            className={cn(
              "space-y-4 rounded-2xl border bg-card p-5 shadow-soft transition-shadow",
              (highlightedFields.has("followBeforeDm") || highlightedFields.has("followUps")) &&
                "ring-2 ring-primary/60 animate-pulse",
            )}
          >
            <SectionTitle
              icon={ShieldCheck}
              title="Audience growth"
              subtitle="Ask for a follow first, then re-engage automatically."
            />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Ask to follow before DM</p>
                <p className="text-xs text-muted-foreground">
                  The link is delivered after they follow your account.
                </p>
              </div>
              <Switch
                checked={form.followBeforeDm}
                onCheckedChange={(v) => update({ followBeforeDm: v })}
              />
            </div>

            <Separator />

            <div>
              <p className="text-sm font-medium">Follow-up sequence</p>
              <p className="text-xs text-muted-foreground">
                Up to 10 timed follow-up DMs after the first message.
              </p>
            </div>
            <div className="space-y-3">
              {form.followUps.map((f, i) => (
                <div key={f.id} className="rounded-xl border bg-background p-3.5">
                  <div className="mb-2.5 flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="border-primary/30 bg-primary/10 text-primary"
                    >
                      Step {i + 1}
                    </Badge>
                    <span className="text-xs text-muted-foreground">Wait</span>
                    <Select
                      value={String(f.delayMinutes)}
                      onValueChange={(v) => {
                        const next = form.followUps.map((x) =>
                          x.id === f.id ? { ...x, delayMinutes: Number(v) } : x,
                        );
                        update({ followUps: next });
                      }}
                    >
                      <SelectTrigger className="h-7 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DELAY_OPTIONS.map((d) => (
                          <SelectItem key={d.minutes} value={String(d.minutes)}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button
                      type="button"
                      onClick={() =>
                        update({ followUps: form.followUps.filter((x) => x.id !== f.id) })
                      }
                      className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <Textarea
                    value={f.message}
                    onChange={(e) => {
                      const next = form.followUps.map((x) =>
                        x.id === f.id
                          ? { ...x, message: e.target.value.slice(0, LIMITS.followUpMessage.max) }
                          : x,
                      );
                      update({ followUps: next });
                    }}
                    maxLength={LIMITS.followUpMessage.max}
                    rows={2}
                    placeholder="Type your follow-up message…"
                  />
                </div>
              ))}
              {form.followUps.length < 10 && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-dashed"
                  onClick={() =>
                    update({
                      followUps: [
                        ...form.followUps,
                        { id: `f${Date.now()}`, delayMinutes: 1440, message: "" },
                      ],
                    })
                  }
                >
                  <Plus className="h-4 w-4" /> Add follow-up step
                </Button>
              )}
            </div>
          </section>
        </div>

        {/* Live DM preview */}
        <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          <DmPreview
            username={wizardData.data?.profile.username ?? current.igHandle ?? "yourbrand"}
            keyword={form.anyComment ? "any comment" : form.triggerBlocks[0]?.keyword || "KEYWORD"}
            message={form.triggerBlocks[0]?.dmMessage ?? ""}
            buttonLabel={
              form.triggerBlocks[0]?.hasButton ? form.triggerBlocks[0].dmButtonLabel : ""
            }
            buttonUrl={form.triggerBlocks[0]?.hasButton ? form.triggerBlocks[0].dmButtonUrl : ""}
            autoReply={form.triggerBlocks[0]?.autoReply ? form.triggerBlocks[0].replyMessage : ""}
            followBeforeDm={form.followBeforeDm}
            followUps={form.followUps}
          />
        </aside>
      </div>
    </div>
  );
}

function TimelineStep({
  index,
  title,
  last,
  children,
}: {
  index: number;
  title: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-gradient text-[11px] font-semibold text-primary-foreground shadow-glow">
          {index}
        </div>
        {!last && <div className="w-px flex-1 bg-border" />}
      </div>
      <div className={cn("flex-1 space-y-2", !last && "pb-5")}>
        <p className="text-xs font-semibold text-muted-foreground">{title}</p>
        {children}
      </div>
    </div>
  );
}

function TriggerBlockFields({
  block,
  showKeywordStep,
  onChange,
}: {
  block: TriggerBlock;
  showKeywordStep: boolean;
  onChange: (patch: Partial<TriggerBlock>) => void;
}) {
  let step = 1;
  const keywordStepIndex = showKeywordStep ? step++ : 0;
  const messageStepIndex = step++;
  const buttonStepIndex = step++;

  return (
    <div>
      {showKeywordStep && (
        <TimelineStep index={keywordStepIndex} title="Trigger keyword">
          <div className="flex items-center gap-2">
            <Input
              value={block.keyword}
              onChange={(e) =>
                onChange({ keyword: e.target.value.slice(0, LIMITS.keyword.max).toUpperCase() })
              }
              maxLength={LIMITS.keyword.max}
              placeholder="e.g. GUIDE"
              className="font-mono uppercase"
            />
            <KeywordSuggest
              sourceText={block.dmMessage}
              onPick={(kw) => onChange({ keyword: kw })}
              persistId={block.id}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Not case-sensitive. The comment must contain this word.
          </p>
        </TimelineStep>
      )}

      <TimelineStep index={messageStepIndex} title="Reply & DM message">
        <div className="flex items-center justify-between rounded-lg border bg-background px-3 py-2">
          <span className="text-xs font-medium">Public auto-reply on the comment</span>
          <Switch checked={block.autoReply} onCheckedChange={(v) => onChange({ autoReply: v })} />
        </div>
        {block.autoReply && (
          <div className="space-y-1">
            <div className="flex justify-end">
              <DmMessageAssist
                label="auto-reply"
                currentValue={block.replyMessage}
                keyword={block.keyword}
                onApply={(msg) => onChange({ replyMessage: msg.slice(0, LIMITS.replyMessage.max) })}
                persistId={block.id}
              />
            </div>
            <Textarea
              value={block.replyMessage}
              onChange={(e) =>
                onChange({ replyMessage: e.target.value.slice(0, LIMITS.replyMessage.max) })
              }
              maxLength={LIMITS.replyMessage.max}
              rows={2}
              className="resize-none"
              placeholder="Sent! Check your DMs 💌"
            />
          </div>
        )}
        <div className="space-y-1">
          <div className="flex justify-end">
            <DmMessageAssist
              label="DM message"
              currentValue={block.dmMessage}
              keyword={block.keyword}
              onApply={(msg) => onChange({ dmMessage: msg.slice(0, LIMITS.dmMessage.max) })}
              persistId={block.id}
            />
          </div>
          <Textarea
            value={block.dmMessage}
            onChange={(e) => onChange({ dmMessage: e.target.value.slice(0, LIMITS.dmMessage.max) })}
            maxLength={LIMITS.dmMessage.max}
            rows={4}
            placeholder="Hi there! Here's the resource you asked for…"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            Use {"{{name}}"} {"{{username}}"} {"{{keyword}}"} as variables
          </span>
          <span className="text-[10px] text-muted-foreground">
            {block.dmMessage.length}/{LIMITS.dmMessage.max}
          </span>
        </div>
      </TimelineStep>

      <TimelineStep index={buttonStepIndex} title="Button (optional)" last>
        <div className="flex items-center justify-between rounded-lg border bg-background px-3 py-2">
          <span className="text-xs font-medium">Attach a tappable button under the DM</span>
          <Switch checked={block.hasButton} onCheckedChange={(v) => onChange({ hasButton: v })} />
        </div>
        {block.hasButton && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Button label</Label>
              <Input
                value={block.dmButtonLabel}
                onChange={(e) =>
                  onChange({ dmButtonLabel: e.target.value.slice(0, LIMITS.buttonLabel.max) })
                }
                maxLength={LIMITS.buttonLabel.max}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Button URL</Label>
              <Input
                type="url"
                value={block.dmButtonUrl}
                onChange={(e) =>
                  onChange({ dmButtonUrl: e.target.value.slice(0, LIMITS.buttonUrl.max) })
                }
                maxLength={LIMITS.buttonUrl.max}
                placeholder="https://yourlink.com"
              />
              {block.dmButtonUrl && urlError(block.dmButtonUrl, { max: LIMITS.buttonUrl.max }) && (
                <p className="text-[11px] text-destructive">
                  {urlError(block.dmButtonUrl, { max: LIMITS.buttonUrl.max })}
                </p>
              )}
            </div>
          </div>
        )}
      </TimelineStep>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof MessageSquare;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-gradient text-primary-foreground shadow-glow">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h2 className="font-display text-lg font-semibold leading-tight">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function DmPreview({
  username,
  keyword,
  message,
  buttonLabel,
  buttonUrl,
  autoReply,
  followBeforeDm,
  followUps,
}: {
  username: string;
  keyword: string;
  message: string;
  buttonLabel: string;
  buttonUrl: string;
  autoReply: string;
  followBeforeDm: boolean;
  followUps: FollowUpDraft[];
}) {
  const handle = username.replace(/^@/, "");
  const delayLabel = (minutes: number) =>
    DELAY_OPTIONS.find((d) => d.minutes === minutes)?.label ?? `${minutes} min`;

  return (
    <div className="overflow-hidden rounded-[32px] border bg-gradient-to-b from-muted to-background p-2.5 shadow-soft">
      <div className="overflow-hidden rounded-[26px] bg-card">
        <div className="flex items-center justify-between px-5 pb-1 pt-3 text-[10px] font-semibold text-muted-foreground">
          <span>9:41</span>
          <span className="tracking-widest">●●● 5G</span>
        </div>
        <div className="flex items-center gap-3 border-b px-4 py-2.5">
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          <div className="h-8 w-8 rounded-full bg-brand-gradient ring-2 ring-background" />
          <div className="leading-tight">
            <div className="text-sm font-semibold">{handle}</div>
            <div className="text-[10px] text-muted-foreground">Active now · via Liffio</div>
          </div>
        </div>

        <div className="max-h-[540px] space-y-2.5 overflow-y-auto bg-gradient-to-b from-background to-card/40 px-3 py-4">
          <div className="mx-auto max-w-[88%] overflow-hidden rounded-2xl border bg-card">
            <div className="border-b px-3 py-1.5 text-[10px] font-semibold">{handle}</div>
            <div className="grid h-20 place-items-center bg-gradient-to-br from-primary/10 via-muted to-accent/30">
              <MessageSquare className="h-5 w-5 text-primary/70" />
            </div>
            <div className="border-t bg-muted/40 px-3 py-1.5 text-[10px] text-muted-foreground">
              <span className="font-semibold text-foreground">Nora</span> commented:{" "}
              <span className="rounded bg-primary/10 px-1 font-mono text-primary">{keyword}</span>
            </div>
          </div>

          {autoReply && (
            <div className="flex justify-start">
              <span className="max-w-[80%] rounded-full bg-muted px-2.5 py-1 text-[10px] text-muted-foreground">
                Public reply: "{autoReply}"
              </span>
            </div>
          )}

          {followBeforeDm && (
            <Bubble>Follow @{handle} first so I can DM you — tap Follow, then come back 💌</Bubble>
          )}

          <Bubble>
            {message || <span className="italic opacity-70">Your DM message appears here…</span>}
          </Bubble>

          {(buttonLabel || buttonUrl) && (
            <div className="flex justify-end">
              <div className="max-w-[80%] overflow-hidden rounded-2xl border bg-card shadow-sm">
                <div className="flex items-center justify-center bg-muted/60 px-4 py-4">
                  <Link2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="border-t px-3 py-2">
                  <div className="text-[11px] font-medium leading-tight">
                    {buttonLabel || "Button label"}
                  </div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {buttonUrl || "https://your-link.com"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {followUps.map((f, i) => (
            <div key={f.id} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  +{delayLabel(f.delayMinutes)} · step {i + 1}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <Bubble>
                {f.message || (
                  <span className="italic opacity-70">Follow-up #{i + 1} message…</span>
                )}
              </Bubble>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Bubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl bg-brand-gradient px-3.5 py-2 text-xs leading-relaxed text-primary-foreground shadow-sm">
        {children}
      </div>
    </div>
  );
}
