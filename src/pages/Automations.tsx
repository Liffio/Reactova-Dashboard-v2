import { useMemo, useState } from "react";
import { ArrowRight, ChevronDown, ChevronUp, GripVertical, ImagePlus, Lock, MessageCircle, MousePointer, Plus, Edit, Trash2, X, Zap } from "lucide-react";
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
import { useAppSelector } from "@/store/hooks";
import { apiRequest } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

type AutomationStatus = "ACTIVE" | "PAUSED" | "DRAFT";
type PostMode = "specific" | "any" | "next";
type Automation = {
  id: string;
  name: string;
  keywords: string[];
  excludedKeywords: string[];
  anyComment: boolean;
  postId: string | null;
  dmMessage: string;
  dmButtonLabel: string | null;
  dmButtonUrl: string | null;
  autoReply: boolean;
  replyMessages: string[];
  triggerBlocks?: TriggerBlock[];
  followBeforeDm: boolean;
  status: AutomationStatus;
  createdAt: string;
  _count: { dmJobs: number };
};

type WizardData = {
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
  if (!trimmed) {
    return "";
  }
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
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
      <DashboardLayout
        title={editing ? "Edit Automation" : "Create Automation"}
        subtitle="Build the trigger, auto reply, and DM flow with live previews."
      >
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
      </DashboardLayout>
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
                        {!a.anyComment && a.keywords.length > 3 && <span className="text-xs text-muted-foreground">+{a.keywords.length - 3} more</span>}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        Includes story replies and shared reel/post DMs
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {a.postId ? (
                        <div className="space-y-1">
                          <div className="font-mono text-[11px]">{shortId(a.postId)}</div>
                          <div className="line-clamp-2">{mediaById.get(a.postId)?.caption || "Specific reel/post"}</div>
                        </div>
                      ) : (
                        <span>Any post/reel</span>
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
                          onClick={() => {
                            setEditing(a);
                            setOpen(true);
                          }}
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
  const [name, setName] = useState(initial?.name ?? defaultForm.name);
  const [status, setStatus] = useState<AutomationStatus>(initial?.status ?? defaultForm.status);
  const [anyComment, setAnyComment] = useState(initial?.anyComment ?? defaultForm.anyComment);
  const [postMode, setPostMode] = useState<PostMode>("specific");
  const [selectedPostId, setSelectedPostId] = useState<string | null>(initial?.postId ?? null);
  const [step, setStep] = useState(0);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [triggerBlocks, setTriggerBlocks] = useState<TriggerBlock[]>(() => {
    if (!initial) {
      return [createTriggerBlock()];
    }
    if (initial.triggerBlocks?.length) {
      return initial.triggerBlocks.map((block, index) =>
        createTriggerBlock({
          ...block,
          id: block.id || `initial-${index}`
        })
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
  });
  const [activeBlockId, setActiveBlockId] = useState(() => triggerBlocks[0]?.id ?? "initial-0");
  const queryClient = useQueryClient();
  const steps = ["Name & triggers", "Select reel/post", "Review"];
  const selectedMedia = wizardData?.media.find((item) => item.id === selectedPostId) ?? null;
  const activeBlock = triggerBlocks.find((block) => block.id === activeBlockId) ?? triggerBlocks[0];

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
    setActiveBlockId(next.id);
  };

  const removeBlock = (blockId: string) => {
    setTriggerBlocks((blocks) => {
      if (blocks.length === 1) {
        return blocks;
      }
      const next = blocks.filter((block) => block.id !== blockId);
      if (activeBlockId === blockId) {
        setActiveBlockId(next[0].id);
      }
      return next;
    });
  };

  const moveBlock = (blockId: string, direction: -1 | 1) => {
    setTriggerBlocks((blocks) => {
      const index = blocks.findIndex((block) => block.id === blockId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= blocks.length) {
        return blocks;
      }
      const next = [...blocks];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  };

  const reorderBlock = (draggedBlockId: string, targetBlockId: string) => {
    setTriggerBlocks((blocks) => {
      const fromIndex = blocks.findIndex((block) => block.id === draggedBlockId);
      const toIndex = blocks.findIndex((block) => block.id === targetBlockId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
        return blocks;
      }
      const next = [...blocks];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next;
    });
  };

  const setAnyCommentMode = (checked: boolean) => {
    setAnyComment(checked);
    if (checked) {
      setTriggerBlocks((blocks) => [{ ...blocks[0], keyword: "" }]);
      setActiveBlockId((current) => triggerBlocks[0]?.id ?? current);
    }
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
      postId: postMode === "specific" ? selectedPostId ?? undefined : undefined,
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
      status: targetStatus
    };
  };

  const mutation = useMutation({
    mutationFn: async (targetStatus: AutomationStatus) => {
      const baseName = name.trim();
      if (baseName.length < 2) {
        throw new Error("Automation name must be at least 2 characters.");
      }
      if (postMode === "specific" && !selectedPostId) {
        throw new Error("Choose a reel/post or switch the target to any post/reel.");
      }
      if (!anyComment && triggerBlocks.some((block) => !block.keyword.trim())) {
        throw new Error("Every trigger block needs a trigger word.");
      }
      const normalizedKeywords = triggerBlocks.map((block) => block.keyword.trim().toUpperCase()).filter(Boolean);
      if (!anyComment && new Set(normalizedKeywords).size !== normalizedKeywords.length) {
        throw new Error("Trigger words must be unique inside one workflow.");
      }
      if (triggerBlocks.some((block) => !block.dmMessage.trim())) {
        throw new Error("Every trigger block needs an Auto DM message.");
      }
      const payload = buildPayload(targetStatus);

      if (mode === "edit" && initial) {
        return apiRequest(`/api/v1/automations/${initial.id}`, {
          method: "PATCH",
          workspaceId: workspaceId ?? undefined,
          body: payload
        });
      }

      return apiRequest("/api/v1/automations", {
        method: "POST",
        workspaceId: workspaceId ?? undefined,
        body: payload
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["automations", workspaceId] });
      toast.success(mode === "edit" ? "Automation updated" : "Automation created");
      await onSaved();
    },
    onError: (error) => toast.error((error as Error).message)
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
      <section className="rounded-xl border border-border bg-card">
        <div className="border-b border-border p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">{mode === "edit" ? "Edit automation" : "Create automation"}</h2>
              <p className="text-sm text-muted-foreground">One workflow. Multiple trigger replies.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Back to automations
            </Button>
          </div>
          <ShadcnStepper steps={steps} currentStep={step} onStepChange={setStep} />
        </div>

        <div className="p-4">
          {step === 0 && (
            <div className="space-y-6">
              <Section title="Name">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_200px]">
                  <div className="space-y-2">
                    <Label>Workflow name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-input border-border" />
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
                    <Label>Status</Label>
                    <div className="flex items-center gap-2 text-xs">
                      <span className={status === "ACTIVE" ? "text-success" : "text-muted-foreground"}>
                        {status === "ACTIVE" ? "Active" : status === "PAUSED" ? "Paused" : "Draft"}
                      </span>
                      <Switch
                        checked={status === "ACTIVE"}
                        onCheckedChange={(checked) => setStatus(checked ? "ACTIVE" : "PAUSED")}
                      />
                    </div>
                  </div>
                </div>
              </Section>

              <Section title="Triggers">
                <div className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
                  <div>
                    <div className="text-sm font-medium">Any comment trigger</div>
                  </div>
                  <Switch checked={anyComment} onCheckedChange={setAnyCommentMode} />
                </div>
                <AutomationFlowCanvas
                  blocks={triggerBlocks}
                  activeBlockId={activeBlockId}
                  anyComment={anyComment}
                  onSelectBlock={setActiveBlockId}
                  onAddBlock={addBlock}
                  onRemoveBlock={removeBlock}
                  onMoveBlock={moveBlock}
                  onReorderBlock={reorderBlock}
                  onUpdateBlock={updateBlock}
                />
              </Section>
            </div>
          )}

          {step === 1 && (
            <Section title="Reel or post">
              <div className="space-y-3">
                <div className="grid grid-cols-3 rounded-lg border border-border p-1">
                  {(["specific", "any", "next"] as PostMode[]).map((modeOption) => (
                    <button
                      key={modeOption}
                      type="button"
                      onClick={() => setPostMode(modeOption)}
                      className={cn(
                        "px-2 py-1.5 text-xs rounded-md text-center",
                        postMode === modeOption ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                      )}
                    >
                      {modeOption === "specific" ? "Specific" : modeOption === "any" ? "Any" : "Next"}
                    </button>
                  ))}
                </div>

                {postMode === "specific" ? (
                  <div className="rounded-xl border border-border bg-background p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-sm font-medium">Selected</div>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {selectedMedia?.caption || "No reel/post selected yet."}
                        </p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => setIsMediaPickerOpen(true)}>
                        <ImagePlus className="h-4 w-4" /> Choose reel/post
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-background p-3 text-sm text-muted-foreground">
                    {postMode === "any" ? "Runs on any matching post/reel." : "Prepared for your next post/reel."}
                  </div>
                )}
              </div>
            </Section>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <Section title="Review">
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <ReviewItem label="Status" value={status} />
                  <ReviewItem label="Target" value={postMode === "specific" ? selectedMedia?.caption || selectedPostId || "Select a post" : postMode === "any" ? "Any post/reel" : "Next post/reel"} />
                  <ReviewItem label="Trigger blocks" value={anyComment ? "Any comment/reply" : `${triggerBlocks.length} keyword flows`} />
                  <ReviewItem label="Active trigger" value={anyComment ? "Any comment" : activeBlock?.keyword || "No keyword"} />
                  <ReviewItem label="Auto reply" value={activeBlock?.autoReply ? "Enabled" : "Disabled"} />
                  <ReviewItem label="DM button" value={activeBlock?.dmButtonUrl.trim() ? activeBlock.dmButtonLabel.trim() || "Open link" : "No button"} />
                </div>
              </Section>
              <Section title="Advanced">
            <div className="p-3 rounded-xl border border-border bg-background space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" /> Follow Before DM
                </div>
                <Switch
                  checked={activeBlock?.followBeforeDm ?? false}
                  onCheckedChange={(checked) => activeBlock && updateBlock(activeBlock.id, { followBeforeDm: checked })}
                />
              </div>
              <LockedRow text="DM Follow-up Sequences" />
            </div>
              </Section>
            </div>
          )}

        </div>

        <div className="flex flex-col gap-2 border-t border-border p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" type="button" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
              Previous
            </Button>
            <Button size="sm" type="button" disabled={step === steps.length - 1} onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}>
              Next
            </Button>
          </div>
          <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate("DRAFT")}>
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
      </section>

      <AutomationLivePreview
        username="yourbrand"
        selectedMedia={selectedMedia}
        postMode={postMode}
        anyComment={anyComment}
        activeBlock={activeBlock}
      />

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
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm text-foreground">{value}</div>
    </div>
  );
}

function ShadcnStepper({
  steps,
  currentStep,
  onStepChange
}: {
  steps: string[];
  currentStep: number;
  onStepChange: (step: number) => void;
}) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-3 sm:gap-4">
      {steps.map((label, index) => (
        <button
          key={label}
          type="button"
          onClick={() => onStepChange(index)}
          className={cn(
            "relative flex items-center gap-3 rounded-xl border bg-background px-3 py-2.5 text-left transition-colors",
            index < steps.length - 1 &&
              "after:absolute after:left-6 after:top-full after:h-3 after:border-l after:border-dotted after:border-border sm:after:left-full sm:after:top-1/2 sm:after:h-0 sm:after:w-4 sm:after:-translate-y-1/2 sm:after:border-l-0 sm:after:border-t",
            currentStep === index
              ? "border-primary ring-2 ring-primary/20"
              : index < currentStep
                ? "border-success/50"
                : "border-border hover:border-primary/50"
          )}
        >
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
              currentStep === index
                ? "border-primary bg-primary text-primary-foreground"
                : index < currentStep
                  ? "border-success bg-success/15 text-success"
                  : "border-border text-muted-foreground"
            )}
          >
            {index + 1}
          </span>
          <span>
            <span className="block text-[11px] font-medium text-muted-foreground">Step {index + 1}</span>
            <span className="block text-sm font-semibold">{label}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function AutomationFlowCanvas({
  blocks,
  activeBlockId,
  anyComment,
  onSelectBlock,
  onAddBlock,
  onRemoveBlock,
  onMoveBlock,
  onReorderBlock,
  onUpdateBlock
}: {
  blocks: TriggerBlock[];
  activeBlockId: string;
  anyComment: boolean;
  onSelectBlock: (blockId: string) => void;
  onAddBlock: () => void;
  onRemoveBlock: (blockId: string) => void;
  onMoveBlock: (blockId: string, direction: -1 | 1) => void;
  onReorderBlock: (draggedBlockId: string, targetBlockId: string) => void;
  onUpdateBlock: (blockId: string, patch: Partial<TriggerBlock>) => void;
}) {
  const activeBlock = blocks.find((block) => block.id === activeBlockId) ?? blocks[0];
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);

  return (
    <div className="rounded-2xl border border-border bg-muted/20 p-3">
      <div className="mb-3 hidden flex-wrap items-center gap-3 md:flex">
        <FlowNode icon={MousePointer} title="Trigger" subtitle={anyComment ? "Any comment" : "Keyword"} />
        <ArrowRight className="hidden h-4 w-4 text-muted-foreground sm:block" />
        <div className="flex flex-wrap gap-2">
          {blocks.map((block, index) => (
            <TriggerBlockCard
              key={block.id}
              block={block}
              index={index}
              anyComment={anyComment}
              isActive={activeBlockId === block.id}
              isDragging={draggingBlockId === block.id}
              onSelectBlock={onSelectBlock}
              onMoveBlock={onMoveBlock}
              onReorderBlock={onReorderBlock}
              draggingBlockId={draggingBlockId}
              setDraggingBlockId={setDraggingBlockId}
            />
          ))}
        </div>
        <ArrowRight className="hidden h-4 w-4 text-muted-foreground sm:block" />
        <FlowNode icon={MessageCircle} title="Response" subtitle="Reply + DM" />
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1 md:hidden">
        {blocks.map((block, index) => (
          <TriggerBlockCard
            key={block.id}
            block={block}
            index={index}
            anyComment={anyComment}
            isActive={activeBlockId === block.id}
            isDragging={draggingBlockId === block.id}
            onSelectBlock={onSelectBlock}
            onMoveBlock={onMoveBlock}
            onReorderBlock={onReorderBlock}
            draggingBlockId={draggingBlockId}
            setDraggingBlockId={setDraggingBlockId}
            compact
          />
        ))}
      </div>

      {activeBlock ? (
        <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold">Selected trigger</h3>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={anyComment} onClick={onAddBlock}>
                <Plus className="h-4 w-4" /> Add
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={blocks.length === 1}
                onClick={() => onRemoveBlock(activeBlock.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Trigger word</Label>
              <Input
                value={anyComment ? "ANY COMMENT" : activeBlock.keyword}
                onChange={(e) => onUpdateBlock(activeBlock.id, { keyword: e.target.value.toUpperCase() })}
                disabled={anyComment}
                placeholder="GUIDE"
                className="bg-input border-border"
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
              <div>
                <Label>Auto-reply</Label>
              </div>
              <Switch
                checked={activeBlock.autoReply}
                onCheckedChange={(checked) => onUpdateBlock(activeBlock.id, { autoReply: checked })}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-4">
            {activeBlock.autoReply ? (
              <div className="space-y-2">
                <Label>Reply message</Label>
                <Textarea
                  value={activeBlock.replyMessage}
                  onChange={(e) => onUpdateBlock(activeBlock.id, { replyMessage: e.target.value.slice(0, 140) })}
                  maxLength={140}
                  rows={2}
                  className="bg-input border-border resize-none"
                />
                <div className="text-right text-[11px] text-muted-foreground">{activeBlock.replyMessage.length}/140</div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>DM message</Label>
              <Textarea
                value={activeBlock.dmMessage}
                onChange={(e) => onUpdateBlock(activeBlock.id, { dmMessage: e.target.value.slice(0, 900) })}
                rows={4}
                className="bg-input border-border resize-none"
              />
              <div className="text-right text-[11px] text-muted-foreground">{activeBlock.dmMessage.length}/900</div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <Label>Button label</Label>
                <Input
                  value={activeBlock.dmButtonLabel}
                  onChange={(e) => onUpdateBlock(activeBlock.id, { dmButtonLabel: e.target.value.slice(0, 20) })}
                  placeholder="Open Link"
                  className="bg-input border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>Button URL</Label>
                <Input
                  value={activeBlock.dmButtonUrl}
                  onChange={(e) => onUpdateBlock(activeBlock.id, { dmButtonUrl: e.target.value })}
                  placeholder="https://..."
                  className="bg-input border-border"
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FlowNode({ icon: Icon, title, subtitle }: { icon: typeof MousePointer; title: string; subtitle: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        </div>
      </div>
    </div>
  );
}

function TriggerBlockCard({
  block,
  index,
  anyComment,
  isActive,
  isDragging,
  compact = false,
  draggingBlockId,
  setDraggingBlockId,
  onSelectBlock,
  onMoveBlock,
  onReorderBlock
}: {
  block: TriggerBlock;
  index: number;
  anyComment: boolean;
  isActive: boolean;
  isDragging: boolean;
  compact?: boolean;
  draggingBlockId: string | null;
  setDraggingBlockId: (blockId: string | null) => void;
  onSelectBlock: (blockId: string) => void;
  onMoveBlock: (blockId: string, direction: -1 | 1) => void;
  onReorderBlock: (draggedBlockId: string, targetBlockId: string) => void;
}) {
  return (
    <button
      type="button"
      draggable={!anyComment}
      onDragStart={() => setDraggingBlockId(block.id)}
      onDragEnd={() => setDraggingBlockId(null)}
      onDragOver={(event) => {
        if (!anyComment) {
          event.preventDefault();
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        if (draggingBlockId && draggingBlockId !== block.id) {
          onReorderBlock(draggingBlockId, block.id);
        }
        setDraggingBlockId(null);
      }}
      onClick={() => onSelectBlock(block.id)}
      className={cn(
        "group shrink-0 rounded-xl border bg-card text-left transition-all",
        compact ? "w-36 p-2.5" : "min-w-[160px] p-3",
        isActive ? "border-primary shadow-md shadow-primary/10" : "border-border hover:border-primary/50",
        isDragging && "opacity-50"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
          <GripVertical className="h-3.5 w-3.5" /> #{index + 1}
        </div>
        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              onMoveBlock(block.id, -1);
            }}
            className="rounded p-0.5 hover:bg-muted"
          >
            <ChevronUp className="h-3 w-3" />
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              onMoveBlock(block.id, 1);
            }}
            className="rounded p-0.5 hover:bg-muted"
          >
            <ChevronDown className="h-3 w-3" />
          </span>
        </div>
      </div>
      <div className="mt-1.5 truncate text-sm font-semibold">
        {anyComment ? "Any comment" : block.keyword || "New word"}
      </div>
      {!compact ? (
        <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">{block.dmMessage || "Auto DM message"}</div>
      ) : null}
    </button>
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
                  <img src={item.thumbnailUrl} alt={item.caption || "Instagram media"} className="absolute inset-0 h-full w-full object-cover" />
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
  const triggerLabel = anyComment ? "Any comment/reply" : activeBlock?.keyword || "Trigger word";
  const reply = activeBlock?.replyMessage.trim() || "Sent! Check your DMs";
  const dmMessage = activeBlock?.dmMessage ?? "";
  const dmButtonLabel = activeBlock?.dmButtonLabel ?? "";
  const dmButtonUrl = activeBlock?.dmButtonUrl ?? "";
  return (
    <aside className="space-y-3 xl:sticky xl:top-4">
      <section className="hidden rounded-xl border border-border bg-card p-3 shadow-lg sm:block">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Instagram preview</h3>
            <p className="text-xs text-muted-foreground">
              {postMode === "specific" ? "Specific media" : postMode === "next" ? "Next post/reel" : "Any post/reel"}
            </p>
          </div>
          <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">
            Live
          </span>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-background">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af]" />
            <span className="text-sm font-semibold">{username}</span>
          </div>
          <div className="relative aspect-[4/3] bg-muted xl:aspect-square">
            {selectedMedia?.thumbnailUrl ? (
              <img src={selectedMedia.thumbnailUrl} alt={selectedMedia.caption || "Instagram media"} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
                Select a reel/post to preview the trigger source.
              </div>
            )}
            <div className="absolute left-3 top-3 rounded-full bg-black/70 px-2 py-1 text-[10px] font-semibold uppercase text-white">
              {selectedMedia?.mediaType ?? "Preview"}
            </div>
          </div>
          <div className="space-y-2 p-3 text-sm">
            <div className="font-semibold">0 likes</div>
            <p>
              <span className="font-semibold">{username}</span>{" "}
              <span className="text-muted-foreground">{selectedMedia?.caption || "Your post caption appears here."}</span>
            </p>
            <div className="rounded-lg bg-muted p-2 text-xs">
              Trigger: <span className="font-medium text-foreground">{triggerLabel}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-3 shadow-lg">
        <h3 className="text-sm font-semibold">DM preview</h3>
        <div className="mt-3 rounded-2xl border border-border bg-background p-3">
          {activeBlock?.autoReply ? (
            <div className="mb-3 max-w-[85%] rounded-2xl rounded-tl-sm bg-muted p-3 text-sm">
              {reply}
            </div>
          ) : null}
          <div className="ml-auto max-w-[88%] rounded-2xl rounded-tr-sm bg-primary p-3 text-sm text-primary-foreground">
            <p className="whitespace-pre-wrap">{dmMessage.trim() || "Your DM message preview..."}</p>
            {dmButtonUrl.trim() ? (
              <div className="mt-2 rounded-full bg-background px-3 py-1.5 text-center text-xs font-semibold text-primary">
                {dmButtonLabel.trim() || "Open link"}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </aside>
  );
}

function LockedRow({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lock className="h-3.5 w-3.5" /> {text}
      </div>
      <button className="text-xs text-primary hover:underline">Upgrade to Pro</button>
    </div>
  );
}
