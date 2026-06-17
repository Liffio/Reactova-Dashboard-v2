import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Edit2,
  ExternalLink,
  GripVertical,
  Link2,
  MousePointerClick,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/page-header";
import { ProtectedRoute } from "@/components/auth/guards";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

type DraftLink = BioLinkItem & { _local?: true };
type DraftSocial = BioLinkSocialItem & { _local?: true };

type AppearanceDraft = {
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
  socialLayout: "horizontal" | "vertical";
  sectionOrder: Array<"links" | "socials">;
};

type ProfileDraft = {
  displayName: string;
  bio: string;
  slug: string;
  avatarUrl: string;
};

type TemplateStyle = AppearanceDraft;

// ── Templates ─────────────────────────────────────────────────────────────────

const swatches = ["#7C6AF7", "#F97316", "#22C55E", "#EAB308", "#EF4444", "#34B7F1", "#0EA5E9", "#14B8A6"];

const bioTemplates: Array<{ id: string; name: string; style: TemplateStyle }> = [
  {
    id: "aurora-splash", name: "Aurora Splash",
    style: { accentColor: "#22D3EE", buttonStyle: "soft", backgroundType: "gradient", backgroundColor: "#14532D", backgroundColorTo: "#0EA5E9", textColor: "#E0F2FE", cardStyle: "glass", cardColor: "#0F172A", cardOpacity: 52, fontFamily: "space-grotesk", buttonTextColor: "#ECFEFF", buttonRadius: 16, buttonBorderWidth: 1, buttonShadow: true, socialLayout: "horizontal", sectionOrder: ["links", "socials"] }
  },
  {
    id: "starfield-dark", name: "Starfield Dark",
    style: { accentColor: "#FFFFFF", buttonStyle: "outlined", backgroundType: "gradient", backgroundColor: "#020617", backgroundColorTo: "#111827", textColor: "#FFFFFF", cardStyle: "glass", cardColor: "#0B1120", cardOpacity: 40, fontFamily: "inter", buttonTextColor: "#FFFFFF", buttonRadius: 20, buttonBorderWidth: 2, buttonShadow: true, socialLayout: "horizontal", sectionOrder: ["links", "socials"] }
  },
  {
    id: "berry-burst", name: "Berry Burst",
    style: { accentColor: "#F43F5E", buttonStyle: "filled", backgroundType: "gradient", backgroundColor: "#7E22CE", backgroundColorTo: "#2563EB", textColor: "#FFFFFF", cardStyle: "solid", cardColor: "#9333EA", cardOpacity: 55, fontFamily: "poppins", buttonTextColor: "#FFFFFF", buttonRadius: 18, buttonBorderWidth: 0, buttonShadow: true, socialLayout: "horizontal", sectionOrder: ["links", "socials"] }
  },
  {
    id: "sage-grid", name: "Sage Grid",
    style: { accentColor: "#0F172A", buttonStyle: "outlined", backgroundType: "solid", backgroundColor: "#C4D39A", backgroundColorTo: "#C4D39A", textColor: "#111827", cardStyle: "outline", cardColor: "#A3B18A", cardOpacity: 100, fontFamily: "playfair", buttonTextColor: "#111827", buttonRadius: 16, buttonBorderWidth: 2, buttonShadow: false, socialLayout: "horizontal", sectionOrder: ["links", "socials"] }
  },
  {
    id: "mono-ink", name: "Mono Ink",
    style: { accentColor: "#FFFFFF", buttonStyle: "outlined", backgroundType: "gradient", backgroundColor: "#030712", backgroundColorTo: "#020617", textColor: "#FFFFFF", cardStyle: "outline", cardColor: "#374151", cardOpacity: 60, fontFamily: "inter", buttonTextColor: "#FFFFFF", buttonRadius: 10, buttonBorderWidth: 1, buttonShadow: false, socialLayout: "horizontal", sectionOrder: ["links", "socials"] }
  },
  {
    id: "sand-studio", name: "Sand Studio",
    style: { accentColor: "#111827", buttonStyle: "outlined", backgroundType: "solid", backgroundColor: "#FFF7ED", backgroundColorTo: "#FFF7ED", textColor: "#1F2937", cardStyle: "solid", cardColor: "#FFFBEB", cardOpacity: 100, fontFamily: "poppins", buttonTextColor: "#111827", buttonRadius: 14, buttonBorderWidth: 1, buttonShadow: false, socialLayout: "horizontal", sectionOrder: ["links", "socials"] }
  },
  {
    id: "frost-light", name: "Frost Light",
    style: { accentColor: "#0EA5E9", buttonStyle: "soft", backgroundType: "solid", backgroundColor: "#E0F2FE", backgroundColorTo: "#E0F2FE", textColor: "#0F172A", cardStyle: "glass", cardColor: "#FFFFFF", cardOpacity: 75, fontFamily: "inter", buttonTextColor: "#0F172A", buttonRadius: 12, buttonBorderWidth: 0, buttonShadow: false, socialLayout: "horizontal", sectionOrder: ["links", "socials"] }
  },
  {
    id: "royal-indigo", name: "Royal Indigo",
    style: { accentColor: "#8B5CF6", buttonStyle: "outlined", backgroundType: "gradient", backgroundColor: "#1E1B4B", backgroundColorTo: "#4C1D95", textColor: "#EDE9FE", cardStyle: "glass", cardColor: "#312E81", cardOpacity: 58, fontFamily: "playfair", buttonTextColor: "#DDD6FE", buttonRadius: 18, buttonBorderWidth: 1, buttonShadow: true, socialLayout: "horizontal", sectionOrder: ["links", "socials"] }
  },
  {
    id: "crimson-neon", name: "Crimson Neon",
    style: { accentColor: "#F43F5E", buttonStyle: "soft", backgroundType: "gradient", backgroundColor: "#0F172A", backgroundColorTo: "#7F1D1D", textColor: "#FEE2E2", cardStyle: "outline", cardColor: "#F43F5E", cardOpacity: 35, fontFamily: "space-grotesk", buttonTextColor: "#FECACA", buttonRadius: 16, buttonBorderWidth: 1, buttonShadow: true, socialLayout: "horizontal", sectionOrder: ["links", "socials"] }
  },
  {
    id: "pearl-minimal", name: "Pearl Minimal",
    style: { accentColor: "#111827", buttonStyle: "filled", backgroundType: "solid", backgroundColor: "#FFFFFF", backgroundColorTo: "#FFFFFF", textColor: "#111827", cardStyle: "solid", cardColor: "#F8FAFC", cardOpacity: 100, fontFamily: "inter", buttonTextColor: "#FFFFFF", buttonRadius: 999, buttonBorderWidth: 0, buttonShadow: false, socialLayout: "horizontal", sectionOrder: ["links", "socials"] }
  },
  {
    id: "ocean-electric", name: "Ocean Electric",
    style: { accentColor: "#06B6D4", buttonStyle: "filled", backgroundType: "gradient", backgroundColor: "#082F49", backgroundColorTo: "#0EA5E9", textColor: "#ECFEFF", cardStyle: "glass", cardColor: "#0C4A6E", cardOpacity: 66, fontFamily: "poppins", buttonTextColor: "#FFFFFF", buttonRadius: 12, buttonBorderWidth: 0, buttonShadow: true, socialLayout: "horizontal", sectionOrder: ["links", "socials"] }
  },
  {
    id: "forest-night", name: "Forest Night",
    style: { accentColor: "#22C55E", buttonStyle: "soft", backgroundType: "gradient", backgroundColor: "#052E16", backgroundColorTo: "#166534", textColor: "#ECFDF5", cardStyle: "solid", cardColor: "#14532D", cardOpacity: 78, fontFamily: "space-grotesk", buttonTextColor: "#BBF7D0", buttonRadius: 14, buttonBorderWidth: 0, buttonShadow: false, socialLayout: "horizontal", sectionOrder: ["links", "socials"] }
  },
  {
    id: "sunset-haze", name: "Sunset Haze",
    style: { accentColor: "#F97316", buttonStyle: "filled", backgroundType: "gradient", backgroundColor: "#7C2D12", backgroundColorTo: "#FDBA74", textColor: "#FFF7ED", cardStyle: "glass", cardColor: "#9A3412", cardOpacity: 62, fontFamily: "poppins", buttonTextColor: "#FFFFFF", buttonRadius: 16, buttonBorderWidth: 0, buttonShadow: true, socialLayout: "horizontal", sectionOrder: ["links", "socials"] }
  },
];

const SOCIAL_PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "custom", label: "Custom" },
] as const;

const SOCIAL_MODES = [
  { value: "link", label: "Link" },
  { value: "profile", label: "Profile" },
  { value: "posts", label: "Posts" },
  { value: "reels", label: "Reels" },
] as const;

function isValidUrl(url: string) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// ── Main page ─────────────────────────────────────────────────────────────────

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

  return (
    <div>
      <PageHeader
        eyebrow="Distribute"
        title="Bio Link"
        description="Manage the links and socials on your Liffio bio page."
        actions={
          profile?.publicUrl ? (
            <Button size="sm" variant="outline" className="gap-1.5" asChild>
              <a href={profile.publicUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                View live
              </a>
            </Button>
          ) : null
        }
      />

      <div className="space-y-6 p-4 sm:p-6 md:p-10">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Total clicks" value={String(analytics?.totalClicks ?? profile?.totalClicks ?? 0)} icon={MousePointerClick} />
          <StatCard label="Links" value={String(profile?.links.length ?? 0)} icon={Link2} />
          <StatCard label="Top link" value={analytics?.links[0]?.title ?? "—"} icon={MousePointerClick} hint={analytics?.links[0] ? `${analytics.links[0].clicks} clicks` : undefined} />
        </section>

        <Tabs defaultValue="links">
          <TabsList className="mb-4">
            <TabsTrigger value="links">Links</TabsTrigger>
            <TabsTrigger value="socials">Socials</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
          </TabsList>

          <TabsContent value="links">
            {bioQuery.isLoading ? (
              <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
            ) : (
              <LinksEditor workspaceId={workspaceId} links={profile?.links ?? []} onUpdate={invalidate} />
            )}
          </TabsContent>

          <TabsContent value="socials">
            {bioQuery.isLoading ? (
              <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
            ) : (
              <SocialsEditor workspaceId={workspaceId} socials={profile?.socials ?? []} onUpdate={invalidate} />
            )}
          </TabsContent>

          <TabsContent value="profile">
            {bioQuery.isLoading ? (
              <Skeleton className="h-60 w-full rounded-2xl" />
            ) : profile ? (
              <ProfileEditor workspaceId={workspaceId} profile={profile} onUpdate={invalidate} />
            ) : null}
          </TabsContent>

          <TabsContent value="appearance">
            {bioQuery.isLoading ? (
              <Skeleton className="h-96 w-full rounded-2xl" />
            ) : profile ? (
              <AppearanceEditor workspaceId={workspaceId} profile={profile} onUpdate={invalidate} />
            ) : null}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ── Links editor ──────────────────────────────────────────────────────────────

function LinksEditor({ workspaceId, links, onUpdate }: { workspaceId: string; links: BioLinkItem[]; onUpdate: () => void }) {
  const [items, setItems] = useState<DraftLink[]>(links);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<DraftLink | null>(null);
  const [deleting, setDeleting] = useState<DraftLink | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => { setItems(links); }, [links]);

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

  const onDragStart = (id: string) => setDraggingId(id);
  const onDragOver = (e: React.DragEvent, overId: string) => {
    e.preventDefault();
    if (!draggingId || draggingId === overId) return;
    setItems((prev) => {
      const from = prev.findIndex((item) => item.id === draggingId);
      const to = prev.findIndex((item) => item.id === overId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next.map((item, idx) => ({ ...item, order: idx }));
    });
  };
  const onDrop = () => {
    setDraggingId(null);
    reorderMutation.mutate(items.map((i) => i.id));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Add link
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center shadow-soft">
          <Link2 className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-3 font-display text-lg font-semibold">No links yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">Add links to appear on your bio page.</p>
          <Button size="sm" className="mt-4 gap-1.5" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add first link</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((link) => (
            <div
              key={link.id}
              draggable
              onDragStart={() => onDragStart(link.id)}
              onDragOver={(e) => onDragOver(e, link.id)}
              onDrop={onDrop}
              className={`flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5 shadow-soft transition-opacity cursor-grab active:cursor-grabbing ${draggingId === link.id ? "opacity-50" : ""}`}
            >
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">{link.title}</p>
                <p className="truncate text-xs text-muted-foreground">{link.url}</p>
              </div>
              <button className="text-muted-foreground hover:text-foreground" onClick={() => setEditing(link)}><Edit2 className="h-4 w-4" /></button>
              <button className="text-muted-foreground hover:text-destructive" onClick={() => setDeleting(link)}><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}

      <LinkDialog open={addOpen} onOpenChange={setAddOpen} title="Add link" isPending={addMutation.isPending} onSubmit={(data) => addMutation.mutate(data)} />
      <LinkDialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)} title="Edit link" initialTitle={editing?.title} initialUrl={editing?.url} isPending={updateMutation.isPending} onSubmit={(data) => editing && updateMutation.mutate({ id: editing.id, ...data })} />

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

// ── Socials editor ────────────────────────────────────────────────────────────

function SocialsEditor({ workspaceId, socials, onUpdate }: { workspaceId: string; socials: BioLinkSocialItem[]; onUpdate: () => void }) {
  const [items, setItems] = useState<DraftSocial[]>(socials);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<DraftSocial | null>(null);
  const [deleting, setDeleting] = useState<DraftSocial | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => { setItems(socials); }, [socials]);

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

  const onDragStart = (id: string) => setDraggingId(id);
  const onDragOver = (e: React.DragEvent, overId: string) => {
    e.preventDefault();
    if (!draggingId || draggingId === overId) return;
    setItems((prev) => {
      const from = prev.findIndex((item) => item.id === draggingId);
      const to = prev.findIndex((item) => item.id === overId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next.map((item, idx) => ({ ...item, order: idx }));
    });
  };
  const onDrop = () => {
    setDraggingId(null);
    reorderMutation.mutate(items.map((i) => i.id));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Add social
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center shadow-soft">
          <Link2 className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-3 font-display text-lg font-semibold">No socials yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">Add social links to display on your bio page.</p>
          <Button size="sm" className="mt-4 gap-1.5" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add social</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((social) => (
            <div
              key={social.id}
              draggable
              onDragStart={() => onDragStart(social.id)}
              onDragOver={(e) => onDragOver(e, social.id)}
              onDrop={onDrop}
              className={`flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5 shadow-soft transition-opacity cursor-grab active:cursor-grabbing ${draggingId === social.id ? "opacity-50" : ""}`}
            >
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">{social.label}</p>
                <p className="truncate text-xs text-muted-foreground">{social.url} · {social.platform ?? "custom"}</p>
              </div>
              <button className="text-muted-foreground hover:text-foreground" onClick={() => setEditing(social)}><Edit2 className="h-4 w-4" /></button>
              <button className="text-muted-foreground hover:text-destructive" onClick={() => setDeleting(social)}><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}

      <SocialDialog open={addOpen} onOpenChange={setAddOpen} title="Add social" isPending={addMutation.isPending} onSubmit={(data) => addMutation.mutate(data)} />
      <SocialDialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)} title="Edit social" initial={editing ?? undefined} isPending={updateMutation.isPending} onSubmit={(data) => editing && updateMutation.mutate({ id: editing.id, ...data })} />

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

function SocialDialog({ open, onOpenChange, title, initial, isPending, onSubmit }: {
  open: boolean; onOpenChange: (v: boolean) => void; title: string;
  initial?: BioLinkSocialItem; isPending: boolean;
  onSubmit: (data: BioLinkSocialInput) => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "Instagram");
  const [url, setUrl] = useState(initial?.url ?? "https://instagram.com/");
  const [platform, setPlatform] = useState<"instagram" | "custom">(initial?.platform ?? "instagram");
  const [mode, setMode] = useState<"link" | "profile" | "posts" | "reels">(initial?.mode ?? "profile");
  const [icon, setIcon] = useState(initial?.icon ?? "instagram");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "📸");

  useEffect(() => {
    setLabel(initial?.label ?? "Instagram");
    setUrl(initial?.url ?? "https://instagram.com/");
    setPlatform(initial?.platform ?? "instagram");
    setMode(initial?.mode ?? "profile");
    setIcon(initial?.icon ?? "instagram");
    setEmoji(initial?.emoji ?? "📸");
  }, [initial, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Label</Label>
            <Input placeholder="Instagram" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>URL</Label>
            <Input type="url" placeholder="https://instagram.com/handle" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Platform</Label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value as typeof platform)} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                {SOCIAL_PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Mode</Label>
              <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                {SOCIAL_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Icon key</Label>
              <Input placeholder="instagram" value={icon} onChange={(e) => setIcon(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Emoji</Label>
              <Input placeholder="📸" value={emoji} onChange={(e) => setEmoji(e.target.value)} />
            </div>
          </div>
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

// ── Profile editor ────────────────────────────────────────────────────────────

function ProfileEditor({ workspaceId, profile, onUpdate }: { workspaceId: string; profile: BioLinkProfile; onUpdate: () => void }) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [slug, setSlug] = useState(profile.slug);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? "");

  const publicUrl = useMemo(() => `https://bio.liffio.com/${slug || "your-slug"}`, [slug]);

  const saveMutation = useMutation({
    mutationFn: () => updateBioLink(workspaceId, {
      displayName: displayName || profile.displayName,
      bio: bio || null,
      slug: slug || workspaceId,
      avatarUrl: avatarUrl || undefined,
    }),
    onSuccess: () => { toast.success("Profile saved"); onUpdate(); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-5 max-w-xl">
      <div className="space-y-2">
        <Label>Display name</Label>
        <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} />
      </div>
      <div className="space-y-2">
        <Label>Bio</Label>
        <textarea
          className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          rows={3}
          placeholder="A short bio…"
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, 160))}
          maxLength={160}
        />
        <p className="text-right text-xs text-muted-foreground">{bio.length}/160</p>
      </div>
      <div className="space-y-2">
        <Label>Slug (URL path)</Label>
        <div className="flex items-center rounded-md border bg-background">
          <span className="px-3 text-sm text-muted-foreground">bio.liffio.com/</span>
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            placeholder="your-brand"
            maxLength={40}
            className="border-0 bg-transparent focus-visible:ring-0"
          />
        </div>
        <p className="text-xs text-muted-foreground font-mono">{publicUrl}</p>
      </div>
      <div className="space-y-2">
        <Label>Avatar URL</Label>
        <Input type="url" placeholder="https://example.com/avatar.jpg" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
        {avatarUrl && isValidUrl(avatarUrl) && (
          <img src={avatarUrl} alt="Avatar preview" className="h-14 w-14 rounded-full object-cover border" />
        )}
      </div>
      <div className="flex justify-end">
        <Button size="sm" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          {saveMutation.isPending ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </div>
  );
}

// ── Appearance editor ─────────────────────────────────────────────────────────

function AppearanceEditor({ workspaceId, profile, onUpdate }: { workspaceId: string; profile: BioLinkProfile; onUpdate: () => void }) {
  const [draft, setDraft] = useState<AppearanceDraft>({
    accentColor: profile.accentColor,
    buttonStyle: profile.buttonStyle,
    backgroundType: profile.backgroundType,
    backgroundColor: profile.backgroundColor,
    backgroundColorTo: profile.backgroundColorTo,
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
  });
  const [resetOpen, setResetOpen] = useState(false);

  const saveMutation = useMutation({
    mutationFn: () => updateBioLink(workspaceId, { displayName: profile.displayName, ...draft }),
    onSuccess: () => { toast.success("Appearance saved"); onUpdate(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const resetMutation = useMutation({
    mutationFn: () => resetBioLink(workspaceId),
    onSuccess: () => { toast.success("Bio link reset to defaults"); setResetOpen(false); onUpdate(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const applyTemplate = (templateId: string) => {
    const t = bioTemplates.find((x) => x.id === templateId);
    if (t) setDraft((prev) => ({ ...prev, ...t.style }));
  };

  const set = <K extends keyof AppearanceDraft>(key: K, value: AppearanceDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Templates */}
      <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
        <h3 className="font-display font-semibold">Templates</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {bioTemplates.map((t) => (
            <button
              key={t.id}
              onClick={() => applyTemplate(t.id)}
              title={t.name}
              className="group relative h-16 rounded-xl border-2 border-transparent hover:border-primary transition-colors overflow-hidden"
              style={{
                background: t.style.backgroundType === "gradient"
                  ? `linear-gradient(135deg, ${t.style.backgroundColor}, ${t.style.backgroundColorTo})`
                  : t.style.backgroundColor
              }}
            >
              <span className="absolute inset-0 flex items-end p-1.5">
                <span className="text-[10px] font-medium rounded px-1.5 py-0.5 bg-black/40 text-white backdrop-blur-sm leading-tight">{t.name}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Background */}
      <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
        <h3 className="font-display font-semibold">Background</h3>
        <div className="space-y-2">
          <Label>Type</Label>
          <div className="flex gap-2">
            {(["solid", "gradient"] as const).map((t) => (
              <button key={t} onClick={() => set("backgroundType", t)} className={`px-3 py-1.5 rounded-lg border text-sm capitalize transition-colors ${draft.backgroundType === t ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}>{t}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{draft.backgroundType === "gradient" ? "From" : "Color"}</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={draft.backgroundColor} onChange={(e) => set("backgroundColor", e.target.value)} className="h-9 w-9 rounded border cursor-pointer" />
              <Input value={draft.backgroundColor} onChange={(e) => set("backgroundColor", e.target.value)} className="font-mono text-xs" />
            </div>
          </div>
          {draft.backgroundType === "gradient" && (
            <div className="space-y-2">
              <Label>To</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={draft.backgroundColorTo} onChange={(e) => set("backgroundColorTo", e.target.value)} className="h-9 w-9 rounded border cursor-pointer" />
                <Input value={draft.backgroundColorTo} onChange={(e) => set("backgroundColorTo", e.target.value)} className="font-mono text-xs" />
              </div>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label>Text color</Label>
          <div className="flex items-center gap-2">
            <input type="color" value={draft.textColor} onChange={(e) => set("textColor", e.target.value)} className="h-9 w-9 rounded border cursor-pointer" />
            <Input value={draft.textColor} onChange={(e) => set("textColor", e.target.value)} className="font-mono text-xs" />
          </div>
        </div>
      </div>

      {/* Accent & buttons */}
      <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
        <h3 className="font-display font-semibold">Accent & Buttons</h3>
        <div className="space-y-2">
          <Label>Accent color</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {swatches.map((s) => (
              <button key={s} onClick={() => set("accentColor", s)} className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${draft.accentColor === s ? "border-foreground scale-110" : "border-transparent"}`} style={{ background: s }} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="color" value={draft.accentColor} onChange={(e) => set("accentColor", e.target.value)} className="h-9 w-9 rounded border cursor-pointer" />
            <Input value={draft.accentColor} onChange={(e) => set("accentColor", e.target.value)} className="font-mono text-xs" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Button style</Label>
          <div className="flex gap-2">
            {(["filled", "outlined", "soft"] as const).map((s) => (
              <button key={s} onClick={() => set("buttonStyle", s)} className={`px-3 py-1.5 rounded-lg border text-sm capitalize transition-colors ${draft.buttonStyle === s ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}>{s}</button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Button text color</Label>
          <div className="flex items-center gap-2">
            <input type="color" value={draft.buttonTextColor} onChange={(e) => set("buttonTextColor", e.target.value)} className="h-9 w-9 rounded border cursor-pointer" />
            <Input value={draft.buttonTextColor} onChange={(e) => set("buttonTextColor", e.target.value)} className="font-mono text-xs" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Corner radius: {draft.buttonRadius}px</Label>
            <input type="range" min={0} max={999} value={draft.buttonRadius} onChange={(e) => set("buttonRadius", Number(e.target.value))} className="w-full" />
          </div>
          <div className="space-y-2">
            <Label>Border width: {draft.buttonBorderWidth}px</Label>
            <input type="range" min={0} max={4} value={draft.buttonBorderWidth} onChange={(e) => set("buttonBorderWidth", Number(e.target.value))} className="w-full" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Label>Button shadow</Label>
          <Switch checked={draft.buttonShadow} onCheckedChange={(v) => set("buttonShadow", v)} />
        </div>
      </div>

      {/* Cards */}
      <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
        <h3 className="font-display font-semibold">Cards</h3>
        <div className="space-y-2">
          <Label>Card style</Label>
          <div className="flex gap-2">
            {(["solid", "glass", "outline"] as const).map((s) => (
              <button key={s} onClick={() => set("cardStyle", s)} className={`px-3 py-1.5 rounded-lg border text-sm capitalize transition-colors ${draft.cardStyle === s ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}>{s}</button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Card color</Label>
          <div className="flex items-center gap-2">
            <input type="color" value={draft.cardColor} onChange={(e) => set("cardColor", e.target.value)} className="h-9 w-9 rounded border cursor-pointer" />
            <Input value={draft.cardColor} onChange={(e) => set("cardColor", e.target.value)} className="font-mono text-xs" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Card opacity: {draft.cardOpacity}%</Label>
          <input type="range" min={10} max={100} value={draft.cardOpacity} onChange={(e) => set("cardOpacity", Number(e.target.value))} className="w-full" />
        </div>
      </div>

      {/* Font & layout */}
      <div className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
        <h3 className="font-display font-semibold">Font & Layout</h3>
        <div className="space-y-2">
          <Label>Font family</Label>
          <select value={draft.fontFamily} onChange={(e) => set("fontFamily", e.target.value as AppearanceDraft["fontFamily"])} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
            {(["inter", "poppins", "space-grotesk", "playfair"] as const).map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Social icons layout</Label>
          <div className="flex gap-2">
            {(["horizontal", "vertical"] as const).map((l) => (
              <button key={l} onClick={() => set("socialLayout", l)} className={`px-3 py-1.5 rounded-lg border text-sm capitalize transition-colors ${draft.socialLayout === l ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Section order</Label>
          <p className="text-xs text-muted-foreground">Drag to reorder the sections on your bio page.</p>
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
                className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 cursor-grab"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm capitalize">{section}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setResetOpen(true)}>
          <RotateCcw className="h-4 w-4" /> Reset to default
        </Button>
        <Button size="sm" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          {saveMutation.isPending ? "Saving…" : "Save appearance"}
        </Button>
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
