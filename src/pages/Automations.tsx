import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronUp, Eye, Heart, ImagePlus, Lock, MessageCircle, MoreHorizontal, Plus, Edit, Send, Trash2, Zap } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { useCan } from "@/hooks/useCan";
import { useBillingConfigQuery } from "@/hooks/useBilling";
import { useAppSelector } from "@/store/hooks";
import { apiRequest } from "@/lib/api";
import { followUpDelayFromApi, formatDurationLabel, parseDurationSeconds } from "@/lib/duration";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

type AutomationStatus = "ACTIVE" | "PAUSED" | "DRAFT";
type PostMode = "specific" | "any" | "next";

const POST_MODE_OPTIONS: Array<{
  value: PostMode;
  label: string;
  shortLabel: string;
  description: string;
  recommended?: boolean;
}> = [
  {
    value: "any",
    label: "Account template",
    shortLabel: "All posts",
    description:
      "One automation for your whole account — every existing reel/post and every new one you publish.",
    recommended: true
  },
  {
    value: "next",
    label: "New posts only",
    shortLabel: "Next",
    description: "Only reels/posts published after you save this automation (not older content)."
  },
  {
    value: "specific",
    label: "Single post",
    shortLabel: "One post",
    description: "Runs on one reel or post you pick."
  }
];
type Automation = {
  id: string;
  name: string;
  keywords: string[];
  excludedKeywords: string[];
  anyComment: boolean;
  postScope?: "SPECIFIC" | "ANY" | "NEXT";
  postId: string | null;
  dmMessage: string;
  dmButtonLabel: string | null;
  dmButtonUrl: string | null;
  autoReply: boolean;
  replyMessages: string[];
  triggerBlocks?: TriggerBlock[];
  followBeforeDm: boolean;
  followUps?: FollowUpStep[];
  status: AutomationStatus;
  createdAt: string;
  _count: { dmJobs: number };
};

type FollowUpStep = {
  id?: string;
  /** User-facing delay, e.g. 20s, 2m, 1h, 1d */
  delay: string;
  message: string;
  order: number;
};

type WizardData = {
  workspace?: { plan: string };
  media: Array<{
    id: string;
    caption: string;
    mediaType: string;
    thumbnailUrl: string | null;
    permalink: string | null;
  }>;
};

type AutomationForm = {
  name: string;
  keywords: string[];
  anyComment: boolean;
  autoReply: boolean;
  replyMessages: string[];
  dmMessage: string;
  dmButtonLabel: string;
  dmButtonUrl: string;
  followBeforeDm: boolean;
  status: AutomationStatus;
};

type TriggerBlock = {
  id: string;
  keyword: string;
  autoReply: boolean;
  replyMessage: string;
  dmMessage: string;
  dmButtonLabel: string;
  dmButtonUrl: string;
  followBeforeDm: boolean;
};

const defaultForm: AutomationForm = {
  name: "New Automation",
  keywords: ["GUIDE"],
  anyComment: false,
  autoReply: true,
  replyMessages: ["Sent! Check your DMs 💌", "On its way to your inbox ✨", "Just DM'd you the link 🔥"],
  dmMessage: "Hi there! Here's your link 👇",
  dmButtonLabel: "Open Link",
  dmButtonUrl: "",
  followBeforeDm: false,
  status: "ACTIVE"
};

const formatStatus = (status: AutomationStatus): "active" | "paused" | "draft" => status.toLowerCase() as "active" | "paused" | "draft";
const shortId = (value: string) => `${value.slice(0, 8)}...`;
const newBlockId = () => `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const normalizeClientButtonUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};
const keywordBlocksStorageKey = (workspaceId: string | null, automationId: string | null) =>
  `reactova_automation_keyword_blocks_${workspaceId ?? "none"}_${automationId ?? "create"}`;

const builderDraftStorageKey = (workspaceId: string | null, automationId: string | null) =>
  `reactova_automation_builder_draft_${workspaceId ?? "none"}_${automationId ?? "create"}`;

type AutomationBuilderDraft = {
  name: string;
  status: AutomationStatus;
  anyComment: boolean;
  postMode: PostMode;
  selectedPostId: string | null;
  step: number;
  maxCompletedStep: number;
  triggerBlocks: TriggerBlock[];
  expandedBlockIds: string[];
  previewBlockId: string;
  followUps?: FollowUpStep[];
};

const FREE_TIER_FOLLOW_UP_PREVIEW = `Hey there 👋 Just sharing this in case you want to use the same tools I do.

SuperProfile is my all-in-one platform for Instagram Automations and selling my digital products. Tap on the button below to check it out!`;

const defaultFollowUpStep = (order: number): FollowUpStep => ({
  delay: "1h",
  message: "Thanks again for commenting! Here's a quick reminder 👇",
  order
});

const readBuilderDraft = (key: string): AutomationBuilderDraft | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AutomationBuilderDraft;
    if (!parsed || !Array.isArray(parsed.triggerBlocks) || parsed.triggerBlocks.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeBuilderDraft = (key: string, draft: AutomationBuilderDraft) => {
  localStorage.setItem(key, JSON.stringify(draft));
};

const clearBuilderDraft = (key: string) => {
  localStorage.removeItem(key);
};

const resolvePostMode = (initial: Automation | null): PostMode => {
  if (!initial) return "any";
  if (initial.postScope === "NEXT") return "next";
  if (initial.postScope === "ANY") return "any";
  if (initial.postScope === "SPECIFIC" || initial.postId) return "specific";
  return "any";
};

const buildInitialTriggerBlocks = (initial: Automation | null): TriggerBlock[] => {
  if (!initial) return [createTriggerBlock()];
  if (initial.triggerBlocks?.length) {
    return initial.triggerBlocks.map((block, index) =>
      createTriggerBlock({ ...block, id: block.id || `initial-${index}` })
    );
  }
  const keywords = initial.anyComment ? [""] : initial.keywords.length ? initial.keywords : defaultForm.keywords;
  return keywords.map((keyword, index) =>
    createTriggerBlock({
      id: `initial-${index}`,
      keyword,
      autoReply: initial.autoReply,
      replyMessage: initial.replyMessages[index] ?? initial.replyMessages[0] ?? defaultForm.replyMessages[0],
      dmMessage: initial.dmMessage,
      dmButtonLabel: initial.dmButtonLabel ?? "",
      dmButtonUrl: initial.dmButtonUrl ?? "",
      followBeforeDm: initial.followBeforeDm
    })
  );
};

const readKeywordBlocksBackup = (key: string): TriggerBlock[] | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TriggerBlock[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
};

const blockDisplayTitle = (block: TriggerBlock, anyComment: boolean) => {
  if (anyComment) return "Any comment";
  const keyword = block.keyword.trim();
  return keyword ? keyword.toUpperCase() : "New trigger";
};

const createTriggerBlock = (overrides: Partial<TriggerBlock> = {}): TriggerBlock => ({
  id: overrides.id ?? newBlockId(),
  keyword: overrides.keyword ?? "GUIDE",
  autoReply: overrides.autoReply ?? defaultForm.autoReply,
  replyMessage: overrides.replyMessage ?? defaultForm.replyMessages[0],
  dmMessage: overrides.dmMessage ?? defaultForm.dmMessage,
  dmButtonLabel: overrides.dmButtonLabel ?? defaultForm.dmButtonLabel,
  dmButtonUrl: overrides.dmButtonUrl ?? defaultForm.dmButtonUrl,
  followBeforeDm: overrides.followBeforeDm ?? defaultForm.followBeforeDm
});

export default function Automations() {
  const workspaceId = useAppSelector((state) => state.auth.workspaceId);
  const [editing, setEditing] = useState<Automation | null>(null);
  const [open, setOpen] = useState(false);
  const canCreate = useCan("automation", "create");
  const canUpdate = useCan("automation", "update");
  const canDelete = useCan("automation", "delete");
  const queryClient = useQueryClient();

  const automationsQuery = useQuery({
    queryKey: ["automations", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => apiRequest<Automation[]>("/api/v1/automations", { workspaceId: workspaceId ?? undefined })
  });

  const deleteMutation = useMutation({
    mutationFn: async (automationId: string) =>
      apiRequest<void>(`/api/v1/automations/${automationId}`, { method: "DELETE", workspaceId: workspaceId ?? undefined }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["automations", workspaceId] });
      toast.success("Automation deleted");
    },
    onError: (error) => toast.error((error as Error).message)
  });

  const items = useMemo(() => automationsQuery.data ?? [], [automationsQuery.data]);

  const wizardDataQuery = useQuery({
    queryKey: ["automation-wizard-data", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => apiRequest<WizardData>("/api/v1/automations/wizard-data", { workspaceId: workspaceId ?? undefined })
  });

  const mediaById = useMemo(
    () => new Map((wizardDataQuery.data?.media ?? []).map((item) => [item.id, item])),
    [wizardDataQuery.data?.media]
  );

  if (open) {
    return (
      <AutomationBuilder
        workspaceId={workspaceId}
        mode={editing ? "edit" : "create"}
        initial={editing}
        wizardData={wizardDataQuery.data}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        onSaved={async () => {
          await queryClient.invalidateQueries({ queryKey: ["automations", workspaceId] });
          setOpen(false);
          setEditing(null);
        }}
      />
    );
  }

  return (
    <DashboardLayout title="Automations" subtitle="Convert comments, story replies, and shared reels into DMs on autopilot.">
      <div className="flex justify-end -mt-2">
        <Button
          variant="accent"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          disabled={!canCreate}
        >
          <Plus className="h-4 w-4" /> Create New Automation
        </Button>
      </div>

      {automationsQuery.isLoading && (
        <section className="rounded-xl bg-card border border-border p-6 text-sm text-muted-foreground">
          Loading automations...
        </section>
      )}

      {automationsQuery.isError && (
        <section className="rounded-xl bg-card border border-destructive/30 p-6 text-sm text-destructive">
          {(automationsQuery.error as Error).message}
        </section>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="No automations yet"
          description="Create your first automation to start converting Instagram engagement into DMs"
          ctaLabel={canCreate ? "Create Automation" : "No permission to create"}
          onCta={() => {
            if (canCreate) setOpen(true);
          }}
        />
      ) : (
        <section className="rounded-xl bg-card border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="px-5 py-3 font-medium">Workflow Name</th>
                  <th className="px-5 py-3 font-medium">Trigger Keywords</th>
                  <th className="px-5 py-3 font-medium">Target Reel/Post</th>
                  <th className="px-5 py-3 font-medium">Link</th>
                  <th className="px-5 py-3 font-medium">DMs Sent</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id} className="stripe-row hover:bg-primary/5 transition-colors">
                    <td className="px-5 py-3 font-medium">{a.name}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(a.anyComment ? ["ANY COMMENT"] : a.keywords).slice(0, 3).map((k) => (
                          <span key={k} className="px-2 py-0.5 rounded-full bg-muted text-xs font-mono">{k}</span>
                        ))}
                        {!a.anyComment && a.keywords.length > 3 && (
                          <span className="text-xs text-muted-foreground">+{a.keywords.length - 3} more</span>
                        )}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        Includes story replies and shared reel/post DMs
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {a.postScope === "SPECIFIC" || a.postId ? (
                        <div className="space-y-1">
                          <div className="font-mono text-[11px]">{shortId(a.postId!)}</div>
                          <div className="line-clamp-2">{mediaById.get(a.postId!)?.caption || "Specific reel/post"}</div>
                        </div>
                      ) : a.postScope === "NEXT" ? (
                        <span>New posts only</span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                            Template
                          </span>
                          All posts
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs">
                      {a.dmButtonUrl ? (
                        <a className="text-primary hover:underline break-all" href={a.dmButtonUrl} target="_blank" rel="noreferrer">
                          {a.dmButtonUrl}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">No link</span>
                      )}
                    </td>
                    <td className="px-5 py-3 font-mono">{a._count.dmJobs.toLocaleString()}</td>
                    <td className="px-5 py-3"><StatusBadge status={formatStatus(a.status)} withDot /></td>
                    <td className="px-5 py-3 text-muted-foreground">{new Date(a.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40"
                          onClick={() => { setEditing(a); setOpen(true); }}
                          disabled={!canUpdate}
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          className="p-1.5 rounded-md hover:bg-destructive/15 text-muted-foreground hover:text-destructive disabled:opacity-40"
                          onClick={() => deleteMutation.mutate(a.id)}
                          disabled={!canDelete || deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </DashboardLayout>
  );
}

function AutomationBuilder({
  onClose,
  onSaved,
  mode,
  initial,
  wizardData,
  workspaceId
}: {
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  mode: "create" | "edit";
  initial: Automation | null;
  wizardData?: WizardData;
  workspaceId: string | null;
}) {
  const draftKey = builderDraftStorageKey(workspaceId, initial?.id ?? null);
  const savedDraft = useMemo(() => readBuilderDraft(draftKey), [draftKey]);
  const initialTriggerBlocks = useMemo(() => buildInitialTriggerBlocks(initial), [initial]);
  const defaultBlocks = savedDraft?.triggerBlocks ?? initialTriggerBlocks;

  const [name, setName] = useState(savedDraft?.name ?? initial?.name ?? defaultForm.name);
  const [status, setStatus] = useState<AutomationStatus>(savedDraft?.status ?? initial?.status ?? defaultForm.status);
  const [anyComment, setAnyComment] = useState(savedDraft?.anyComment ?? initial?.anyComment ?? defaultForm.anyComment);
  const [postMode, setPostMode] = useState<PostMode>(savedDraft?.postMode ?? resolvePostMode(initial));
  const [selectedPostId, setSelectedPostId] = useState<string | null>(
    savedDraft?.selectedPostId ?? initial?.postId ?? null
  );
  const [step, setStep] = useState(savedDraft?.step ?? 0);
  const [maxCompletedStep, setMaxCompletedStep] = useState(savedDraft?.maxCompletedStep ?? savedDraft?.step ?? 0);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [triggerBlocks, setTriggerBlocks] = useState<TriggerBlock[]>(defaultBlocks);
  const [expandedBlockIds, setExpandedBlockIds] = useState<Set<string>>(
    () => new Set(savedDraft?.expandedBlockIds?.length ? savedDraft.expandedBlockIds : defaultBlocks[0]?.id ? [defaultBlocks[0].id] : [])
  );
  const [previewBlockId, setPreviewBlockId] = useState(
    () => savedDraft?.previewBlockId ?? defaultBlocks[0]?.id ?? "initial-0"
  );
  const queryClient = useQueryClient();
  const billingConfigQuery = useBillingConfigQuery();
  const workspacePlan = wizardData?.workspace?.plan ?? "FREE";
  const dmFollowUpLimit = useMemo(() => {
    const planConfig = billingConfigQuery.data?.plans.find((p) => p.plan === workspacePlan);
    return planConfig?.limits.dmFollowUps ?? 0;
  }, [billingConfigQuery.data?.plans, workspacePlan]);
  const canCustomizeFollowUps = dmFollowUpLimit > 0;
  const initialFollowUps = useMemo(
    () =>
      (initial?.followUps?.length ? initial.followUps : savedDraft?.followUps)?.map((step, index) => ({
        delay: followUpDelayFromApi(step as FollowUpStep & { delaySeconds?: number; delayMinutes?: number }),
        message: step.message,
        order: step.order ?? index
      })) ?? [],
    [initial?.followUps, savedDraft?.followUps]
  );
  const [followUps, setFollowUps] = useState<FollowUpStep[]>(initialFollowUps);

  const steps = ["Name & triggers", "Select reel/post", "Review"];
  const selectedMedia = wizardData?.media.find((item) => item.id === selectedPostId) ?? null;
  const previewBlock = triggerBlocks.find((block) => block.id === previewBlockId) ?? triggerBlocks[0];

  const toggleBlockExpanded = (blockId: string) => {
    setExpandedBlockIds((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
    setPreviewBlockId(blockId);
  };
  const requiresPostSelection = postMode === "specific" && !selectedPostId;

  const goToNextStep = () => {
    if (step === 1 && requiresPostSelection) {
      toast.error("Choose a reel/post or switch the target to any post/reel.");
      return;
    }
    const nextStep = Math.min(steps.length - 1, step + 1);
    setStep(nextStep);
    setMaxCompletedStep((prev) => Math.max(prev, nextStep));
  };

  const goToStep = (targetStep: number) => {
    if (targetStep > maxCompletedStep) return;
    setStep(targetStep);
  };

  useEffect(() => {
    writeBuilderDraft(draftKey, {
      name,
      status,
      anyComment,
      postMode,
      selectedPostId,
      step,
      maxCompletedStep,
      triggerBlocks,
      expandedBlockIds: [...expandedBlockIds],
      previewBlockId,
      followUps
    });
  }, [
    draftKey,
    name,
    status,
    anyComment,
    postMode,
    selectedPostId,
    step,
    maxCompletedStep,
    triggerBlocks,
    expandedBlockIds,
    previewBlockId,
    followUps
  ]);

  const updateBlock = (blockId: string, patch: Partial<TriggerBlock>) => {
    setTriggerBlocks((blocks) => blocks.map((block) => (block.id === blockId ? { ...block, ...patch } : block)));
  };

  const addBlock = () => {
    if (anyComment) {
      toast.error("Any comment trigger can only use one action block.");
      return;
    }
    const next = createTriggerBlock({ keyword: "" });
    setTriggerBlocks((blocks) => [...blocks, next]);
    setExpandedBlockIds((prev) => new Set([...prev, next.id]));
    setPreviewBlockId(next.id);
  };

  const removeBlock = (blockId: string) => {
    setTriggerBlocks((blocks) => {
      if (blocks.length === 1) return blocks;
      const next = blocks.filter((block) => block.id !== blockId);
      setExpandedBlockIds((prev) => {
        const ids = new Set(prev);
        ids.delete(blockId);
        if (ids.size === 0 && next[0]) ids.add(next[0].id);
        return ids;
      });
      if (previewBlockId === blockId) setPreviewBlockId(next[0].id);
      return next;
    });
  };

  const blocksBackupKey = keywordBlocksStorageKey(workspaceId, initial?.id ?? null);

  const setAnyCommentMode = (checked: boolean) => {
    if (checked) {
      setTriggerBlocks((blocks) => {
        localStorage.setItem(blocksBackupKey, JSON.stringify(blocks));
        const primary = blocks[0] ?? createTriggerBlock();
        setExpandedBlockIds(new Set([primary.id]));
        setPreviewBlockId(primary.id);
        return [{ ...primary, keyword: "" }];
      });
      setAnyComment(true);
      return;
    }

    const restored = readKeywordBlocksBackup(blocksBackupKey);
    if (restored) {
      setTriggerBlocks(restored);
      setExpandedBlockIds(new Set(restored.map((block) => block.id)));
      setPreviewBlockId(restored[0].id);
      localStorage.removeItem(blocksBackupKey);
    }
    setAnyComment(false);
  };

  const buildPayload = (targetStatus: AutomationStatus) => {
    const baseName = name.trim();
    const normalizedBlocks = triggerBlocks.map((block) => ({
      ...block,
      keyword: anyComment ? "" : block.keyword.trim().toUpperCase(),
      dmButtonUrl: normalizeClientButtonUrl(block.dmButtonUrl)
    }));
    const primaryBlock = normalizedBlocks[0];
    return {
      name: baseName,
      keywords: anyComment ? [] : normalizedBlocks.map((block) => block.keyword).filter(Boolean),
      excludedKeywords: [],
      anyComment,
      postScope: postMode,
      postId: postMode === "specific" ? selectedPostId ?? null : null,
      dmMessage: primaryBlock.dmMessage.trim(),
      autoReply: primaryBlock.autoReply,
      replyMessages: primaryBlock.autoReply && primaryBlock.replyMessage.trim() ? [primaryBlock.replyMessage.trim()] : [],
      dmButtonLabel: primaryBlock.dmButtonUrl.trim() ? primaryBlock.dmButtonLabel.trim() || undefined : undefined,
      dmButtonUrl: primaryBlock.dmButtonUrl.trim() || undefined,
      triggerBlocks: normalizedBlocks.map((block) => ({
        id: block.id,
        keyword: block.keyword,
        autoReply: block.autoReply,
        replyMessage: block.replyMessage.trim(),
        dmMessage: block.dmMessage.trim(),
        dmButtonLabel: block.dmButtonUrl.trim() ? block.dmButtonLabel.trim() || undefined : undefined,
        dmButtonUrl: block.dmButtonUrl.trim() || undefined,
        followBeforeDm: block.followBeforeDm
      })),
      followBeforeDm: normalizedBlocks.some((block) => block.followBeforeDm),
      followUps: canCustomizeFollowUps
        ? followUps
            .map((step, index) => ({
              delay: step.delay.trim().toLowerCase(),
              message: step.message.trim(),
              order: index
            }))
            .filter((step) => step.message.length > 0)
        : undefined,
      status: targetStatus
    };
  };

  const mutation = useMutation({
    mutationFn: async (targetStatus: AutomationStatus) => {
      const baseName = name.trim();
      if (baseName.length < 2) throw new Error("Automation name must be at least 2 characters.");
      if (postMode === "specific" && !selectedPostId) throw new Error("Choose a reel/post or switch the target to any post/reel.");
      if (!anyComment && triggerBlocks.some((block) => !block.keyword.trim())) throw new Error("Every trigger block needs a trigger word.");
      const normalizedKeywords = triggerBlocks.map((block) => block.keyword.trim().toUpperCase()).filter(Boolean);
      if (!anyComment && new Set(normalizedKeywords).size !== normalizedKeywords.length) throw new Error("Trigger words must be unique inside one workflow.");
      if (triggerBlocks.some((block) => !block.dmMessage.trim())) throw new Error("Every trigger block needs an Auto DM message.");
      if (canCustomizeFollowUps && followUps.some((step) => !step.message.trim())) {
        throw new Error("Every follow-up message must have text, or remove empty steps.");
      }
      if (canCustomizeFollowUps && followUps.length > dmFollowUpLimit) {
        throw new Error(`Your plan allows up to ${dmFollowUpLimit} follow-up message(s) per automation.`);
      }
      if (canCustomizeFollowUps) {
        for (let i = 0; i < followUps.length; i++) {
          try {
            parseDurationSeconds(followUps[i].delay);
          } catch (err) {
            const hint = err instanceof Error ? err.message : "Invalid delay";
            throw new Error(`Follow-up ${i + 1}: ${hint}`);
          }
        }
      }
      const payload = buildPayload(targetStatus);
      if (mode === "edit" && initial) {
        return apiRequest(`/api/v1/automations/${initial.id}`, { method: "PATCH", workspaceId: workspaceId ?? undefined, body: payload });
      }
      return apiRequest("/api/v1/automations", { method: "POST", workspaceId: workspaceId ?? undefined, body: payload });
    },
    onSuccess: async () => {
      localStorage.removeItem(blocksBackupKey);
      clearBuilderDraft(draftKey);
      await queryClient.invalidateQueries({ queryKey: ["automations", workspaceId] });
      toast.success(mode === "edit" ? "Automation updated" : "Automation created");
      await onSaved();
    },
    onError: (error) => toast.error((error as Error).message)
  });

  return (
    <DashboardLayout
      title={mode === "edit" ? "Edit Automation" : "Create Automation"}
      headerActions={
        <Button
          variant="accent"
          size="sm"
          disabled={mutation.isPending || (postMode === "specific" && step === 2 && !selectedPostId)}
          onClick={() => mutation.mutate(status)}
        >
          {mutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        {/* ── LEFT COLUMN ── */}
        <div className="space-y-5">
          {/* Stepper */}
          <BuilderStepper steps={steps} currentStep={step} maxReachableStep={maxCompletedStep} onStepChange={goToStep} />

          {/* ── STEP 0: Name & Triggers ── */}
          <div className={cn("space-y-4", step !== 0 && "hidden")}>
              {/* Workflow Name card */}
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Workflow Name
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Status:</span>
                    <span className={cn("text-xs font-medium", status === "ACTIVE" ? "text-green-500" : "text-muted-foreground")}>
                      {status === "ACTIVE" ? "Active" : status === "PAUSED" ? "Paused" : "Draft"}
                    </span>
                    <Switch
                      checked={status === "ACTIVE"}
                      onCheckedChange={(v) => setStatus(v ? "ACTIVE" : "PAUSED")}
                    />
                  </div>
                </div>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-background border-border"
                />
              </div>

              {/* Triggers section */}
              <div>
                {/* Section header */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Zap className="h-3.5 w-3.5 text-primary" />
                  </span>
                  <span className="text-sm font-semibold text-primary">Step 1: Name &amp; triggers</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4 ml-8">
                  Configure your keyword triggers{" "}
                  <span className="text-primary cursor-default">and</span>{" "}
                  automated responses.
                </p>

                {/* Any comment toggle */}
                {anyComment !== undefined && (
                  <div className="ml-8 mb-4 flex items-center gap-2">
                    <Switch checked={anyComment} onCheckedChange={setAnyCommentMode} />
                    <span className="text-xs text-muted-foreground">Trigger on any comment</span>
                  </div>
                )}

                {/* Trigger timeline */}
                <div className="relative">
                  <div
                    className="absolute left-3 top-4 w-px bg-border"
                    style={{ height: `calc(100% - 1.5rem)` }}
                  />

                  <div className="space-y-3">
                    {triggerBlocks.map((block, index) => (
                      <div key={block.id} className="relative pl-8">
                        <div
                          className={cn(
                            "absolute left-1.5 top-3.5 h-3 w-3 rounded-full border-2 transition-colors",
                            expandedBlockIds.has(block.id)
                              ? "border-primary bg-primary/20"
                              : "border-border bg-card"
                          )}
                        />
                        <TriggerAccordionRow
                          block={block}
                          index={index}
                          isExpanded={expandedBlockIds.has(block.id)}
                          anyComment={anyComment}
                          canRemove={triggerBlocks.length > 1}
                          onToggleExpand={() => toggleBlockExpanded(block.id)}
                          onRemove={() => removeBlock(block.id)}
                          onUpdate={(patch) => updateBlock(block.id, patch)}
                        />
                      </div>
                    ))}

                    {/* Add new trigger block */}
                    <div className="relative pl-8">
                      <div className="absolute left-1.5 top-3.5 h-3 w-3 rounded-full border-2 border-dashed border-primary/30 bg-card" />
                      <button
                        type="button"
                        onClick={addBlock}
                        disabled={anyComment}
                        className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors disabled:pointer-events-none disabled:opacity-50"
                      >
                        <Plus className="h-4 w-4" />
                        Add New Trigger Block
                      </button>
                    </div>
                  </div>
                </div>
              </div>
          </div>

          {/* ── STEP 1: Select reel/post ── */}
          <div className={cn("space-y-4", step !== 1 && "hidden")}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <ImagePlus className="h-3.5 w-3.5 text-primary" />
                  </span>
                  <span className="text-sm font-semibold text-primary">Step 2: Select reel/post</span>
                </div>
                <p className="text-xs text-muted-foreground ml-8">
                  Pick how this automation applies to your Instagram content. Use account template to set up once for all posts.
                </p>
              </div>

              <div className="space-y-2">
                {POST_MODE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPostMode(option.value)}
                    className={cn(
                      "w-full rounded-xl border p-4 text-left transition-colors",
                      postMode === option.value
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border bg-card hover:border-muted-foreground/40"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{option.label}</span>
                      {option.recommended && (
                        <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
                  </button>
                ))}
              </div>

              {postMode === "specific" ? (
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">Selected post</div>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {selectedMedia?.caption || "No reel/post selected yet."}
                      </p>
                      {requiresPostSelection && (
                        <p className="mt-2 text-xs text-destructive">
                          Select a reel or post to continue to review.
                        </p>
                      )}
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setIsMediaPickerOpen(true)}>
                      <ImagePlus className="h-4 w-4" /> Choose reel/post
                    </Button>
                  </div>
                </div>
              ) : postMode === "any" ? (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
                  <p className="font-medium text-foreground">Account-wide template</p>
                  <p className="mt-1 text-muted-foreground">
                    Comments on any reel or post (old or new) can trigger this workflow when keywords match.
                    You only need one automation — no per-post setup.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                  Applies to reels and posts published after you save. Older posts are excluded.
                </div>
              )}
          </div>

          {/* ── STEP 2: Review ── */}
          <div className={cn("space-y-4", step !== 2 && "hidden")}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Zap className="h-3.5 w-3.5 text-primary" />
                  </span>
                  <span className="text-sm font-semibold text-primary">Step 3: Review</span>
                </div>
                <p className="text-xs text-muted-foreground ml-8">
                  Confirm your workflow settings before saving.
                </p>
              </div>

              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <ReviewItem label="Status" value={status} />
                <ReviewItem
                  label="Target"
                  value={
                    postMode === "specific"
                      ? selectedMedia?.caption || selectedPostId || "Select a post"
                      : postMode === "any"
                        ? "Account template (all posts)"
                        : "New posts only"
                  }
                />
                <ReviewItem
                  label="Trigger blocks"
                  value={anyComment ? "Any comment/reply" : `${triggerBlocks.length} keyword flows`}
                />
                <ReviewItem
                  label="Active trigger"
                  value={anyComment ? "Any comment" : previewBlock?.keyword || "No keyword"}
                />
                <ReviewItem label="Auto reply" value={previewBlock?.autoReply ? "Enabled" : "Disabled"} />
                <ReviewItem
                  label="DM button"
                  value={
                    previewBlock?.dmButtonUrl.trim()
                      ? previewBlock.dmButtonLabel.trim() || "Open link"
                      : "No button"
                  }
                />
              </div>

              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" /> Follow Before DM
                  </div>
                  <Switch
                    checked={previewBlock?.followBeforeDm ?? false}
                    onCheckedChange={(checked) =>
                      previewBlock && updateBlock(previewBlock.id, { followBeforeDm: checked })
                    }
                  />
                </div>
                <FollowUpSequencesSection
                  canCustomize={canCustomizeFollowUps}
                  followUpLimit={dmFollowUpLimit}
                  followUps={followUps}
                  onChange={setFollowUps}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate("DRAFT")}
                >
                  Save Draft
                </Button>
                <Button
                  size="sm"
                  disabled={mutation.isPending || (postMode === "specific" && !selectedPostId)}
                  onClick={() => mutation.mutate(status)}
                >
                  {mutation.isPending ? "Saving..." : mode === "edit" ? "Update Automation" : "Save & Activate"}
                </Button>
              </div>
          </div>

          {/* Footer navigation */}
          <div className="flex items-center justify-between pt-1">
            <Button
              variant="outline"
              disabled={step === 0}
              onClick={() => goToStep(step - 1)}
            >
              Previous
            </Button>
            <Button
              disabled={step === steps.length - 1 || (step === 1 && requiresPostSelection)}
              onClick={goToNextStep}
            >
              Next
            </Button>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Live Preview ── */}
        <AutomationLivePreview
          username="yourbrand"
          selectedMedia={selectedMedia}
          postMode={postMode}
          anyComment={anyComment}
          activeBlock={previewBlock}
        />
      </div>

      <ReelPickerDialog
        open={isMediaPickerOpen}
        media={wizardData?.media ?? []}
        selectedPostId={selectedPostId}
        onOpenChange={setIsMediaPickerOpen}
        onSelect={(mediaId) => {
          setSelectedPostId(mediaId);
          setIsMediaPickerOpen(false);
        }}
      />
    </DashboardLayout>
  );
}

function BuilderStepper({
  steps,
  currentStep,
  maxReachableStep,
  onStepChange
}: {
  steps: string[];
  currentStep: number;
  maxReachableStep: number;
  onStepChange: (step: number) => void;
}) {
  return (
    <div className="flex items-start gap-1 sm:gap-2">
      {steps.map((label, index) => {
        const isActive = currentStep === index;
        const isDone = index < currentStep;
        const isLocked = index > maxReachableStep;
        return (
          <button
            key={label}
            type="button"
            disabled={isLocked}
            onClick={() => {
              if (!isLocked) onStepChange(index);
            }}
            className={cn(
              "flex items-start gap-2 rounded-xl px-3 py-2.5 text-left transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : isLocked
                  ? "cursor-not-allowed text-muted-foreground/50 opacity-60"
                  : "text-muted-foreground hover:bg-muted/60"
            )}
          >
            <span
              className={cn(
                "mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                isActive
                  ? "bg-white/20 text-primary-foreground"
                  : isDone
                    ? "border border-green-500 text-green-500"
                    : "border border-current"
              )}
            >
              {index + 1}
            </span>
            <span className="text-xs font-medium leading-tight">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

function KeywordPill({ keyword, className }: { keyword: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary font-mono",
        className
      )}
    >
      {`KEYWORD "${keyword.toUpperCase()}"`}
    </span>
  );
}

function TriggerAccordionRow({
  block,
  index,
  isExpanded,
  anyComment,
  canRemove,
  onToggleExpand,
  onRemove,
  onUpdate
}: {
  block: TriggerBlock;
  index: number;
  isExpanded: boolean;
  anyComment: boolean;
  canRemove: boolean;
  onToggleExpand: () => void;
  onRemove: () => void;
  onUpdate: (patch: Partial<TriggerBlock>) => void;
}) {
  const title = blockDisplayTitle(block, anyComment);
  const keywordForPill = block.keyword.trim();

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card transition-colors",
        isExpanded ? "border-2 border-primary/30" : "border-border hover:border-primary/30"
      )}
    >
      <div className="flex flex-col gap-2.5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-xs text-muted-foreground">Trigger #{index + 1}</span>
          <span className="min-w-0 truncate text-sm font-semibold">{title}</span>
          {!anyComment && keywordForPill ? <KeywordPill keyword={keywordForPill} className="hidden md:inline-flex" /> : null}
        </div>

        <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">
          {!anyComment && keywordForPill ? <KeywordPill keyword={keywordForPill} className="md:hidden" /> : null}
          <span className="whitespace-nowrap text-xs text-muted-foreground">Auto-reply</span>
          <Switch checked={block.autoReply} onCheckedChange={(v) => onUpdate({ autoReply: v })} />
          <button
            type="button"
            disabled={!canRemove}
            onClick={onRemove}
            aria-label={`Delete trigger ${index + 1}`}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Collapse trigger" : "Expand trigger"}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {isExpanded ? (
        <div className="space-y-4 border-t border-border/60 px-3 pb-4 pt-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Trigger Word</Label>
            <Input
              value={anyComment ? "ANY COMMENT" : block.keyword}
              onChange={(e) => onUpdate({ keyword: e.target.value.toUpperCase() })}
              disabled={anyComment}
              placeholder="GUIDE"
              className="bg-background border-border"
            />
            <p className="text-xs italic text-orange-500/90">
              Triggers when someone comments this word on your post.
            </p>
          </div>

          {block.autoReply ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Reply Message</Label>
                <span className="text-[11px] text-muted-foreground">{block.replyMessage.length}/140</span>
              </div>
              <Textarea
                value={block.replyMessage}
                onChange={(e) => onUpdate({ replyMessage: e.target.value.slice(0, 140) })}
                rows={2}
                className="resize-none border-border bg-background text-sm"
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">DM Message</Label>
              <span className="text-[11px] text-muted-foreground">{block.dmMessage.length}/900</span>
            </div>
            <Textarea
              value={block.dmMessage}
              onChange={(e) => onUpdate({ dmMessage: e.target.value.slice(0, 900) })}
              rows={3}
              className="resize-none border-border bg-background text-sm"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Button Label</Label>
              <Input
                value={block.dmButtonLabel}
                onChange={(e) => onUpdate({ dmButtonLabel: e.target.value.slice(0, 20) })}
                placeholder="Open Link"
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Button URL</Label>
              <Input
                value={block.dmButtonUrl}
                onChange={(e) => onUpdate({ dmButtonUrl: e.target.value })}
                placeholder="https://..."
                className="bg-background border-border"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm text-foreground">{value}</div>
    </div>
  );
}

function ReelPickerDialog({
  open,
  media,
  selectedPostId,
  onOpenChange,
  onSelect
}: {
  open: boolean;
  media: WizardData["media"];
  selectedPostId: string | null;
  onOpenChange: (open: boolean) => void;
  onSelect: (mediaId: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Choose reel or post</DialogTitle>
          <DialogDescription>Select the Instagram media for this workflow.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {media.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={cn(
                "overflow-hidden rounded-xl border bg-card text-left transition-colors",
                selectedPostId === item.id ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/60"
              )}
            >
              <div className="relative aspect-square bg-muted">
                {item.thumbnailUrl ? (
                  <img
                    src={item.thumbnailUrl}
                    alt={item.caption || "Instagram media"}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : null}
                <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium uppercase text-white">
                  {item.mediaType}
                </span>
              </div>
              <div className="p-3">
                <p className="line-clamp-2 text-sm">{item.caption || "No caption"}</p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">{shortId(item.id)}</p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AutomationLivePreview({
  username,
  selectedMedia,
  postMode,
  anyComment,
  activeBlock
}: {
  username: string;
  selectedMedia: WizardData["media"][number] | null;
  postMode: PostMode;
  anyComment: boolean;
  activeBlock?: TriggerBlock;
}) {
  const triggerLabel = anyComment ? "Any comment/reply" : (activeBlock?.keyword || "GUIDE");
  const reply = activeBlock?.replyMessage.trim() || "Sent: Check your DMs ❤️";
  const dmMessage = activeBlock?.dmMessage?.trim() || "Hi there! Here's your link 👇";
  const dmButtonLabel = activeBlock?.dmButtonLabel || "Open Link";
  const dmButtonUrl = activeBlock?.dmButtonUrl ?? "";
  const showDmButton = Boolean(dmButtonUrl.trim()) || !activeBlock;

  void postMode;

  return (
    <aside className="space-y-3 xl:sticky xl:top-4">
      {/* Header */}
      <div className="flex items-center gap-1.5 pb-0.5">
        <Eye className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-primary">Live Preview</span>
      </div>

      {/* Instagram Post Card */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {/* Profile row */}
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] shrink-0" />
            <span className="text-sm font-semibold">{username}</span>
          </div>
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Media */}
        <div className="relative aspect-square bg-muted">
          {selectedMedia?.thumbnailUrl ? (
            <img
              src={selectedMedia.thumbnailUrl}
              alt={selectedMedia.caption || ""}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-center text-xs text-muted-foreground px-6">
              Select a reel/post to preview
            </div>
          )}
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-4 px-3 py-2.5">
          <Heart className="h-5 w-5" />
          <MessageCircle className="h-5 w-5" />
          <Send className="h-5 w-5" />
        </div>

        {/* Comment preview */}
        <div className="px-3 pb-3 space-y-0.5 text-sm">
          <p>
            <span className="font-semibold">user_name</span>{" "}
            <span>{triggerLabel}</span>
          </p>
          <p>
            <span className="font-semibold">{username}</span>{" "}
            <span className="text-muted-foreground">{reply}</span>
          </p>
        </div>
      </div>

      {/* DM Conversation Card */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {/* DM header */}
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <ArrowLeft className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] shrink-0" />
          <div>
            <p className="text-sm font-semibold leading-none">{username}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Active now</p>
          </div>
        </div>

        {/* Messages */}
        <div className="space-y-2 p-3">
          {/* User's trigger word */}
          <div className="flex justify-end">
            <div className="max-w-[70%] rounded-2xl rounded-tr-sm bg-muted px-3 py-1.5 text-sm">
              {triggerLabel}
            </div>
          </div>

          {/* Brand's automated DM */}
          <div className="max-w-[88%]">
            <div className="rounded-2xl rounded-tl-sm bg-primary p-3 text-primary-foreground">
              <p className="text-sm whitespace-pre-wrap">{dmMessage}</p>
              {showDmButton && (
                <div className="mt-2 rounded-full bg-background px-3 py-1.5 text-center text-xs font-semibold text-primary">
                  {dmButtonLabel}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Message input */}
        <div className="border-t border-border p-2.5">
          <div className="flex items-center gap-2 rounded-full border border-border px-3 py-2">
            <span className="flex-1 text-sm text-muted-foreground">Message...</span>
            <Send className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>
      </div>
    </aside>
  );
}

function FollowUpSequencesSection({
  canCustomize,
  followUpLimit,
  followUps,
  onChange
}: {
  canCustomize: boolean;
  followUpLimit: number;
  followUps: FollowUpStep[];
  onChange: (steps: FollowUpStep[]) => void;
}) {
  if (!canCustomize) {
    return (
      <div className="space-y-2 pt-1 border-t border-border">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            DM Follow-up Sequences
          </div>
          <Link to="/settings?tab=Billing" className="text-xs text-primary hover:underline shrink-0">
            Upgrade to Pro
          </Link>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          On the Free plan, Reactova automatically sends a branded follow-up DM about 5 minutes after your primary DM.
          Upgrade to customize follow-up messages and timing.
        </p>
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground whitespace-pre-line">
          {FREE_TIER_FOLLOW_UP_PREVIEW}
          <div className="mt-2 font-semibold text-primary">Get the tool now!</div>
        </div>
      </div>
    );
  }

  const addStep = () => {
    if (followUps.length >= followUpLimit) return;
    onChange([...followUps, defaultFollowUpStep(followUps.length)]);
  };

  const updateStep = (index: number, patch: Partial<FollowUpStep>) => {
    onChange(followUps.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  };

  const removeStep = (index: number) => {
    onChange(
      followUps
        .filter((_, i) => i !== index)
        .map((step, i) => ({ ...step, order: i }))
    );
  };

  return (
    <div className="space-y-3 pt-1 border-t border-border">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">DM Follow-up Sequences</p>
          <p className="text-xs text-muted-foreground">
            Sent after your primary DM when someone uses a trigger word in a comment.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={followUps.length >= followUpLimit}
          onClick={addStep}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add
        </Button>
      </div>

      {followUps.length === 0 ? (
        <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-border p-3">
          No follow-ups yet. Add a message to re-engage commenters after a delay.
        </p>
      ) : (
        <div className="space-y-3">
          {followUps.map((step, index) => (
            <div key={`follow-up-${index}`} className="rounded-lg border border-border bg-background p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">Follow-up {index + 1}</span>
                <button
                  type="button"
                  className="text-xs text-destructive hover:underline"
                  onClick={() => removeStep(index)}
                >
                  Remove
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Label className="text-xs shrink-0">Send after</Label>
                <Input
                  type="text"
                  className="h-8 w-24 text-sm font-mono"
                  placeholder="20s"
                  value={step.delay}
                  onChange={(e) => updateStep(index, { delay: e.target.value })}
                  onBlur={(e) => {
                    const raw = e.target.value.trim().toLowerCase();
                    if (!raw) return;
                    try {
                      const seconds = parseDurationSeconds(raw);
                      updateStep(index, { delay: formatDurationLabel(seconds) });
                    } catch {
                      /* keep raw while editing */
                    }
                  }}
                />
                <span className="text-xs text-muted-foreground">
                  from primary DM (s, m, h, d — e.g. 20s, 2m, 1h, 1d)
                </span>
              </div>
              <Textarea
                rows={3}
                className="text-sm resize-y min-h-[72px]"
                placeholder="Follow-up message..."
                value={step.message}
                onChange={(e) => updateStep(index, { message: e.target.value })}
              />
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Up to {followUpLimit} follow-up{followUpLimit === 1 ? "" : "s"} on your plan.
      </p>
    </div>
  );
}
