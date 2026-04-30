import { useEffect, useMemo, useState } from "react";
import { BarChart3, GripVertical, Plus, Trash2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { CopyField } from "@/components/CopyButton";
import { toast } from "@/components/ui/sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useCan } from "@/hooks/useCan";
import { useApp } from "@/state/AppContext";
import {
  useBioLinkAnalyticsQuery,
  useBioLinkQuery,
  useCreateBioLinkItemMutation,
  useDeleteBioLinkItemMutation,
  useReorderBioLinkItemsMutation,
  useUpdateBioLinkItemMutation,
  useUpdateBioLinkMutation,
  type BioLinkItem
} from "@/hooks/useBioLink";

const swatches = ["#7C6AF7", "#F97316", "#22C55E", "#EAB308", "#EF4444", "#34B7F1"];
const buttonStyles = [
  { key: "filled", label: "Filled" },
  { key: "outlined", label: "Outlined" },
  { key: "soft", label: "Soft" }
] as const;

const domainPrefix = "https://bio.reactova.com/";

type DraftLink = BioLinkItem;

export default function BioLink() {
  const { current, user } = useApp();
  const canUpdate = useCan("biolink", "update");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [deletedLinkIds, setDeletedLinkIds] = useState<string[]>([]);
  const [draft, setDraft] = useState({
    displayName: "",
    bio: "",
    accentColor: "#7C6AF7",
    slug: "",
    buttonStyle: "filled" as "filled" | "outlined" | "soft"
  });
  const [links, setLinks] = useState<DraftLink[]>([]);
  const profileQuery = useBioLinkQuery(current.id);
  const analyticsQuery = useBioLinkAnalyticsQuery(current.id, showAnalytics);
  const updateProfileMutation = useUpdateBioLinkMutation(current.id);
  const createLinkMutation = useCreateBioLinkItemMutation(current.id);
  const updateLinkMutation = useUpdateBioLinkItemMutation(current.id);
  const deleteLinkMutation = useDeleteBioLinkItemMutation(current.id);
  const reorderMutation = useReorderBioLinkItemsMutation(current.id);

  useEffect(() => {
    if (!profileQuery.data) {
      return;
    }
    setDraft({
      displayName: profileQuery.data.displayName,
      bio: profileQuery.data.bio ?? "",
      accentColor: profileQuery.data.accentColor,
      slug: profileQuery.data.slug || current.id,
      buttonStyle: profileQuery.data.buttonStyle
    });
    setLinks(profileQuery.data.links);
    setDeletedLinkIds([]);
  }, [current.id, profileQuery.data, user?.name]);

  const fullPublicUrl = useMemo(() => `${domainPrefix}${draft.slug || "your-slug"}`, [draft.slug]);

  const onSave = async () => {
    const invalidLink = links.find((link) => !isValidUrl(link.url));
    if (invalidLink) {
      toast.error("Please enter valid URLs for all links before saving");
      return;
    }

    await updateProfileMutation.mutateAsync({
      displayName: draft.displayName.trim() || user?.name || "Reactova User",
      bio: draft.bio.trim(),
      accentColor: draft.accentColor,
      buttonStyle: draft.buttonStyle,
      slug: draft.slug || current.id
    });

    for (const id of deletedLinkIds) {
      await deleteLinkMutation.mutateAsync(id);
    }

    const finalOrderIds: string[] = [];
    for (const link of links) {
      if (link.id.startsWith("local-")) {
        const created = await createLinkMutation.mutateAsync({
          title: link.title.trim() || "New Link",
          url: link.url
        });
        finalOrderIds.push(created.id);
        continue;
      }

      await updateLinkMutation.mutateAsync({
        id: link.id,
        title: link.title.trim() || "New Link",
        url: link.url
      });
      finalOrderIds.push(link.id);
    }

    if (finalOrderIds.length > 0) {
      await reorderMutation.mutateAsync(finalOrderIds);
    }

    setDeletedLinkIds([]);
    await profileQuery.refetch();
    toast.success("Bio link changes saved");
  };

  const onAddLink = () => {
    const localId = `local-${Date.now()}-${Math.round(Math.random() * 1000)}`;
    const created: DraftLink = {
      id: localId,
      title: "New Link",
      url: "https://",
      order: links.length,
      bioLinkId: ""
    };
    setLinks((prev) => [...prev, created]);
  };

  const onDragStart = (id: string) => setDraggingId(id);
  const onDragOver = (event: React.DragEvent, overId: string) => {
    event.preventDefault();
    if (!draggingId || draggingId === overId) {
      return;
    }
    setLinks((prev) => {
      const fromIndex = prev.findIndex((item) => item.id === draggingId);
      const toIndex = prev.findIndex((item) => item.id === overId);
      if (fromIndex < 0 || toIndex < 0) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next.map((item, index) => ({ ...item, order: index }));
    });
  };

  const onDrop = () => {
    setDraggingId(null);
  };

  return (
    <DashboardLayout title="Bio Link" subtitle="A simple landing page for your Instagram bio.">
      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-5">
          <Card title="Profile">
            <div className="flex gap-4 items-start">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-accent shrink-0" />
              <div className="flex-1 space-y-3">
                <div className="space-y-1.5">
                  <Label>Display name</Label>
                  <Input
                    value={draft.displayName}
                    onChange={(e) => setDraft((prev) => ({ ...prev, displayName: e.target.value }))}
                    className="bg-input border-border"
                    disabled={profileQuery.isLoading}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Public URL</Label>
                  <div className="flex items-center rounded-md border border-border bg-input">
                    <span className="px-3 text-sm text-muted-foreground">{domainPrefix}</span>
                    <Input
                      value={draft.slug}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          slug: normalizeSlug(event.target.value)
                        }))
                      }
                      className="border-0 bg-transparent focus-visible:ring-0"
                      placeholder={current.id}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    URL preview: <span className="font-mono">{fullPublicUrl}</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Bio</Label>
                  <Textarea
                    value={draft.bio}
                    onChange={(e) => setDraft((prev) => ({ ...prev, bio: e.target.value.slice(0, 160) }))}
                    rows={2}
                    maxLength={160}
                    className="bg-input border-border resize-none"
                  />
                  <div className="text-[11px] text-muted-foreground text-right">{draft.bio.length}/160</div>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Links">
            <div className="space-y-2">
              {links.map((l) => (
                <div
                  key={l.id}
                  draggable={canUpdate}
                  onDragStart={() => onDragStart(l.id)}
                  onDragOver={(event) => onDragOver(event, l.id)}
                  onDrop={onDrop}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg bg-background border border-border",
                    draggingId === l.id && "opacity-60"
                  )}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <Input
                      value={l.title}
                      onChange={(e) =>
                        setLinks((prev) =>
                          prev.map((item) => (item.id === l.id ? { ...item, title: e.target.value } : item))
                        )
                      }
                      className="bg-input border-border h-8 text-sm"
                    />
                    <Input
                      value={l.url}
                      onChange={(e) =>
                        setLinks((prev) =>
                          prev.map((item) => (item.id === l.id ? { ...item, url: e.target.value } : item))
                        )
                      }
                      className="bg-input border-border h-8 text-sm"
                    />
                  </div>
                  <button
                    className="p-1.5 text-muted-foreground hover:text-destructive disabled:opacity-40"
                    onClick={() => {
                      if (!l.id.startsWith("local-")) {
                        setDeletedLinkIds((prev) => (prev.includes(l.id) ? prev : [...prev, l.id]));
                      }
                      setLinks((prev) => prev.filter((item) => item.id !== l.id));
                    }}
                    disabled={!canUpdate}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button
                variant="outline"
                className="w-full"
                  onClick={onAddLink}
                disabled={!canUpdate}
              >
                <Plus className="h-4 w-4" /> Add Link
              </Button>
            </div>
          </Card>

          <Card title="Appearance">
            <div className="space-y-3">
              <div>
                <Label>Theme colour</Label>
                <div className="flex gap-2 mt-2">
                  {swatches.map((c) => (
                    <button
                      key={c}
                      onClick={() => setDraft((prev) => ({ ...prev, accentColor: c }))}
                      className={cn(
                        "h-8 w-8 rounded-full border-2 transition-all",
                        draft.accentColor === c ? "border-foreground scale-110" : "border-transparent"
                      )}
                      style={{ background: c }}
                    />
                  ))}
                  <Input
                    value={draft.accentColor}
                    onChange={(e) => setDraft((prev) => ({ ...prev, accentColor: e.target.value }))}
                    className="bg-input border-border h-8 w-28 text-xs font-mono"
                  />
                </div>
              </div>
              <div>
                <Label>Button style</Label>
                <div className="inline-flex p-1 rounded-lg bg-background border border-border mt-2">
                  {buttonStyles.map((style) => (
                    <button
                      key={style.key}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs",
                        draft.buttonStyle === style.key ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
                      )}
                      onClick={() => setDraft((prev) => ({ ...prev, buttonStyle: style.key }))}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            <CopyField value={fullPublicUrl} mono={false} />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setShowAnalytics((prev) => !prev)}>
                <BarChart3 className="h-4 w-4" /> View Analytics
              </Button>
              <Button onClick={onSave} disabled={!canUpdate || updateProfileMutation.isPending}>
                Save Changes
              </Button>
            </div>
            {showAnalytics && (
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="text-sm font-medium mb-2">
                  Total clicks: {(analyticsQuery.data?.totalClicks ?? profileQuery.data?.totalClicks ?? 0).toLocaleString()}
                </div>
                <div className="space-y-2">
                  {(analyticsQuery.data?.links ?? []).map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <span className="truncate pr-4">{item.title}</span>
                      <span className="font-mono text-muted-foreground">{item.clicks}</span>
                    </div>
                  ))}
                  {!analyticsQuery.isLoading && (analyticsQuery.data?.links.length ?? 0) === 0 && (
                    <div className="text-xs text-muted-foreground">No clicks yet.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="sticky top-24">
            <div className="text-xs text-muted-foreground mb-3 text-center">Live Preview</div>
            <div className="mx-auto w-[280px] rounded-[2.5rem] border-8 border-card bg-background shadow-2xl p-6 min-h-[480px]">
              <div className="flex flex-col items-center text-center">
                <div className="h-20 w-20 rounded-full mb-3" style={{ background: `linear-gradient(135deg, ${draft.accentColor}, hsl(var(--accent)))` }} />
                <div className="font-bold text-foreground">{draft.displayName || "Your name"}</div>
                <p className="text-xs text-muted-foreground mt-1">{draft.bio || "Tell people what you do."}</p>
                <div className="w-full mt-6 space-y-2">
                  {links.map((l) => (
                    <div
                      key={l.id}
                      className={cn("w-full text-xs font-medium py-2.5 px-3", getButtonClasses(draft.buttonStyle))}
                      style={getButtonStyle(draft.buttonStyle, draft.accentColor)}
                    >
                      {l.title}
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-muted-foreground mt-6">Powered by Reactova</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function getButtonClasses(style: "filled" | "outlined" | "soft") {
  if (style === "outlined") {
    return "rounded-lg border bg-transparent";
  }
  if (style === "soft") {
    return "rounded-2xl";
  }
  return "rounded-lg text-white";
}

function getButtonStyle(style: "filled" | "outlined" | "soft", color: string) {
  if (style === "outlined") {
    return { borderColor: color, color };
  }
  if (style === "soft") {
    return { background: `${color}26`, color };
  }
  return { background: color, color: "#fff" };
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-5 rounded-xl bg-card border border-border">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">{title}</h3>
      {children}
    </div>
  );
}
