import { useEffect, useMemo, useState, type CSSProperties } from "react";
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
  useCreateBioLinkSocialMutation,
  useDeleteBioLinkItemMutation,
  useDeleteBioLinkSocialMutation,
  useResetBioLinkMutation,
  useReorderBioLinkItemsMutation,
  useReorderBioLinkSocialsMutation,
  useUpdateBioLinkItemMutation,
  useUpdateBioLinkSocialMutation,
  useUpdateBioLinkMutation,
  type BioLinkItem,
  type BioLinkSocialItem
} from "@/hooks/useBioLink";

const swatches = ["#7C6AF7", "#F97316", "#22C55E", "#EAB308", "#EF4444", "#34B7F1", "#0EA5E9", "#14B8A6"];
const buttonStyles = [
  { key: "filled", label: "Filled" },
  { key: "outlined", label: "Outlined" },
  { key: "soft", label: "Soft" }
] as const;

const domainPrefix = "https://bio.reactova.com/";

type DraftLink = BioLinkItem & { bioLinkId?: string };
type DraftSocial = BioLinkSocialItem & { bioLinkId?: string };
type TemplateStyle = {
  accentColor: string;
  buttonStyle: "filled" | "outlined" | "soft";
  backgroundType: "solid" | "gradient";
  backgroundColor: string;
  backgroundColorTo: string;
  textColor: string;
  cardStyle: "solid" | "glass" | "outline";
  cardColor: string;
  cardOpacity: number;
  fontFamily: "inter" | "poppins" | "space-grotesk" | "playfair";
  buttonTextColor: string;
  buttonRadius: number;
  buttonBorderWidth: number;
  buttonShadow: boolean;
};

const bioTemplates: Array<{ id: string; name: string; style: TemplateStyle }> = [
  {
    id: "aurora-splash",
    name: "Aurora Splash",
    style: {
      accentColor: "#22D3EE", buttonStyle: "soft", backgroundType: "gradient", backgroundColor: "#14532D", backgroundColorTo: "#0EA5E9",
      textColor: "#E0F2FE", cardStyle: "glass", cardColor: "#0F172A", cardOpacity: 52, fontFamily: "space-grotesk", buttonTextColor: "#ECFEFF",
      buttonRadius: 16, buttonBorderWidth: 1, buttonShadow: true
    }
  },
  {
    id: "starfield-dark",
    name: "Starfield Dark",
    style: {
      accentColor: "#FFFFFF", buttonStyle: "outlined", backgroundType: "gradient", backgroundColor: "#020617", backgroundColorTo: "#111827",
      textColor: "#FFFFFF", cardStyle: "glass", cardColor: "#0B1120", cardOpacity: 40, fontFamily: "inter", buttonTextColor: "#FFFFFF",
      buttonRadius: 20, buttonBorderWidth: 2, buttonShadow: true
    }
  },
  {
    id: "berry-burst",
    name: "Berry Burst",
    style: {
      accentColor: "#F43F5E", buttonStyle: "filled", backgroundType: "gradient", backgroundColor: "#7E22CE", backgroundColorTo: "#2563EB",
      textColor: "#FFFFFF", cardStyle: "solid", cardColor: "#9333EA", cardOpacity: 55, fontFamily: "poppins", buttonTextColor: "#FFFFFF",
      buttonRadius: 18, buttonBorderWidth: 0, buttonShadow: true
    }
  },
  {
    id: "sage-grid",
    name: "Sage Grid",
    style: {
      accentColor: "#0F172A", buttonStyle: "outlined", backgroundType: "solid", backgroundColor: "#C4D39A", backgroundColorTo: "#C4D39A",
      textColor: "#111827", cardStyle: "outline", cardColor: "#A3B18A", cardOpacity: 100, fontFamily: "playfair", buttonTextColor: "#111827",
      buttonRadius: 16, buttonBorderWidth: 2, buttonShadow: false
    }
  },
  {
    id: "mono-ink",
    name: "Mono Ink",
    style: {
      accentColor: "#FFFFFF", buttonStyle: "outlined", backgroundType: "gradient", backgroundColor: "#030712", backgroundColorTo: "#020617",
      textColor: "#FFFFFF", cardStyle: "outline", cardColor: "#374151", cardOpacity: 60, fontFamily: "inter", buttonTextColor: "#FFFFFF",
      buttonRadius: 10, buttonBorderWidth: 1, buttonShadow: false
    }
  },
  {
    id: "sand-studio",
    name: "Sand Studio",
    style: {
      accentColor: "#111827", buttonStyle: "outlined", backgroundType: "solid", backgroundColor: "#FFF7ED", backgroundColorTo: "#FFF7ED",
      textColor: "#1F2937", cardStyle: "solid", cardColor: "#FFFBEB", cardOpacity: 100, fontFamily: "poppins", buttonTextColor: "#111827",
      buttonRadius: 14, buttonBorderWidth: 1, buttonShadow: false
    }
  },
  {
    id: "frost-light",
    name: "Frost Light",
    style: {
      accentColor: "#0EA5E9", buttonStyle: "soft", backgroundType: "solid", backgroundColor: "#E0F2FE", backgroundColorTo: "#E0F2FE",
      textColor: "#0F172A", cardStyle: "glass", cardColor: "#FFFFFF", cardOpacity: 75, fontFamily: "inter", buttonTextColor: "#0F172A",
      buttonRadius: 12, buttonBorderWidth: 0, buttonShadow: false
    }
  },
  {
    id: "royal-indigo",
    name: "Royal Indigo",
    style: {
      accentColor: "#8B5CF6", buttonStyle: "outlined", backgroundType: "gradient", backgroundColor: "#1E1B4B", backgroundColorTo: "#4C1D95",
      textColor: "#EDE9FE", cardStyle: "glass", cardColor: "#312E81", cardOpacity: 58, fontFamily: "playfair", buttonTextColor: "#DDD6FE",
      buttonRadius: 18, buttonBorderWidth: 1, buttonShadow: true
    }
  },
  {
    id: "crimson-neon",
    name: "Crimson Neon",
    style: {
      accentColor: "#F43F5E", buttonStyle: "soft", backgroundType: "gradient", backgroundColor: "#0F172A", backgroundColorTo: "#7F1D1D",
      textColor: "#FEE2E2", cardStyle: "outline", cardColor: "#F43F5E", cardOpacity: 35, fontFamily: "space-grotesk", buttonTextColor: "#FECACA",
      buttonRadius: 16, buttonBorderWidth: 1, buttonShadow: true
    }
  },
  {
    id: "pearl-minimal",
    name: "Pearl Minimal",
    style: {
      accentColor: "#111827", buttonStyle: "filled", backgroundType: "solid", backgroundColor: "#FFFFFF", backgroundColorTo: "#FFFFFF",
      textColor: "#111827", cardStyle: "solid", cardColor: "#F8FAFC", cardOpacity: 100, fontFamily: "inter", buttonTextColor: "#FFFFFF",
      buttonRadius: 999, buttonBorderWidth: 0, buttonShadow: false
    }
  },
  {
    id: "ocean-electric",
    name: "Ocean Electric",
    style: {
      accentColor: "#06B6D4", buttonStyle: "filled", backgroundType: "gradient", backgroundColor: "#082F49", backgroundColorTo: "#0EA5E9",
      textColor: "#ECFEFF", cardStyle: "glass", cardColor: "#0C4A6E", cardOpacity: 66, fontFamily: "poppins", buttonTextColor: "#FFFFFF",
      buttonRadius: 12, buttonBorderWidth: 0, buttonShadow: true
    }
  },
  {
    id: "forest-night",
    name: "Forest Night",
    style: {
      accentColor: "#22C55E", buttonStyle: "soft", backgroundType: "gradient", backgroundColor: "#052E16", backgroundColorTo: "#166534",
      textColor: "#ECFDF5", cardStyle: "solid", cardColor: "#14532D", cardOpacity: 78, fontFamily: "space-grotesk", buttonTextColor: "#BBF7D0",
      buttonRadius: 14, buttonBorderWidth: 0, buttonShadow: false
    }
  },
  {
    id: "sunset-haze",
    name: "Sunset Haze",
    style: {
      accentColor: "#F97316", buttonStyle: "filled", backgroundType: "gradient", backgroundColor: "#7C2D12", backgroundColorTo: "#FDBA74",
      textColor: "#FFF7ED", cardStyle: "glass", cardColor: "#9A3412", cardOpacity: 62, fontFamily: "poppins", buttonTextColor: "#FFFFFF",
      buttonRadius: 16, buttonBorderWidth: 0, buttonShadow: true
    }
  }
];

export default function BioLink() {
  const { current, user } = useApp();
  const canUpdate = useCan("biolink", "update");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingSection, setDraggingSection] = useState<"links" | "socials" | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [deletedLinkIds, setDeletedLinkIds] = useState<string[]>([]);
  const [deletedSocialIds, setDeletedSocialIds] = useState<string[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    displayName: "",
    bio: "",
    accentColor: "#7C6AF7",
    slug: "",
    buttonStyle: "filled" as "filled" | "outlined" | "soft",
    backgroundType: "solid" as "solid" | "gradient",
    backgroundColor: "#0B1020",
    backgroundColorTo: "#1E293B",
    textColor: "#FFFFFF",
    cardStyle: "solid" as "solid" | "glass" | "outline",
    cardColor: "#111827",
    cardOpacity: 85,
    fontFamily: "inter" as "inter" | "poppins" | "space-grotesk" | "playfair",
    avatarUrl: "",
    buttonTextColor: "#FFFFFF",
    buttonRadius: 12,
    buttonBorderWidth: 0,
    buttonShadow: false,
    socialLayout: "horizontal" as "horizontal" | "vertical",
    sectionOrder: ["links", "socials"] as Array<"links" | "socials">
  });
  const [links, setLinks] = useState<DraftLink[]>([]);
  const [socials, setSocials] = useState<DraftSocial[]>([]);
  const profileQuery = useBioLinkQuery(current.id);
  const analyticsQuery = useBioLinkAnalyticsQuery(current.id, showAnalytics);
  const updateProfileMutation = useUpdateBioLinkMutation(current.id);
  const createLinkMutation = useCreateBioLinkItemMutation(current.id);
  const updateLinkMutation = useUpdateBioLinkItemMutation(current.id);
  const deleteLinkMutation = useDeleteBioLinkItemMutation(current.id);
  const reorderMutation = useReorderBioLinkItemsMutation(current.id);
  const createSocialMutation = useCreateBioLinkSocialMutation(current.id);
  const updateSocialMutation = useUpdateBioLinkSocialMutation(current.id);
  const deleteSocialMutation = useDeleteBioLinkSocialMutation(current.id);
  const reorderSocialsMutation = useReorderBioLinkSocialsMutation(current.id);
  const resetBioLinkMutation = useResetBioLinkMutation(current.id);

  useEffect(() => {
    if (!profileQuery.data) {
      return;
    }
    setDraft({
      displayName: profileQuery.data.displayName,
      bio: profileQuery.data.bio ?? "",
      accentColor: profileQuery.data.accentColor,
      slug: profileQuery.data.slug || current.id,
      buttonStyle: profileQuery.data.buttonStyle,
      backgroundType: profileQuery.data.backgroundType,
      backgroundColor: profileQuery.data.backgroundColor,
      backgroundColorTo: profileQuery.data.backgroundColorTo,
      textColor: profileQuery.data.textColor,
      cardStyle: profileQuery.data.cardStyle,
      cardColor: profileQuery.data.cardColor,
      cardOpacity: profileQuery.data.cardOpacity,
      fontFamily: profileQuery.data.fontFamily,
      avatarUrl: profileQuery.data.avatarUrl ?? "",
      buttonTextColor: profileQuery.data.buttonTextColor,
      buttonRadius: profileQuery.data.buttonRadius,
      buttonBorderWidth: profileQuery.data.buttonBorderWidth,
      buttonShadow: profileQuery.data.buttonShadow,
      socialLayout: profileQuery.data.socialLayout,
      sectionOrder: profileQuery.data.sectionOrder?.length ? profileQuery.data.sectionOrder : ["links", "socials"]
    });
    setLinks(profileQuery.data.links);
    setSocials(profileQuery.data.socials ?? []);
    setDeletedLinkIds([]);
    setDeletedSocialIds([]);
  }, [current.id, profileQuery.data, user?.name]);

  const fullPublicUrl = useMemo(() => `${domainPrefix}${draft.slug || "your-slug"}`, [draft.slug]);

  const onSave = async () => {
    const invalidLink = links.find((link) => !isValidUrl(link.url));
    if (invalidLink) {
      toast.error("Please enter valid URLs for all links before saving");
      return;
    }
    const invalidSocial = socials.find((item) => !isValidUrl(item.url));
    if (invalidSocial) {
      toast.error("Please enter valid URLs for all socials before saving");
      return;
    }

    await updateProfileMutation.mutateAsync({
      displayName: draft.displayName.trim() || user?.name || "Reactova User",
      bio: draft.bio.trim(),
      accentColor: draft.accentColor,
      buttonStyle: draft.buttonStyle,
      slug: draft.slug || current.id,
      backgroundType: draft.backgroundType,
      backgroundColor: draft.backgroundColor,
      backgroundColorTo: draft.backgroundColorTo,
      textColor: draft.textColor,
      cardStyle: draft.cardStyle,
      cardColor: draft.cardColor,
      cardOpacity: draft.cardOpacity,
      fontFamily: draft.fontFamily,
      avatarUrl: draft.avatarUrl,
      buttonTextColor: draft.buttonTextColor,
      buttonRadius: draft.buttonRadius,
      buttonBorderWidth: draft.buttonBorderWidth,
      buttonShadow: draft.buttonShadow,
      socialLayout: draft.socialLayout,
      sectionOrder: draft.sectionOrder
    });

    for (const id of deletedLinkIds) {
      await deleteLinkMutation.mutateAsync(id);
    }
    for (const id of deletedSocialIds) {
      await deleteSocialMutation.mutateAsync(id);
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
    const finalSocialOrderIds: string[] = [];
    for (const item of socials) {
      if (item.id.startsWith("local-social-")) {
        const created = await createSocialMutation.mutateAsync({
          label: item.label.trim() || "Social",
          url: item.url,
          icon: item.icon ?? undefined,
          emoji: item.emoji ?? undefined,
          platform: item.platform ?? "custom",
          mode: item.mode ?? "link"
        });
        finalSocialOrderIds.push(created.id);
        continue;
      }
      await updateSocialMutation.mutateAsync({
        id: item.id,
        label: item.label.trim() || "Social",
        url: item.url,
        icon: item.icon ?? undefined,
        emoji: item.emoji ?? undefined,
        platform: item.platform ?? "custom",
        mode: item.mode ?? "link"
      });
      finalSocialOrderIds.push(item.id);
    }
    if (finalSocialOrderIds.length > 0) {
      await reorderSocialsMutation.mutateAsync(finalSocialOrderIds);
    }

    setDeletedLinkIds([]);
    setDeletedSocialIds([]);
    await profileQuery.refetch();
    toast.success("Bio link changes saved");
  };

  const applyTemplate = (templateId: string) => {
    const template = bioTemplates.find((item) => item.id === templateId);
    if (!template) {
      return;
    }
    setSelectedTemplateId(templateId);
    setDraft((prev) => ({ ...prev, ...template.style }));
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
  const onAddSocial = () => {
    const localId = `local-social-${Date.now()}-${Math.round(Math.random() * 1000)}`;
    setSocials((prev) => [
      ...prev,
      {
        id: localId,
        label: "Instagram",
        url: "https://instagram.com",
        icon: "instagram",
        emoji: "📸",
        platform: "instagram",
        mode: "profile",
        order: prev.length,
        bioLinkId: ""
      }
    ]);
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
  const onSocialDragOver = (event: React.DragEvent, overId: string) => {
    event.preventDefault();
    if (!draggingId || draggingId === overId) return;
    setSocials((prev) => {
      const fromIndex = prev.findIndex((item) => item.id === draggingId);
      const toIndex = prev.findIndex((item) => item.id === overId);
      if (fromIndex < 0 || toIndex < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next.map((item, index) => ({ ...item, order: index }));
    });
  };
  const onSectionDrop = (target: "links" | "socials") => {
    if (!draggingSection || draggingSection === target) return;
    setDraft((prev) => {
      const next = [...prev.sectionOrder];
      const fromIndex = next.indexOf(draggingSection);
      const toIndex = next.indexOf(target);
      if (fromIndex < 0 || toIndex < 0) return prev;
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, draggingSection);
      return { ...prev, sectionOrder: next as Array<"links" | "socials"> };
    });
    setDraggingSection(null);
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

          <Card title="Templates">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {bioTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => applyTemplate(template.id)}
                  className={cn(
                    "rounded-xl border p-2 text-left transition-all",
                    selectedTemplateId === template.id ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"
                  )}
                >
                  <div
                    className="rounded-lg p-2 h-24"
                    style={{
                      background:
                        template.style.backgroundType === "gradient"
                          ? `linear-gradient(135deg, ${template.style.backgroundColor}, ${template.style.backgroundColorTo})`
                          : template.style.backgroundColor
                    }}
                  >
                    <div className="h-3 w-10 rounded-full mb-2" style={{ background: template.style.accentColor }} />
                    <div className="space-y-1">
                      <div className="h-2 w-full rounded-full bg-white/50" />
                      <div className="h-2 w-4/5 rounded-full bg-white/35" />
                    </div>
                  </div>
                  <div className="text-xs font-medium mt-2">{template.name}</div>
                </button>
              ))}
            </div>
          </Card>

          {draft.sectionOrder.map((section) =>
            section === "links" ? (
              <div
                key="section-links"
                draggable
                onDragStart={() => setDraggingSection("links")}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onSectionDrop("links")}
              >
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
                    <Button variant="outline" className="w-full" onClick={onAddLink} disabled={!canUpdate}>
                      <Plus className="h-4 w-4" /> Add Link
                    </Button>
                  </div>
                </Card>
              </div>
            ) : (
              <div
                key="section-socials"
                draggable
                onDragStart={() => setDraggingSection("socials")}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onSectionDrop("socials")}
              >
                <Card title="Socials">
                  <div className="space-y-2">
                    {socials.map((item) => (
                      <div
                        key={item.id}
                        draggable={canUpdate}
                        onDragStart={() => onDragStart(item.id)}
                        onDragOver={(event) => onSocialDragOver(event, item.id)}
                        onDrop={onDrop}
                        className={cn(
                          "grid grid-cols-[auto,1fr,1fr,auto] gap-2 items-center p-2 rounded-lg bg-background border border-border",
                          draggingId === item.id && "opacity-60"
                        )}
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                        <Input
                          value={item.emoji ?? ""}
                          onChange={(e) =>
                            setSocials((prev) => prev.map((s) => (s.id === item.id ? { ...s, emoji: e.target.value } : s)))
                          }
                          placeholder="😀 or icon key"
                          className="bg-input border-border h-8 text-sm"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            value={item.label}
                            onChange={(e) =>
                              setSocials((prev) => prev.map((s) => (s.id === item.id ? { ...s, label: e.target.value } : s)))
                            }
                            className="bg-input border-border h-8 text-sm"
                          />
                          <Input
                            value={item.url}
                            onChange={(e) =>
                              setSocials((prev) => prev.map((s) => (s.id === item.id ? { ...s, url: e.target.value } : s)))
                            }
                            disabled={item.platform === "instagram" && (item.mode === "posts" || item.mode === "reels")}
                            className="bg-input border-border h-8 text-sm"
                          />
                          <select
                            value={item.platform ?? "custom"}
                            onChange={(e) =>
                              setSocials((prev) =>
                                prev.map((s) =>
                                  s.id === item.id
                                    ? {
                                        ...s,
                                        platform: e.target.value as "custom" | "instagram",
                                        mode: e.target.value === "instagram" ? "profile" : "link",
                                        emoji: e.target.value === "instagram" ? "📸" : s.emoji
                                      }
                                    : s
                                )
                              )
                            }
                            className="h-8 rounded-md border border-border bg-input px-2 text-xs"
                          >
                            <option value="instagram">Instagram</option>
                            <option value="custom">Custom</option>
                          </select>
                          <select
                            value={item.mode ?? "link"}
                            onChange={(e) =>
                              setSocials((prev) =>
                                prev.map((s) =>
                                  s.id === item.id
                                    ? {
                                        ...s,
                                        mode: e.target.value as "link" | "profile" | "posts" | "reels",
                                        url:
                                          s.platform === "instagram" &&
                                          (e.target.value === "posts" || e.target.value === "reels" || e.target.value === "profile")
                                            ? "https://instagram.com"
                                            : s.url
                                      }
                                    : s
                                )
                              )
                            }
                            className="h-8 rounded-md border border-border bg-input px-2 text-xs"
                          >
                            <option value="link">Link</option>
                            {item.platform === "instagram" && <option value="profile">IG Profile</option>}
                            {item.platform === "instagram" && <option value="posts">IG Posts Grid</option>}
                            {item.platform === "instagram" && <option value="reels">IG Reels Grid</option>}
                          </select>
                        </div>
                        <button
                          className="p-1.5 text-muted-foreground hover:text-destructive disabled:opacity-40"
                          onClick={() => {
                            if (!item.id.startsWith("local-social-")) {
                              setDeletedSocialIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
                            }
                            setSocials((prev) => prev.filter((s) => s.id !== item.id));
                          }}
                          disabled={!canUpdate}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        {item.platform === "instagram" && (item.mode === "posts" || item.mode === "reels") && (
                          <div className="col-span-4 text-[11px] text-muted-foreground">
                            Uses connected Instagram account content ({item.mode}).
                          </div>
                        )}
                      </div>
                    ))}
                    <Button variant="outline" className="w-full" onClick={onAddSocial} disabled={!canUpdate}>
                      <Plus className="h-4 w-4" /> Add Social
                    </Button>
                  </div>
                </Card>
              </div>
            )
          )}

          <Card title="Appearance">
            <div className="space-y-4">
              <div>
                <Label>Accent color</Label>
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Text color</Label>
                  <Input
                    value={draft.textColor}
                    onChange={(e) => setDraft((prev) => ({ ...prev, textColor: e.target.value }))}
                    className="bg-input border-border h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Button text color</Label>
                  <Input
                    value={draft.buttonTextColor}
                    onChange={(e) => setDraft((prev) => ({ ...prev, buttonTextColor: e.target.value }))}
                    className="bg-input border-border h-8 text-xs font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Background type</Label>
                  <select
                    value={draft.backgroundType}
                    onChange={(e) => setDraft((prev) => ({ ...prev, backgroundType: e.target.value as "solid" | "gradient" }))}
                    className="h-9 rounded-md border border-border bg-input px-2 text-sm w-full"
                  >
                    <option value="solid">Solid</option>
                    <option value="gradient">Gradient</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Font</Label>
                  <select
                    value={draft.fontFamily}
                    onChange={(e) => setDraft((prev) => ({ ...prev, fontFamily: e.target.value as typeof draft.fontFamily }))}
                    className="h-9 rounded-md border border-border bg-input px-2 text-sm w-full"
                  >
                    <option value="inter">Inter</option>
                    <option value="poppins">Poppins</option>
                    <option value="space-grotesk">Space Grotesk</option>
                    <option value="playfair">Playfair</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Background color</Label>
                  <Input
                    value={draft.backgroundColor}
                    onChange={(e) => setDraft((prev) => ({ ...prev, backgroundColor: e.target.value }))}
                    className="bg-input border-border h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Gradient end color</Label>
                  <Input
                    value={draft.backgroundColorTo}
                    onChange={(e) => setDraft((prev) => ({ ...prev, backgroundColorTo: e.target.value }))}
                    className="bg-input border-border h-8 text-xs font-mono"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Avatar image URL (optional)</Label>
                <Input
                  value={draft.avatarUrl}
                  onChange={(e) => setDraft((prev) => ({ ...prev, avatarUrl: e.target.value }))}
                  placeholder="https://..."
                  className="bg-input border-border"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Card style</Label>
                  <select
                    value={draft.cardStyle}
                    onChange={(e) => setDraft((prev) => ({ ...prev, cardStyle: e.target.value as "solid" | "glass" | "outline" }))}
                    className="h-9 rounded-md border border-border bg-input px-2 text-sm w-full"
                  >
                    <option value="solid">Solid</option>
                    <option value="glass">Glass</option>
                    <option value="outline">Outline</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Card color</Label>
                  <Input
                    value={draft.cardColor}
                    onChange={(e) => setDraft((prev) => ({ ...prev, cardColor: e.target.value }))}
                    className="bg-input border-border h-8 text-xs font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Card opacity</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={draft.cardOpacity}
                    onChange={(e) => setDraft((prev) => ({ ...prev, cardOpacity: Number(e.target.value) || 0 }))}
                    className="bg-input border-border h-8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Button radius</Label>
                  <Input
                    type="number"
                    min={0}
                    max={999}
                    value={draft.buttonRadius}
                    onChange={(e) => setDraft((prev) => ({ ...prev, buttonRadius: Number(e.target.value) || 0 }))}
                    className="bg-input border-border h-8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Border width</Label>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    value={draft.buttonBorderWidth}
                    onChange={(e) => setDraft((prev) => ({ ...prev, buttonBorderWidth: Number(e.target.value) || 0 }))}
                    className="bg-input border-border h-8"
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
              <div>
                <Label>Social layout</Label>
                <div className="inline-flex p-1 rounded-lg bg-background border border-border mt-2">
                  {(["horizontal", "vertical"] as const).map((layout) => (
                    <button
                      key={layout}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs capitalize",
                        draft.socialLayout === layout ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
                      )}
                      onClick={() => setDraft((prev) => ({ ...prev, socialLayout: layout }))}
                    >
                      {layout}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={draft.buttonShadow}
                  onChange={(e) => setDraft((prev) => ({ ...prev, buttonShadow: e.target.checked }))}
                />
                Enable button shadow
              </label>
            </div>
          </Card>

          <div className="space-y-3">
            <CopyField value={fullPublicUrl} mono={false} />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setShowAnalytics((prev) => !prev)}>
                <BarChart3 className="h-4 w-4" /> View Analytics
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  await resetBioLinkMutation.mutateAsync();
                  await profileQuery.refetch();
                }}
                disabled={resetBioLinkMutation.isPending}
              >
                Reset to Defaults
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
            <div className="mx-auto w-[280px] rounded-[2.5rem] border-8 border-card shadow-2xl p-4 min-h-[480px] overflow-hidden" style={getPhoneBackgroundStyle(draft)}>
              <div className="rounded-2xl p-5 h-full min-h-[440px]" style={getCardWrapperStyle(draft)}>
                <div className="flex flex-col items-center text-center h-full" style={{ color: draft.textColor, fontFamily: getFontFamily(draft.fontFamily) }}>
                  {draft.avatarUrl ? (
                    <img src={resolveAvatarUrl(draft.avatarUrl)} alt="Avatar" className="h-20 w-20 rounded-full mb-3 object-cover border border-white/20" />
                  ) : (
                    <div className="h-20 w-20 rounded-full mb-3" style={{ background: `linear-gradient(135deg, ${draft.accentColor}, hsl(var(--accent)))` }} />
                  )}
                  <div className="font-bold">{draft.displayName || "Your name"}</div>
                  <p className="text-xs mt-1 opacity-90">{draft.bio || "Tell people what you do."}</p>
                  <div className="w-full mt-6 space-y-3">
                    {draft.sectionOrder.map((section) =>
                      section === "links" ? (
                        <div key="preview-links" className="space-y-2">
                          {links.map((l) => (
                            <div
                              key={l.id}
                              className={cn("w-full text-xs font-medium py-2.5 px-3", getButtonClasses(draft.buttonStyle))}
                              style={getButtonStyle(draft)}
                            >
                              {l.title}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div
                          key="preview-socials"
                          className={cn(
                            draft.socialLayout === "horizontal" ? "flex flex-wrap justify-center gap-2" : "flex flex-col gap-2"
                          )}
                        >
                          {socials.map((item) => (
                            <div
                              key={item.id}
                              className={cn(
                                "text-xs font-medium px-3 py-2 inline-flex items-center justify-center gap-1",
                                getButtonClasses(draft.buttonStyle),
                                draft.socialLayout === "horizontal" ? "min-w-[72px]" : "w-full"
                              )}
                              style={getButtonStyle(draft)}
                            >
                              <span>{item.emoji || "🔗"}</span>
                              <span>{item.label}</span>
                            </div>
                          ))}
                        </div>
                      )
                    )}
                  </div>
                  <div className="text-[10px] mt-auto pt-6 opacity-80">Powered by Reactova</div>
                </div>
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

function getButtonStyle(draft: {
  buttonStyle: "filled" | "outlined" | "soft";
  accentColor: string;
  buttonTextColor: string;
  buttonRadius: number;
  buttonBorderWidth: number;
  buttonShadow: boolean;
}): CSSProperties {
  const base: CSSProperties = {
    borderRadius: `${draft.buttonRadius}px`,
    borderWidth: `${draft.buttonBorderWidth}px`,
    borderStyle: "solid",
    boxShadow: draft.buttonShadow ? "0 8px 20px rgba(0,0,0,0.25)" : "none"
  };

  if (draft.buttonStyle === "outlined") {
    return { ...base, borderColor: draft.accentColor, color: draft.accentColor, background: "transparent" };
  }
  if (draft.buttonStyle === "soft") {
    return { ...base, background: `${draft.accentColor}26`, color: draft.buttonTextColor || draft.accentColor, borderColor: "transparent" };
  }
  return { ...base, background: draft.accentColor, color: draft.buttonTextColor, borderColor: "transparent" };
}

function getCardWrapperStyle(draft: {
  backgroundType: "solid" | "gradient";
  backgroundColor: string;
  backgroundColorTo: string;
  cardStyle: "solid" | "glass" | "outline";
  cardColor: string;
  cardOpacity: number;
}): CSSProperties {
  if (draft.cardStyle === "glass") {
    return {
      background: "rgba(15, 23, 42, 0.32)",
      border: "1px solid rgba(255,255,255,0.2)",
      backdropFilter: "blur(10px)"
    };
  }
  if (draft.cardStyle === "outline") {
    return {
      background: "transparent",
      border: `1px solid ${draft.cardColor}`
    };
  }
  return {
    background: `${draft.cardColor}${toAlphaHex(draft.cardOpacity)}`,
    border: "1px solid rgba(255,255,255,0.08)"
  };
}

function getPhoneBackgroundStyle(draft: {
  backgroundType: "solid" | "gradient";
  backgroundColor: string;
  backgroundColorTo: string;
}): CSSProperties {
  return {
    background:
      draft.backgroundType === "gradient"
        ? `linear-gradient(145deg, ${draft.backgroundColor}, ${draft.backgroundColorTo})`
        : draft.backgroundColor,
    backgroundSize: "cover",
    backgroundPosition: "center"
  };
}

function getFontFamily(font: "inter" | "poppins" | "space-grotesk" | "playfair") {
  if (font === "poppins") return "Poppins, Inter, sans-serif";
  if (font === "space-grotesk") return '"Space Grotesk", Inter, sans-serif';
  if (font === "playfair") return '"Playfair Display", Georgia, serif';
  return "Inter, sans-serif";
}

function toAlphaHex(value: number) {
  const clamped = Math.max(0, Math.min(100, value));
  const channel = Math.round((clamped / 100) * 255);
  return channel.toString(16).padStart(2, "0");
}

function resolveAvatarUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);
    if (url.hostname === "unsplash.com" && url.pathname.startsWith("/photos/")) {
      const slug = url.pathname.split("/").pop() ?? "";
      const photoId = slug.split("-").pop();
      if (photoId) {
        return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=400&h=400&q=80`;
      }
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-5 rounded-xl bg-card border border-border">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">{title}</h3>
      {children}
    </div>
  );
}
