import { useMemo, useState } from "react";
import { Plus, Edit, Trash2, X, Lock, Zap } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { useCan } from "@/hooks/useCan";
import { useAppSelector } from "@/store/hooks";
import { apiRequest } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

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
  followBeforeDm: boolean;
  status: AutomationStatus;
  createdAt: string;
  _count: { dmJobs: number };
};

type WizardData = {
  media: Array<{
    id: string;
    caption: string;
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

  return (
    <DashboardLayout title="Automations" subtitle="Convert comments into DMs on autopilot.">
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
          description="Create your first automation to start converting comments into DMs"
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

      {open && (
        <AutomationDrawer
          workspaceId={workspaceId}
          mode={editing ? "edit" : "create"}
          initial={editing}
          wizardData={wizardDataQuery.data}
          onClose={() => setOpen(false)}
          onSaved={async () => {
            await queryClient.invalidateQueries({ queryKey: ["automations", workspaceId] });
            setOpen(false);
            setEditing(null);
          }}
        />
      )}
    </DashboardLayout>
  );
}

function AutomationDrawer({
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
  const [keywords, setKeywords] = useState<string[]>(initial?.keywords ?? defaultForm.keywords);
  const [kw, setKw] = useState("");
  const [autoReply, setAutoReply] = useState(initial?.autoReply ?? defaultForm.autoReply);
  const [replies, setReplies] = useState(
    initial?.replyMessages.length ? initial.replyMessages : defaultForm.replyMessages
  );
  const [msg, setMsg] = useState(initial?.dmMessage ?? defaultForm.dmMessage);
  const [buttonLabel, setButtonLabel] = useState(initial?.dmButtonLabel ?? defaultForm.dmButtonLabel);
  const [buttonUrl, setButtonUrl] = useState(initial?.dmButtonUrl ?? defaultForm.dmButtonUrl);
  const [followBeforeDm, setFollowBeforeDm] = useState(initial?.followBeforeDm ?? defaultForm.followBeforeDm);
  const [postMode, setPostMode] = useState<PostMode>("specific");
  const [selectedPostId, setSelectedPostId] = useState<string | null>(initial?.postId ?? null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (targetStatus: AutomationStatus) => {
      const payload = {
        name: name.trim(),
        keywords: anyComment ? [] : keywords.map((item) => item.trim()).filter(Boolean),
        excludedKeywords: [],
        anyComment,
        postId: postMode === "specific" ? selectedPostId ?? undefined : undefined,
        dmMessage: msg.trim(),
        autoReply,
        replyMessages: autoReply ? replies.map((item) => item.trim()).filter(Boolean) : [],
        dmButtonLabel: buttonUrl.trim() ? buttonLabel.trim() || undefined : undefined,
        dmButtonUrl: buttonUrl.trim() || undefined,
        followBeforeDm,
        status: targetStatus
      };

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
    <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose}>
      <div
        className="absolute right-0 top-0 h-full w-full sm:w-[480px] bg-card border-l border-border flex flex-col animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold">{mode === "edit" ? "Edit Automation" : "Create Automation"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 scrollbar-thin">
          <Section title="Basics">
            <div className="space-y-2">
              <Label>Workflow name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-input border-border" />
            </div>
            <div className="flex items-center justify-between">
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
          </Section>

          <Section title="Trigger Keywords">
            <div className="space-y-2">
              <Label>Comment source</Label>
              <div className="inline-flex rounded-lg border border-border p-1">
                <button
                  type="button"
                  onClick={() => setPostMode("specific")}
                  className={`px-3 py-1 text-xs rounded-md ${postMode === "specific" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  Specific reel/post
                </button>
                <button
                  type="button"
                  onClick={() => setPostMode("any")}
                  className={`px-3 py-1 text-xs rounded-md ${postMode === "any" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  Any post/reel
                </button>
                <button
                  type="button"
                  onClick={() => setPostMode("next")}
                  className={`px-3 py-1 text-xs rounded-md ${postMode === "next" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  Next post/reel
                </button>
              </div>
            </div>
            {postMode === "specific" && (
              <div className="grid grid-cols-3 gap-2">
                {(wizardData?.media ?? []).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedPostId(item.id)}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 ${selectedPostId === item.id ? "border-primary" : "border-border"}`}
                  >
                    {item.thumbnailUrl ? (
                      <img src={item.thumbnailUrl} alt={item.caption || "Instagram media"} className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 bg-muted" />
                    )}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label>Any comment trigger</Label>
              <Switch checked={anyComment} onCheckedChange={setAnyComment} />
            </div>
            <div className="flex gap-2">
              <Input value={kw} onChange={(e) => setKw(e.target.value)} onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); if (kw.trim()) { setKeywords([...keywords, kw.trim().toUpperCase()]); setKw(""); } }
              }} placeholder="Type & press Enter" className="bg-input border-border" disabled={anyComment} />
              <Button variant="outline" disabled={anyComment} onClick={() => { if (kw.trim()) { setKeywords([...keywords, kw.trim().toUpperCase()]); setKw(""); } }}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((k) => (
                <span key={k} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-xs">
                  {k}
                  <button onClick={() => setKeywords(keywords.filter((x) => x !== k))}>
                    <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Anyone who comments these words will receive your DM</p>
          </Section>

          <Section title="Auto-Reply to Comment (optional)">
            <div className="flex items-center justify-between">
              <Label>Auto-reply enabled</Label>
              <Switch checked={autoReply} onCheckedChange={setAutoReply} />
            </div>
            {autoReply && replies.map((reply, idx) => (
              <Textarea
                key={idx}
                value={reply}
                onChange={(e) => {
                  const next = [...replies];
                  next[idx] = e.target.value.slice(0, 140);
                  setReplies(next);
                }}
                placeholder={`Comment response ${idx + 1}`}
                maxLength={140}
                rows={2}
                className="bg-input border-border resize-none"
              />
            ))}
          </Section>

          <Section title="DM Message">
            <Textarea value={msg} onChange={(e) => setMsg(e.target.value.slice(0, 900))} rows={4} className="bg-input border-border resize-none" />
            <div className="text-[11px] text-muted-foreground text-right">{msg.length}/900</div>
            <div className="grid gap-2">
              <Input
                value={buttonLabel}
                onChange={(e) => setButtonLabel(e.target.value.slice(0, 20))}
                placeholder="Button label (optional, max 20 chars for Instagram)"
                className="bg-input border-border"
              />
              <div className="text-[11px] text-muted-foreground text-right">{buttonLabel.length}/20</div>
              <Input value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} placeholder="Button URL (https://…)" className="bg-input border-border" />
            </div>

            <div className="mt-3 p-3 rounded-xl bg-background border border-border">
              <div className="text-xs text-muted-foreground mb-2">Preview</div>
              <div className="rounded-2xl rounded-tl-sm bg-muted p-3 max-w-[85%] space-y-2">
                <p className="text-sm whitespace-pre-wrap">{msg}</p>
                {buttonUrl.trim() ? (
                  <div className="pt-1">
                    <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-primary">
                      {buttonLabel.trim() || "Open link"}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </Section>

          <Section title="Advanced (Pro+)">
            <div className="p-4 rounded-xl border border-border bg-background space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" /> Follow Before DM
                </div>
                <Switch checked={followBeforeDm} onCheckedChange={setFollowBeforeDm} />
              </div>
              <LockedRow text="DM Follow-up Sequences" />
            </div>
          </Section>
        </div>

        <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
          <Button variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate("DRAFT")}>
            Save Draft
          </Button>
          <Button
            disabled={mutation.isPending || (postMode === "specific" && !selectedPostId)}
            onClick={() => mutation.mutate(status)}
          >
            {mutation.isPending ? "Saving..." : mode === "edit" ? "Update Automation" : "Save & Activate"}
          </Button>
        </div>
      </div>
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
