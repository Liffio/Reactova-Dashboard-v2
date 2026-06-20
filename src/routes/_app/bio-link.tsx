import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Edit2,
  ExternalLink,
  Facebook,
  Github,
  Globe,
  GripVertical,
  Instagram,
  Link2,
  Linkedin,
  MessageCircle,
  MousePointerClick,
  Music,
  Palette,
  Plus,
  RotateCcw,
  Share2,
  Smartphone,
  Trash2,
  Twitter,
  User,
  Youtube,
} from "lucide-react";
import { toast } from "sonner";

import { ProtectedRoute } from "@/components/auth/guards";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  createBioLinkItem,
  createBioLinkSocial,
  deleteBioLinkItem,
  deleteBioLinkSocial,
  getBioLink,
  getBioLinkAnalytics,
  reorderBioLinkItems,
  reorderBioLinkSocials,
  resetBioLink,
  updateBioLink,
  updateBioLinkItem,
  updateBioLinkSocial,
  type BioLinkItem,
  type BioLinkProfile,
  type BioLinkSocialInput,
  type BioLinkSocialItem,
} from "@/lib/api/biolink-api";
import { useApp } from "@/state/app-context";

export const Route = createFileRoute("/_app/bio-link")({
  head: () => ({ meta: [{ title: "Bio Link — Liffio" }] }),
  component: BioLinkRoute,
});

function BioLinkRoute() {
  return (
    <ProtectedRoute module="biolink">
      <BioLinkPage />
    </ProtectedRoute>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type BackgroundPattern = "none" | "dots" | "grid" | "diagonal" | "circles" | "crosshatch" | "hexdots";

type DraftLink = BioLinkItem & { _local?: true };
type DraftSocial = BioLinkSocialItem & { _local?: true };

type FullDraft = {
  displayName: string;
  bio: string;
  slug: string;
  avatarUrl: string;
  accentColor: string;
  buttonStyle: "filled" | "outlined" | "soft";
  backgroundType: "solid" | "gradient";
  backgroundColor: string;
  backgroundColorTo: string;
  backgroundPattern: BackgroundPattern;
  textColor: string;
  cardStyle: "solid" | "glass" | "outline";
  cardColor: string;
  cardOpacity: number;
  fontFamily: "inter" | "poppins" | "space-grotesk" | "playfair";
  buttonTextColor: string;
  buttonRadius: number;
  buttonBorderWidth: number;
  buttonShadow: boolean;
  socialLayout: "horizontal" | "vertical";
  sectionOrder: Array<"links" | "socials">;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const swatches = [
  "#7C6AF7", "#F97316", "#22C55E", "#EAB308",
  "#EF4444", "#34B7F1", "#0EA5E9", "#14B8A6",
  "#EC4899", "#8B5CF6", "#6366F1", "#F59E0B",
];

const BACKGROUND_PATTERNS: Array<{ id: BackgroundPattern; name: string }> = [
  { id: "none", name: "None" },
  { id: "dots", name: "Dots" },
  { id: "grid", name: "Grid" },
  { id: "diagonal", name: "Lines" },
  { id: "circles", name: "Rings" },
  { id: "crosshatch", name: "Hatch" },
  { id: "hexdots", name: "Hex" },
];

const SOCIAL_PRESETS = [
  { label: "Instagram", url: "https://instagram.com/", platform: "instagram" as const, icon: "instagram", emoji: "📸" },
  { label: "X / Twitter", url: "https://x.com/", platform: "custom" as const, icon: "twitter", emoji: "🐦" },
  { label: "YouTube", url: "https://youtube.com/@", platform: "custom" as const, icon: "youtube", emoji: "▶️" },
  { label: "TikTok", url: "https://tiktok.com/@", platform: "custom" as const, icon: "tiktok", emoji: "🎵" },
  { label: "LinkedIn", url: "https://linkedin.com/in/", platform: "custom" as const, icon: "linkedin", emoji: "💼" },
  { label: "GitHub", url: "https://github.com/", platform: "custom" as const, icon: "github", emoji: "🐙" },
  { label: "Discord", url: "https://discord.gg/", platform: "custom" as const, icon: "discord", emoji: "💬" },
  { label: "Spotify", url: "https://open.spotify.com/user/", platform: "custom" as const, icon: "spotify", emoji: "🎧" },
  { label: "Custom", url: "", platform: "custom" as const, icon: "link", emoji: "🔗" },
];

const PLATFORM_ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  instagram: Instagram,
  twitter: Twitter,
  youtube: Youtube,
  linkedin: Linkedin,
  github: Github,
  facebook: Facebook,
  discord: MessageCircle,
  spotify: Music,
  tiktok: Music,
  link: Globe,
  custom: Globe,
};

function SocialIcon({ icon, className, style }: { icon: string | null; className?: string; style?: React.CSSProperties }) {
  const Icon = (icon && PLATFORM_ICON_MAP[icon]) ? PLATFORM_ICON_MAP[icon] : Globe;
  return <Icon className={className} style={style} />;
}

type TemplateStyle = Omit<FullDraft, "displayName" | "bio" | "slug" | "avatarUrl" | "backgroundPattern">;

const bioTemplates: Array<{ id: string; name: string; style: TemplateStyle }> = [
  { id: "aurora-splash", name: "Aurora Splash", style: { accentColor: "#22D3EE", buttonStyle: "soft", backgroundType: "gradient", backgroundColor: "#14532D", backgroundColorTo: "#0EA5E9", textColor: "#E0F2FE", cardStyle: "glass", cardColor: "#0F172A", cardOpacity: 52, fontFamily: "space-grotesk", buttonTextColor: "#ECFEFF", buttonRadius: 16, buttonBorderWidth: 1, buttonShadow: true, socialLayout: "horizontal", sectionOrder: ["links", "socials"] } },
  { id: "starfield-dark", name: "Starfield Dark", style: { accentColor: "#FFFFFF", buttonStyle: "outlined", backgroundType: "gradient", backgroundColor: "#020617", backgroundColorTo: "#111827", textColor: "#FFFFFF", cardStyle: "glass", cardColor: "#0B1120", cardOpacity: 40, fontFamily: "inter", buttonTextColor: "#FFFFFF", buttonRadius: 20, buttonBorderWidth: 2, buttonShadow: true, socialLayout: "horizontal", sectionOrder: ["links", "socials"] } },
  { id: "berry-burst", name: "Berry Burst", style: { accentColor: "#F43F5E", buttonStyle: "filled", backgroundType: "gradient", backgroundColor: "#7E22CE", backgroundColorTo: "#2563EB", textColor: "#FFFFFF", cardStyle: "solid", cardColor: "#9333EA", cardOpacity: 55, fontFamily: "poppins", buttonTextColor: "#FFFFFF", buttonRadius: 18, buttonBorderWidth: 0, buttonShadow: true, socialLayout: "horizontal", sectionOrder: ["links", "socials"] } },
  { id: "sage-grid", name: "Sage Grid", style: { accentColor: "#0F172A", buttonStyle: "outlined", backgroundType: "solid", backgroundColor: "#C4D39A", backgroundColorTo: "#C4D39A", textColor: "#111827", cardStyle: "outline", cardColor: "#A3B18A", cardOpacity: 100, fontFamily: "playfair", buttonTextColor: "#111827", buttonRadius: 16, buttonBorderWidth: 2, buttonShadow: false, socialLayout: "horizontal", sectionOrder: ["links", "socials"] } },
  { id: "mono-ink", name: "Mono Ink", style: { accentColor: "#FFFFFF", buttonStyle: "outlined", backgroundType: "gradient", backgroundColor: "#030712", backgroundColorTo: "#020617", textColor: "#FFFFFF", cardStyle: "outline", cardColor: "#374151", cardOpacity: 60, fontFamily: "inter", buttonTextColor: "#FFFFFF", buttonRadius: 10, buttonBorderWidth: 1, buttonShadow: false, socialLayout: "horizontal", sectionOrder: ["links", "socials"] } },
  { id: "sand-studio", name: "Sand Studio", style: { accentColor: "#111827", buttonStyle: "outlined", backgroundType: "solid", backgroundColor: "#FFF7ED", backgroundColorTo: "#FFF7ED", textColor: "#1F2937", cardStyle: "solid", cardColor: "#FFFBEB", cardOpacity: 100, fontFamily: "poppins", buttonTextColor: "#111827", buttonRadius: 14, buttonBorderWidth: 1, buttonShadow: false, socialLayout: "horizontal", sectionOrder: ["links", "socials"] } },
  { id: "frost-light", name: "Frost Light", style: { accentColor: "#0EA5E9", buttonStyle: "soft", backgroundType: "solid", backgroundColor: "#E0F2FE", backgroundColorTo: "#E0F2FE", textColor: "#0F172A", cardStyle: "glass", cardColor: "#FFFFFF", cardOpacity: 75, fontFamily: "inter", buttonTextColor: "#0F172A", buttonRadius: 12, buttonBorderWidth: 0, buttonShadow: false, socialLayout: "horizontal", sectionOrder: ["links", "socials"] } },
  { id: "royal-indigo", name: "Royal Indigo", style: { accentColor: "#8B5CF6", buttonStyle: "outlined", backgroundType: "gradient", backgroundColor: "#1E1B4B", backgroundColorTo: "#4C1D95", textColor: "#EDE9FE", cardStyle: "glass", cardColor: "#312E81", cardOpacity: 58, fontFamily: "playfair", buttonTextColor: "#DDD6FE", buttonRadius: 18, buttonBorderWidth: 1, buttonShadow: true, socialLayout: "horizontal", sectionOrder: ["links", "socials"] } },
  { id: "crimson-neon", name: "Crimson Neon", style: { accentColor: "#F43F5E", buttonStyle: "soft", backgroundType: "gradient", backgroundColor: "#0F172A", backgroundColorTo: "#7F1D1D", textColor: "#FEE2E2", cardStyle: "outline", cardColor: "#F43F5E", cardOpacity: 35, fontFamily: "space-grotesk", buttonTextColor: "#FECACA", buttonRadius: 16, buttonBorderWidth: 1, buttonShadow: true, socialLayout: "horizontal", sectionOrder: ["links", "socials"] } },
  { id: "pearl-minimal", name: "Pearl Minimal", style: { accentColor: "#111827", buttonStyle: "filled", backgroundType: "solid", backgroundColor: "#FFFFFF", backgroundColorTo: "#FFFFFF", textColor: "#111827", cardStyle: "solid", cardColor: "#F8FAFC", cardOpacity: 100, fontFamily: "inter", buttonTextColor: "#FFFFFF", buttonRadius: 999, buttonBorderWidth: 0, buttonShadow: false, socialLayout: "horizontal", sectionOrder: ["links", "socials"] } },
  { id: "ocean-electric", name: "Ocean Electric", style: { accentColor: "#06B6D4", buttonStyle: "filled", backgroundType: "gradient", backgroundColor: "#082F49", backgroundColorTo: "#0EA5E9", textColor: "#ECFEFF", cardStyle: "glass", cardColor: "#0C4A6E", cardOpacity: 66, fontFamily: "poppins", buttonTextColor: "#FFFFFF", buttonRadius: 12, buttonBorderWidth: 0, buttonShadow: true, socialLayout: "horizontal", sectionOrder: ["links", "socials"] } },
  { id: "forest-night", name: "Forest Night", style: { accentColor: "#22C55E", buttonStyle: "soft", backgroundType: "gradient", backgroundColor: "#052E16", backgroundColorTo: "#166534", textColor: "#ECFDF5", cardStyle: "solid", cardColor: "#14532D", cardOpacity: 78, fontFamily: "space-grotesk", buttonTextColor: "#BBF7D0", buttonRadius: 14, buttonBorderWidth: 0, buttonShadow: false, socialLayout: "horizontal", sectionOrder: ["links", "socials"] } },
  { id: "sunset-haze", name: "Sunset Haze", style: { accentColor: "#F97316", buttonStyle: "filled", backgroundType: "gradient", backgroundColor: "#7C2D12", backgroundColorTo: "#FDBA74", textColor: "#FFF7ED", cardStyle: "glass", cardColor: "#9A3412", cardOpacity: 62, fontFamily: "poppins", buttonTextColor: "#FFFFFF", buttonRadius: 16, buttonBorderWidth: 0, buttonShadow: true, socialLayout: "horizontal", sectionOrder: ["links", "socials"] } },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidUrl(url: string) {
  try { new URL(url); return true; } catch { return false; }
}

function getPatternStyle(pattern: BackgroundPattern, opacity = 0.13): React.CSSProperties {
  const c = `rgba(255,255,255,${opacity})`;
  switch (pattern) {
    case "dots":
      return { backgroundImage: `radial-gradient(${c} 1.5px, transparent 1.5px)`, backgroundSize: "22px 22px" };
    case "grid":
      return { backgroundImage: `linear-gradient(${c} 1px, transparent 1px), linear-gradient(90deg, ${c} 1px, transparent 1px)`, backgroundSize: "26px 26px" };
    case "diagonal":
      return { backgroundImage: `repeating-linear-gradient(45deg, ${c} 0, ${c} 1px, transparent 0, transparent 50%)`, backgroundSize: "14px 14px" };
    case "circles":
      return { backgroundImage: `radial-gradient(circle, transparent 32%, ${c} 33%, ${c} 36%, transparent 37%)`, backgroundSize: "36px 36px" };
    case "crosshatch":
      return { backgroundImage: `repeating-linear-gradient(0deg, ${c} 0, ${c} 1px, transparent 0, transparent 50%), repeating-linear-gradient(90deg, ${c} 0, ${c} 1px, transparent 0, transparent 50%)`, backgroundSize: "22px 22px" };
    case "hexdots":
      return { backgroundImage: `radial-gradient(${c} 1.5px, transparent 1.5px), radial-gradient(${c} 1.5px, transparent 1.5px)`, backgroundSize: "24px 24px", backgroundPosition: "0 0, 12px 12px" };
    default:
      return {};
  }
}

function reorder<T extends { id: string }>(items: T[], fromId: string, toId: string): T[] {
  const from = items.findIndex((i) => i.id === fromId);
  const to = items.findIndex((i) => i.id === toId);
  if (from < 0 || to < 0) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next.map((item, idx) => ({ ...item, order: idx }));
}

function initDraft(profile: BioLinkProfile, workspaceId: string): FullDraft {
  return {
    displayName: profile.displayName,
    bio: profile.bio ?? "",
    slug: profile.slug,
    avatarUrl: profile.avatarUrl ?? "",
    accentColor: profile.accentColor,
    buttonStyle: profile.buttonStyle,
    backgroundType: profile.backgroundType,
    backgroundColor: profile.backgroundColor,
    backgroundColorTo: profile.backgroundColorTo,
    backgroundPattern: (localStorage.getItem(`biolink-pattern-${workspaceId}`) as BackgroundPattern) ?? "none",
    textColor: profile.textColor,
    cardStyle: profile.cardStyle,
    cardColor: profile.cardColor,
    cardOpacity: profile.cardOpacity,
    fontFamily: profile.fontFamily,
    buttonTextColor: profile.buttonTextColor,
    buttonRadius: profile.buttonRadius,
    buttonBorderWidth: profile.buttonBorderWidth,
    buttonShadow: profile.buttonShadow,
    socialLayout: profile.socialLayout,
    sectionOrder: profile.sectionOrder?.length ? profile.sectionOrder : ["links", "socials"],
  };
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function BioLinkPage() {
  const { current } = useApp();
  const workspaceId = current.id;
  const queryClient = useQueryClient();

  const bioQuery = useQuery({
    queryKey: ["biolink", workspaceId],
    queryFn: () => getBioLink(workspaceId),
    enabled: Boolean(workspaceId) && workspaceId !== "default",
  });

  const analyticsQuery = useQuery({
    queryKey: ["biolink-analytics", workspaceId],
    queryFn: () => getBioLinkAnalytics(workspaceId),
    enabled: Boolean(workspaceId) && workspaceId !== "default",
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["biolink", workspaceId] });

  const profile = bioQuery.data;
  const analytics = analyticsQuery.data;

  const [draft, setDraft] = useState<FullDraft | null>(null);
  const [links, setLinks] = useState<DraftLink[]>([]);
  const [socials, setSocials] = useState<DraftSocial[]>([]);
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    if (profile) {
      setDraft((prev) => prev ?? initDraft(profile, workspaceId));
      setLinks(profile.links);
      setSocials(profile.socials);
    }
  }, [profile, workspaceId]);

  const set = useCallback(<K extends keyof FullDraft>(key: K, value: FullDraft[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }, []);

  const applyTemplate = useCallback((templateId: string) => {
    const t = bioTemplates.find((x) => x.id === templateId);
    if (t) setDraft((prev) => (prev ? { ...prev, ...t.style } : prev));
  }, []);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!draft) throw new Error("No draft");
      localStorage.setItem(`biolink-pattern-${workspaceId}`, draft.backgroundPattern);
      return updateBioLink(workspaceId, {
        displayName: draft.displayName || (profile?.displayName ?? ""),
        bio: draft.bio || null,
        slug: draft.slug || workspaceId,
        avatarUrl: draft.avatarUrl || undefined,
        accentColor: draft.accentColor,
        buttonStyle: draft.buttonStyle,
        backgroundType: draft.backgroundType,
        backgroundColor: draft.backgroundColor,
        backgroundColorTo: draft.backgroundColorTo,
        textColor: draft.textColor,
        cardStyle: draft.cardStyle,
        cardColor: draft.cardColor,
        cardOpacity: draft.cardOpacity,
        fontFamily: draft.fontFamily,
        buttonTextColor: draft.buttonTextColor,
        buttonRadius: draft.buttonRadius,
        buttonBorderWidth: draft.buttonBorderWidth,
        buttonShadow: draft.buttonShadow,
        socialLayout: draft.socialLayout,
        sectionOrder: draft.sectionOrder,
      });
    },
    onSuccess: () => { toast.success("Bio link saved"); invalidate(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const resetMutation = useMutation({
    mutationFn: () => resetBioLink(workspaceId),
    onSuccess: () => {
      toast.success("Bio link reset to defaults");
      setResetOpen(false);
      setDraft(null);
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (bioQuery.isLoading || !profile || !draft) {
    return <BioLinkSkeleton />;
  }

  return (
    <div className="flex flex-col">
      {/* Sticky header bar */}
      <div className="sticky top-14 z-10 flex items-center justify-between border-b bg-background/90 backdrop-blur px-5 py-3.5">
        <div>
          <p className="text-[10px] font-semibold text-primary uppercase tracking-widest">Distribute</p>
          <h1 className="font-display text-lg font-bold tracking-tight leading-tight">Bio Link Builder</h1>
        </div>
        <div className="flex items-center gap-2">
          {profile.publicUrl && (
            <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" asChild>
              <a href={profile.publicUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3" /> View live
              </a>
            </Button>
          )}
          <Button size="sm" className="gap-1.5 h-8 text-xs" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex items-start">
        {/* Left: scrollable editor */}
        <div className="flex-1 min-w-0 space-y-4 p-5 lg:p-6 pb-20">
          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="grid gap-3 sm:grid-cols-3"
          >
            <StatCard label="Total clicks" value={String(analytics?.totalClicks ?? profile.totalClicks ?? 0)} icon={MousePointerClick} />
            <StatCard label="Links" value={String(links.length)} icon={Link2} />
            <StatCard label="Top link" value={analytics?.links[0]?.title ?? "—"} icon={MousePointerClick} hint={analytics?.links[0] ? `${analytics.links[0].clicks} clicks` : undefined} />
          </motion.div>

          {/* Profile */}
          <SectionCard title="Profile" icon={User} delay={0.05}>
            <ProfileSection draft={draft} set={set} />
          </SectionCard>

          {/* Links */}
          <SectionCard title="Links" icon={Link2} delay={0.1} action={<span className="text-[11px] text-muted-foreground">{links.length} link{links.length !== 1 ? "s" : ""}</span>}>
            <LinksSection workspaceId={workspaceId} links={links} onLinks={setLinks} onUpdate={invalidate} />
          </SectionCard>

          {/* Socials */}
          <SectionCard title="Social Links" icon={Share2} delay={0.15} action={<span className="text-[11px] text-muted-foreground">{socials.length} social{socials.length !== 1 ? "s" : ""}</span>}>
            <SocialsSection workspaceId={workspaceId} socials={socials} onSocials={setSocials} onUpdate={invalidate} />
          </SectionCard>

          {/* Appearance */}
          <SectionCard title="Appearance" icon={Palette} delay={0.2}>
            <AppearanceSection draft={draft} set={set} applyTemplate={applyTemplate} />
          </SectionCard>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="flex items-center justify-between pt-1"
          >
            <Button variant="outline" size="sm" className="gap-1.5 text-xs text-destructive hover:text-destructive hover:border-destructive/40" onClick={() => setResetOpen(true)}>
              <RotateCcw className="h-3 w-3" /> Reset to default
            </Button>
            <Button size="sm" className="text-xs" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </motion.div>
        </div>

        {/* Right: sticky phone preview */}
        <div className="hidden xl:flex xl:w-[360px] shrink-0 sticky top-[7.5rem] self-start h-[calc(100vh-7.5rem)] items-center justify-center overflow-hidden">
          <PhonePreview draft={draft} links={links} socials={socials} />
        </div>
      </div>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset bio link?</AlertDialogTitle>
            <AlertDialogDescription>All appearance settings will be reset to defaults. Your links and socials will not be affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={resetMutation.isPending} onClick={() => resetMutation.mutate()}>
              {resetMutation.isPending ? "Resetting…" : "Reset"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function BioLinkSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
    </div>
  );
}

// ── SectionCard ───────────────────────────────────────────────────────────────

function SectionCard({
  title, icon: Icon, children, action, delay = 0,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  action?: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, delay, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border bg-card shadow-soft overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <div className="grid h-6 w-6 place-items-center rounded-md bg-primary/10">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </div>
          <h2 className="font-display font-semibold text-sm">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </motion.div>
  );
}

// ── Phone Preview ─────────────────────────────────────────────────────────────

function PhonePreview({ draft, links, socials }: { draft: FullDraft; links: DraftLink[]; socials: DraftSocial[] }) {
  const bgStyle = useMemo((): React.CSSProperties => (
    draft.backgroundType === "gradient"
      ? { background: `linear-gradient(160deg, ${draft.backgroundColor} 0%, ${draft.backgroundColorTo} 100%)` }
      : { backgroundColor: draft.backgroundColor }
  ), [draft.backgroundType, draft.backgroundColor, draft.backgroundColorTo]);

  const patternStyle = useMemo(() => getPatternStyle(draft.backgroundPattern), [draft.backgroundPattern]);

  const fontFamily = useMemo(() => ({
    inter: '"Inter", sans-serif',
    poppins: '"Poppins", sans-serif',
    "space-grotesk": '"Space Grotesk", sans-serif',
    playfair: '"Playfair Display", serif',
  }[draft.fontFamily]), [draft.fontFamily]);

  const btnStyle = useMemo((): React.CSSProperties => {
    const radius = `${Math.min(draft.buttonRadius, 24)}px`;
    const shadow = draft.buttonShadow ? `0 2px 14px ${draft.accentColor}44` : "none";
    if (draft.buttonStyle === "filled") return { backgroundColor: draft.accentColor, color: draft.buttonTextColor, borderRadius: radius, border: "none", boxShadow: shadow, fontFamily, fontSize: "11px", fontWeight: 500, padding: "8px 12px", textAlign: "center", width: "100%" };
    if (draft.buttonStyle === "outlined") return { backgroundColor: "transparent", color: draft.textColor, borderRadius: radius, border: `${Math.max(draft.buttonBorderWidth, 1)}px solid ${draft.accentColor}`, boxShadow: shadow, fontFamily, fontSize: "11px", fontWeight: 500, padding: "8px 12px", textAlign: "center", width: "100%" };
    return { backgroundColor: `${draft.accentColor}28`, color: draft.buttonTextColor, borderRadius: radius, border: "none", boxShadow: shadow, fontFamily, fontSize: "11px", fontWeight: 500, padding: "8px 12px", textAlign: "center", width: "100%" };
  }, [draft.buttonStyle, draft.accentColor, draft.buttonTextColor, draft.buttonRadius, draft.buttonBorderWidth, draft.buttonShadow, draft.textColor, fontFamily]);

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-4">
        <Smartphone className="h-3 w-3" /> Live preview
      </div>

      {/* Phone shell */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-[252px] h-[504px] rounded-[38px] bg-zinc-900 shadow-[0_30px_80px_-12px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)]"
        style={{ border: "8px solid #27272a" }}
      >
        {/* Dynamic island */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[72px] h-[18px] bg-black rounded-full z-20" />

        {/* Side buttons */}
        <div className="absolute -right-[10px] top-16 w-[3px] h-10 bg-zinc-700 rounded-r-full" />
        <div className="absolute -left-[10px] top-16 w-[3px] h-8 bg-zinc-700 rounded-l-full" />
        <div className="absolute -left-[10px] top-28 w-[3px] h-8 bg-zinc-700 rounded-l-full" />

        {/* Screen */}
        <div className="absolute inset-0 rounded-[30px] overflow-hidden" style={bgStyle}>
          {draft.backgroundPattern !== "none" && (
            <div className="absolute inset-0 pointer-events-none" style={patternStyle} />
          )}

          {/* Scrollable content */}
          <div className="absolute inset-0 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            <div className="flex flex-col items-center px-4 pt-10 pb-8 text-center" style={{ color: draft.textColor, fontFamily }}>
              {/* Avatar */}
              <div className="mt-2 mb-2.5">
                {draft.avatarUrl && isValidUrl(draft.avatarUrl) ? (
                  <img src={draft.avatarUrl} alt="" className="w-[60px] h-[60px] rounded-full object-cover" style={{ border: `2.5px solid ${draft.accentColor}` }} />
                ) : (
                  <div className="w-[60px] h-[60px] rounded-full flex items-center justify-center text-xl font-bold" style={{ backgroundColor: draft.accentColor, color: draft.buttonTextColor }}>
                    {draft.displayName?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
              </div>
              <p className="font-bold text-[13px] leading-tight mb-1" style={{ fontFamily }}>{draft.displayName || "Your Name"}</p>
              {draft.bio && <p className="text-[10px] opacity-65 mb-3.5 leading-relaxed max-w-[190px]">{draft.bio}</p>}

              {(draft.sectionOrder ?? ["links", "socials"]).map((section) =>
                section === "links" ? (
                  <div key="links" className="w-full space-y-1.5 mb-3">
                    {links.slice(0, 6).map((link) => (
                      <div key={link.id} style={btnStyle}>{link.title}</div>
                    ))}
                    {links.length === 0 && <div style={{ ...btnStyle, opacity: 0.35 }}>Your link here</div>}
                  </div>
                ) : (
                  <div key="socials" className={`flex mb-3 ${draft.socialLayout === "horizontal" ? "flex-row gap-2.5 flex-wrap justify-center" : "flex-col gap-1.5 w-full"}`}>
                    {socials.slice(0, 8).map((s) =>
                      draft.socialLayout === "horizontal" ? (
                        <div key={s.id} className="h-8 w-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${draft.accentColor}22` }}>
                          <SocialIcon icon={s.icon} style={{ color: draft.accentColor, width: 16, height: 16 }} />
                        </div>
                      ) : (
                        <div key={s.id} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px]" style={{ backgroundColor: `${draft.cardColor}55`, color: draft.textColor }}>
                          <SocialIcon icon={s.icon} style={{ color: draft.textColor, width: 12, height: 12, flexShrink: 0 }} />
                          <span>{s.label}</span>
                        </div>
                      )
                    )}
                    {socials.length === 0 && (
                      <div className="h-8 w-8 rounded-full flex items-center justify-center opacity-30" style={{ backgroundColor: `${draft.accentColor}22` }}>
                        <Globe style={{ color: draft.accentColor, width: 16, height: 16 }} />
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* Home indicator */}
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-16 h-[3px] bg-white/25 rounded-full z-20" />
      </motion.div>

      <p className="mt-3 text-[10px] text-muted-foreground font-mono truncate max-w-[230px] text-center">
        bio.liffio.com/{draft.slug || "…"}
      </p>
    </div>
  );
}

// ── Profile Section ───────────────────────────────────────────────────────────

function ProfileSection({ draft, set }: {
  draft: FullDraft;
  set: <K extends keyof FullDraft>(k: K, v: FullDraft[K]) => void;
}) {
  const publicUrl = useMemo(() => `https://bio.liffio.com/${draft.slug || "your-slug"}`, [draft.slug]);

  return (
    <div className="grid gap-3.5 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label className="text-xs">Display name</Label>
        <Input value={draft.displayName} onChange={(e) => set("displayName", e.target.value)} maxLength={60} placeholder="Your name" className="h-9" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Avatar URL</Label>
        <div className="flex items-center gap-2">
          <Input type="url" placeholder="https://…/avatar.jpg" value={draft.avatarUrl} onChange={(e) => set("avatarUrl", e.target.value)} className="h-9" />
          {draft.avatarUrl && isValidUrl(draft.avatarUrl) && (
            <img src={draft.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover border shrink-0" />
          )}
        </div>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-xs flex items-center justify-between">
          Bio <span className="text-muted-foreground font-normal">{draft.bio.length}/160</span>
        </Label>
        <textarea
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          rows={2}
          placeholder="A short bio…"
          value={draft.bio}
          onChange={(e) => set("bio", e.target.value.slice(0, 160))}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-xs">Slug (URL)</Label>
        <div className="flex items-center rounded-lg border bg-background overflow-hidden">
          <span className="px-3 text-xs text-muted-foreground border-r py-2.5 bg-muted/30 shrink-0 whitespace-nowrap">bio.liffio.com/</span>
          <Input value={draft.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="your-brand" maxLength={40} className="border-0 bg-transparent focus-visible:ring-0 h-9 text-sm" />
        </div>
        <p className="text-[11px] text-muted-foreground font-mono">{publicUrl}</p>
      </div>
    </div>
  );
}

// ── Links Section ─────────────────────────────────────────────────────────────

function LinksSection({ workspaceId, links, onLinks, onUpdate }: {
  workspaceId: string;
  links: DraftLink[];
  onLinks: (links: DraftLink[]) => void;
  onUpdate: () => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<DraftLink | null>(null);
  const [deleting, setDeleting] = useState<DraftLink | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const addMutation = useMutation({
    mutationFn: (body: { title: string; url: string }) => createBioLinkItem(workspaceId, body),
    onSuccess: () => { toast.success("Link added"); setAddOpen(false); onUpdate(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, title, url }: { id: string; title: string; url: string }) => updateBioLinkItem(workspaceId, id, { title, url }),
    onSuccess: () => { toast.success("Link updated"); setEditing(null); onUpdate(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBioLinkItem(workspaceId, id),
    onSuccess: () => { toast.success("Link deleted"); setDeleting(null); onUpdate(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => reorderBioLinkItems(workspaceId, ids),
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-2.5">
      {links.length === 0 && (
        <div className="rounded-xl border border-dashed bg-muted/20 p-7 text-center">
          <Link2 className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
          <p className="text-sm font-medium">No links yet</p>
          <p className="text-xs text-muted-foreground mt-0.5">Add links to appear on your bio page.</p>
        </div>
      )}

      <AnimatePresence initial={false}>
        {links.map((link) => (
          <motion.div
            key={link.id}
            layout
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: draggingId === link.id ? 0.45 : 1, height: "auto", scale: draggingId === link.id ? 1.015 : 1 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            draggable
            onDragStart={() => setDraggingId(link.id)}
            onDragOver={(e) => { e.preventDefault(); if (draggingId && draggingId !== link.id) onLinks(reorder(links, draggingId, link.id)); }}
            onDrop={() => { setDraggingId(null); reorderMutation.mutate(links.map((i) => i.id)); }}
            className={`flex items-center gap-3 rounded-xl border bg-background px-3.5 py-3 cursor-grab active:cursor-grabbing transition-shadow ${draggingId === link.id ? "shadow-glow" : "hover:shadow-card"}`}
          >
            <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm leading-tight">{link.title}</p>
              <p className="truncate text-xs text-muted-foreground mt-0.5">{link.url}</p>
            </div>
            <button className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors" onClick={() => setEditing(link)}>
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => setDeleting(link)}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      <button
        onClick={() => setAddOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-muted/20 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" /> Add link
      </button>

      <LinkDialog open={addOpen} onOpenChange={setAddOpen} title="Add link" isPending={addMutation.isPending} onSubmit={(d) => addMutation.mutate(d)} />
      <LinkDialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)} title="Edit link" initialTitle={editing?.title} initialUrl={editing?.url} isPending={updateMutation.isPending} onSubmit={(d) => editing && updateMutation.mutate({ id: editing.id, ...d })} />

      <AlertDialog open={Boolean(deleting)} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleting?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>This link will be removed from your bio page.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleteMutation.isPending} onClick={() => deleting && deleteMutation.mutate(deleting.id)}>
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Socials Section ───────────────────────────────────────────────────────────

function SocialsSection({ workspaceId, socials, onSocials, onUpdate }: {
  workspaceId: string;
  socials: DraftSocial[];
  onSocials: (socials: DraftSocial[]) => void;
  onUpdate: () => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<DraftSocial | null>(null);
  const [deleting, setDeleting] = useState<DraftSocial | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const addMutation = useMutation({
    mutationFn: (body: BioLinkSocialInput) => createBioLinkSocial(workspaceId, body),
    onSuccess: () => { toast.success("Social added"); setAddOpen(false); onUpdate(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & BioLinkSocialInput) => updateBioLinkSocial(workspaceId, id, body),
    onSuccess: () => { toast.success("Social updated"); setEditing(null); onUpdate(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBioLinkSocial(workspaceId, id),
    onSuccess: () => { toast.success("Social deleted"); setDeleting(null); onUpdate(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => reorderBioLinkSocials(workspaceId, ids),
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-2.5">
      {socials.length === 0 && (
        <div className="rounded-xl border border-dashed bg-muted/20 p-7 text-center">
          <Share2 className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
          <p className="text-sm font-medium">No socials yet</p>
          <p className="text-xs text-muted-foreground mt-0.5">Add social links to display on your bio page.</p>
        </div>
      )}

      <AnimatePresence initial={false}>
        {socials.map((social) => (
          <motion.div
            key={social.id}
            layout
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: draggingId === social.id ? 0.45 : 1, height: "auto", scale: draggingId === social.id ? 1.015 : 1 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            draggable
            onDragStart={() => setDraggingId(social.id)}
            onDragOver={(e) => { e.preventDefault(); if (draggingId && draggingId !== social.id) onSocials(reorder(socials, draggingId, social.id)); }}
            onDrop={() => { setDraggingId(null); reorderMutation.mutate(socials.map((i) => i.id)); }}
            className={`flex items-center gap-3 rounded-xl border bg-background px-3.5 py-3 cursor-grab active:cursor-grabbing transition-shadow ${draggingId === social.id ? "shadow-glow" : "hover:shadow-card"}`}
          >
            <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="h-8 w-8 shrink-0 rounded-lg bg-muted/60 flex items-center justify-center">
              <SocialIcon icon={social.icon} className="h-4 w-4 text-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm leading-tight">{social.label}</p>
              <p className="truncate text-xs text-muted-foreground mt-0.5">{social.url}</p>
            </div>
            <button className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors" onClick={() => setEditing(social)}>
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => setDeleting(social)}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      <button
        onClick={() => setAddOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-muted/20 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" /> Add social
      </button>

      <SocialDialog open={addOpen} onOpenChange={setAddOpen} title="Add social" isPending={addMutation.isPending} onSubmit={(d) => addMutation.mutate(d)} />
      <SocialDialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)} title="Edit social" initial={editing ?? undefined} isPending={updateMutation.isPending} onSubmit={(d) => editing && updateMutation.mutate({ id: editing.id, ...d })} />

      <AlertDialog open={Boolean(deleting)} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleting?.label}"?</AlertDialogTitle>
            <AlertDialogDescription>This social will be removed from your bio page.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleteMutation.isPending} onClick={() => deleting && deleteMutation.mutate(deleting.id)}>
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Appearance Section ────────────────────────────────────────────────────────

function AppearanceSection({ draft, set, applyTemplate }: {
  draft: FullDraft;
  set: <K extends keyof FullDraft>(k: K, v: FullDraft[K]) => void;
  applyTemplate: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Templates */}
      <div className="space-y-2.5">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Templates</p>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
          {bioTemplates.map((t) => (
            <button
              key={t.id}
              onClick={() => applyTemplate(t.id)}
              title={t.name}
              className="group relative h-12 rounded-xl border-2 border-transparent hover:border-primary transition-all hover:scale-105 overflow-hidden"
              style={{ background: t.style.backgroundType === "gradient" ? `linear-gradient(135deg, ${t.style.backgroundColor}, ${t.style.backgroundColorTo})` : t.style.backgroundColor }}
            >
              <span className="absolute inset-x-0 bottom-0 flex items-center justify-center pb-0.5">
                <span className="text-[8px] font-medium px-1 py-px bg-black/50 text-white backdrop-blur-sm rounded leading-tight truncate max-w-full">{t.name}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Background */}
      <div className="space-y-3">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Background</p>

        <div className="space-y-1.5">
          <Label className="text-xs">Type</Label>
          <div className="flex gap-2">
            {(["solid", "gradient"] as const).map((t) => (
              <button key={t} onClick={() => set("backgroundType", t)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium capitalize transition-all ${draft.backgroundType === t ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{draft.backgroundType === "gradient" ? "From color" : "Color"}</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={draft.backgroundColor} onChange={(e) => set("backgroundColor", e.target.value)} className="h-8 w-8 rounded-md border cursor-pointer p-0.5 bg-background" />
              <Input value={draft.backgroundColor} onChange={(e) => set("backgroundColor", e.target.value)} className="font-mono text-xs h-8" />
            </div>
          </div>
          {draft.backgroundType === "gradient" && (
            <div className="space-y-1.5">
              <Label className="text-xs">To color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={draft.backgroundColorTo} onChange={(e) => set("backgroundColorTo", e.target.value)} className="h-8 w-8 rounded-md border cursor-pointer p-0.5 bg-background" />
                <Input value={draft.backgroundColorTo} onChange={(e) => set("backgroundColorTo", e.target.value)} className="font-mono text-xs h-8" />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Text color</Label>
          <div className="flex items-center gap-2">
            <input type="color" value={draft.textColor} onChange={(e) => set("textColor", e.target.value)} className="h-8 w-8 rounded-md border cursor-pointer p-0.5 bg-background" />
            <Input value={draft.textColor} onChange={(e) => set("textColor", e.target.value)} className="font-mono text-xs h-8" />
          </div>
        </div>

        {/* Pattern picker */}
        <div className="space-y-2">
          <Label className="text-xs">Background pattern</Label>
          <div className="grid grid-cols-7 gap-1.5">
            {BACKGROUND_PATTERNS.map((p) => (
              <button
                key={p.id}
                onClick={() => set("backgroundPattern", p.id)}
                title={p.name}
                className={`relative h-10 rounded-lg overflow-hidden transition-all border-2 ${draft.backgroundPattern === p.id ? "border-primary scale-105" : "border-border hover:border-primary/50"}`}
                style={{ backgroundColor: "#1e293b" }}
              >
                {p.id !== "none" && <div className="absolute inset-0" style={getPatternStyle(p.id, 0.45)} />}
                <span className="absolute bottom-0 left-0 right-0 text-[7px] text-center text-white/60 pb-0.5">{p.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Accent & Buttons */}
      <div className="space-y-3">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Accent & Buttons</p>

        <div className="space-y-1.5">
          <Label className="text-xs">Accent color</Label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {swatches.map((s) => (
              <button key={s} onClick={() => set("accentColor", s)}
                className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${draft.accentColor === s ? "border-foreground scale-110" : "border-transparent"}`}
                style={{ background: s }} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="color" value={draft.accentColor} onChange={(e) => set("accentColor", e.target.value)} className="h-8 w-8 rounded-md border cursor-pointer p-0.5 bg-background" />
            <Input value={draft.accentColor} onChange={(e) => set("accentColor", e.target.value)} className="font-mono text-xs h-8" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Button style</Label>
          <div className="flex gap-2">
            {(["filled", "outlined", "soft"] as const).map((s) => (
              <button key={s} onClick={() => set("buttonStyle", s)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium capitalize transition-all ${draft.buttonStyle === s ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Button text color</Label>
          <div className="flex items-center gap-2">
            <input type="color" value={draft.buttonTextColor} onChange={(e) => set("buttonTextColor", e.target.value)} className="h-8 w-8 rounded-md border cursor-pointer p-0.5 bg-background" />
            <Input value={draft.buttonTextColor} onChange={(e) => set("buttonTextColor", e.target.value)} className="font-mono text-xs h-8" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Corner radius: {draft.buttonRadius}px</Label>
            <input type="range" min={0} max={999} value={draft.buttonRadius} onChange={(e) => set("buttonRadius", Number(e.target.value))} className="w-full accent-primary" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Border width: {draft.buttonBorderWidth}px</Label>
            <input type="range" min={0} max={4} value={draft.buttonBorderWidth} onChange={(e) => set("buttonBorderWidth", Number(e.target.value))} className="w-full accent-primary" />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2.5">
          <Label className="text-xs cursor-pointer">Button shadow</Label>
          <Switch checked={draft.buttonShadow} onCheckedChange={(v) => set("buttonShadow", v)} />
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Cards */}
      <div className="space-y-3">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Cards</p>

        <div className="space-y-1.5">
          <Label className="text-xs">Card style</Label>
          <div className="flex gap-2">
            {(["solid", "glass", "outline"] as const).map((s) => (
              <button key={s} onClick={() => set("cardStyle", s)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium capitalize transition-all ${draft.cardStyle === s ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Card color</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={draft.cardColor} onChange={(e) => set("cardColor", e.target.value)} className="h-8 w-8 rounded-md border cursor-pointer p-0.5 bg-background" />
              <Input value={draft.cardColor} onChange={(e) => set("cardColor", e.target.value)} className="font-mono text-xs h-8" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Opacity: {draft.cardOpacity}%</Label>
            <div className="pt-3">
              <input type="range" min={10} max={100} value={draft.cardOpacity} onChange={(e) => set("cardOpacity", Number(e.target.value))} className="w-full accent-primary" />
            </div>
          </div>
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Font & Layout */}
      <div className="space-y-3">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Font & Layout</p>

        <div className="space-y-1.5">
          <Label className="text-xs">Font family</Label>
          <div className="grid grid-cols-2 gap-2">
            {(["inter", "poppins", "space-grotesk", "playfair"] as const).map((f) => (
              <button key={f} onClick={() => set("fontFamily", f)}
                className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${draft.fontFamily === f ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}>
                {f === "space-grotesk" ? "Space Grotesk" : f === "playfair" ? "Playfair" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Social icons layout</Label>
          <div className="flex gap-2">
            {(["horizontal", "vertical"] as const).map((l) => (
              <button key={l} onClick={() => set("socialLayout", l)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium capitalize transition-all ${draft.socialLayout === l ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1">Section order <span className="text-muted-foreground font-normal">(drag to reorder)</span></Label>
          <div className="space-y-2">
            {draft.sectionOrder.map((section) => (
              <div
                key={section}
                draggable
                onDragOver={(e) => {
                  e.preventDefault();
                  const other = draft.sectionOrder.find((s) => s !== section);
                  if (other) set("sectionOrder", [section, other]);
                }}
                className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 cursor-grab active:cursor-grabbing text-xs font-medium capitalize"
              >
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                {section}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Link Dialog ───────────────────────────────────────────────────────────────

function LinkDialog({ open, onOpenChange, title, initialTitle = "", initialUrl = "", isPending, onSubmit }: {
  open: boolean; onOpenChange: (v: boolean) => void; title: string;
  initialTitle?: string; initialUrl?: string; isPending: boolean;
  onSubmit: (data: { title: string; url: string }) => void;
}) {
  const [linkTitle, setLinkTitle] = useState(initialTitle);
  const [url, setUrl] = useState(initialUrl);
  useEffect(() => { setLinkTitle(initialTitle); setUrl(initialUrl); }, [initialTitle, initialUrl, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input placeholder="My awesome link" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>URL</Label>
            <Input type="url" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={isPending || !linkTitle.trim() || !url.trim()} onClick={() => onSubmit({ title: linkTitle.trim(), url: url.trim() })}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Social Dialog ─────────────────────────────────────────────────────────────

function SocialDialog({ open, onOpenChange, title, initial, isPending, onSubmit }: {
  open: boolean; onOpenChange: (v: boolean) => void; title: string;
  initial?: BioLinkSocialItem; isPending: boolean;
  onSubmit: (data: BioLinkSocialInput) => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [platform, setPlatform] = useState<"instagram" | "custom">(initial?.platform ?? "custom");
  const [mode, setMode] = useState<"link" | "profile" | "posts" | "reels">(initial?.mode ?? "link");
  const [icon, setIcon] = useState(initial?.icon ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "");

  useEffect(() => {
    setLabel(initial?.label ?? "");
    setUrl(initial?.url ?? "");
    setPlatform(initial?.platform ?? "custom");
    setMode(initial?.mode ?? "link");
    setIcon(initial?.icon ?? "");
    setEmoji(initial?.emoji ?? "");
  }, [initial, open]);

  const applyPreset = (p: typeof SOCIAL_PRESETS[0]) => {
    setLabel(p.label); setUrl(p.url); setPlatform(p.platform);
    setIcon(p.icon); setEmoji(p.emoji);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Quick add</Label>
            <div className="flex flex-wrap gap-1.5">
              {SOCIAL_PRESETS.map((p) => (
                <button key={p.label} onClick={() => applyPreset(p)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs hover:bg-muted/60 transition-colors">
                  <SocialIcon icon={p.icon} className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="h-px bg-border" />
          <div className="space-y-2">
            <Label>Label</Label>
            <Input placeholder="Instagram" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>URL</Label>
            <Input type="url" placeholder="https://instagram.com/handle" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Emoji</Label>
              <Input placeholder="📸" value={emoji} onChange={(e) => setEmoji(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Icon key</Label>
              <Input placeholder="instagram" value={icon} onChange={(e) => setIcon(e.target.value)} />
            </div>
          </div>
          {platform === "instagram" && (
            <div className="space-y-2">
              <Label className="text-xs">Mode</Label>
              <div className="flex gap-2 flex-wrap">
                {(["link", "profile", "posts", "reels"] as const).map((m) => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`px-2.5 py-1 rounded-md border text-xs capitalize transition-all ${mode === m ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={isPending || !label.trim() || !url.trim()} onClick={() => onSubmit({ label: label.trim(), url: url.trim(), platform, mode, icon: icon || undefined, emoji: emoji || undefined })}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
