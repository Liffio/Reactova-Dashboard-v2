import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import {
  TrendingUp, ShoppingBag, Instagram, Check, X, Lock, Info, Plus,
  Zap, Infinity as InfinityIcon, MessageSquare, UserCheck, ChevronLeft,
  Calendar, ArrowRight,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setAuthMe } from "@/store/authSlice";
import type { AuthMePayload } from "@/types/auth";
import { toast } from "sonner";

const NICHES = [
  "Business & Marketing", "Fitness & Nutrition", "Education & Coaching",
  "Finance & Trading", "Technology & IT", "Design & Arts",
  "Travel & Lifestyle", "Beauty & Personal Care", "Entertainment & Media",
  "Food & Cooking", "Law & Legal Services", "Other",
];

type MetaOAuthDiagnostic = {
  code?: string;
  at?: string;
  targetHandle?: string | null;
  pageCount?: number;
  pages?: Array<{
    id: string;
    name?: string | null;
    hasInstagramBusinessAccount?: boolean;
    hasConnectedInstagramAccount?: boolean;
    instagramBusinessUsername?: string | null;
    connectedInstagramUsername?: string | null;
  }>;
};

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const dispatch = useAppDispatch();
  const workspaceIdFromStore = useAppSelector((state) => state.auth.workspaceId);
  const isOnboarded = useAppSelector((state) => state.auth.isOnboarded);
  const [step, setStep] = useState(1);
  const [niches, setNiches] = useState<string[]>([]);
  const [handle, setHandle] = useState("");
  const [goal, setGoal] = useState<"grow" | "sell" | null>(null);
  const [igConnected, setIgConnected] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [metaFixReason, setMetaFixReason] = useState<string | null>(null);
  const [metaDiagnostic, setMetaDiagnostic] = useState<MetaOAuthDiagnostic | null>(null);

  const resolveWorkspaceId = async () => {
    if (workspaceIdFromStore) {
      return workspaceIdFromStore;
    }

    const authMe = await apiRequest<AuthMePayload>("/api/v1/auth/me");
    dispatch(setAuthMe(authMe));
    if (!authMe.workspaceId) {
      throw new Error("Missing workspace context. Please sign in again.");
    }

    return authMe.workspaceId;
  };

  const saveWorkspace = useMutation({
    mutationFn: async (body: { igHandle?: string; onboarding?: Record<string, unknown> }) => {
      const workspaceId = await resolveWorkspaceId();
      return apiRequest(`/api/v1/workspaces/${workspaceId}`, {
        method: "PATCH",
        workspaceId,
        body
      });
    }
  });

  const startMetaOAuth = useMutation({
    mutationFn: async () => {
      const workspaceId = await resolveWorkspaceId();
      const { url } = await apiRequest<{ url: string }>("/api/v1/integrations/meta/oauth/start", {
        workspaceId
      });
      window.location.href = url;
    }
  });

  const completeOnboarding = useMutation({
    mutationFn: async () => {
      const workspaceId = await resolveWorkspaceId();
      await apiRequest(`/api/v1/workspaces/${workspaceId}`, {
        method: "PATCH",
        workspaceId,
        body: {
          isOnboarded: true
        }
      });
      const authMe = await apiRequest<AuthMePayload>("/api/v1/auth/me", { workspaceId });
      dispatch(setAuthMe(authMe));
    }
  });

  const loadMetaDiagnostic = async () => {
    const workspaceId = await resolveWorkspaceId();
    const workspaces = await apiRequest<Array<{ id: string; meta?: Record<string, unknown> }>>("/api/v1/workspaces");
    const workspace = workspaces.find((item) => item.id === workspaceId);
    const diagnostic = (workspace?.meta?.lastOAuthDiagnostic as MetaOAuthDiagnostic | undefined) ?? null;
    setMetaDiagnostic(diagnostic);
  };

  useEffect(() => {
    if (isOnboarded) {
      navigate("/dashboard", { replace: true });
    }
  }, [isOnboarded, navigate]);

  useEffect(() => {
    const connected = searchParams.get("meta");
    const stepParam = searchParams.get("step");
    const parsedStep = Number(stepParam);
    const requestedStep = Number.isFinite(parsedStep) ? Math.max(1, Math.min(4, parsedStep)) : null;
    if (connected === "connected=1" || connected === "connected") {
      setIgConnected(true);
      setMetaFixReason(null);
      setMetaDiagnostic(null);
      setStep((prev) => Math.max(prev, requestedStep ?? 4));
      toast.success("Instagram connected via Meta");
      searchParams.delete("meta");
      searchParams.delete("step");
      setSearchParams(searchParams, { replace: true });
    }
    if (connected === "error") {
      const reason = searchParams.get("reason");
      const decodedReason = reason ? decodeURIComponent(reason) : "";
      setMetaFixReason(decodedReason || null);
      setStep((prev) => (prev >= 3 ? prev : 3));
      if (decodedReason === "no_instagram_business_account") {
        void loadMetaDiagnostic().catch(() => {
          setMetaDiagnostic(null);
        });
      }
      toast.error(decodedReason ? `Meta connect failed: ${decodedReason}` : "Meta connect failed");
      searchParams.delete("meta");
      searchParams.delete("reason");
      searchParams.delete("step");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const openExternal = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const canNext =
    (step === 1 && niches.length > 0 && handle.trim().length > 0) ||
    (step === 2 && goal !== null) ||
    (step === 3 && igConnected) ||
    step === 4;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <ThemeToggle className="fixed top-4 right-4 p-2 rounded-lg border border-border bg-card/80 backdrop-blur hover:bg-card transition-colors z-20" />
      <div className="absolute top-6 left-6"><Logo /></div>

      {/* Step card */}
      <div className="w-full max-w-2xl bg-card border border-border rounded-2xl p-8 shadow-2xl animate-fade-in">
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Hi Alex 👋 — what type of content do you create?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                This helps us tailor your dashboard with relevant examples and templates.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {NICHES.map((n) => {
                const sel = niches.includes(n);
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() =>
                      setNiches((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]))
                    }
                    className={cn(
                      "px-3.5 py-2 rounded-full text-sm border transition-all",
                      sel
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            <div className="h-px bg-border" />
            <div className="space-y-2">
              <Label htmlFor="ig">What's your Instagram handle?</Label>
              <div className="relative">
                <Instagram className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <span className="absolute left-9 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                <Input
                  id="ig"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.replace(/^@/, ""))}
                  className="pl-12 bg-input border-border"
                  placeholder="yourbrand"
                />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">What's your #1 goal right now?</h2>
              <p className="text-sm text-muted-foreground mt-1">Helps us show you the most relevant features first.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <GoalCard
                selected={goal === "grow"}
                onClick={() => setGoal("grow")}
                icon={<TrendingUp className="h-9 w-9 text-primary" />}
                title="Grow my followers & audience on Instagram"
                desc="Use automations to grow engagement and reach"
              />
              <GoalCard
                selected={goal === "sell"}
                onClick={() => setGoal("sell")}
                icon={<ShoppingBag className="h-9 w-9 text-accent" />}
                title="Sell products or services to my audience"
                desc="Convert DMs into leads, sales, and customers"
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Let's connect your Instagram account</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Reactova uses the official Instagram Business API — you'll log in directly with your Instagram credentials.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <div className="h-5 w-5 rounded-md bg-info/20 flex items-center justify-center">
                <span className="text-info font-bold text-[10px]">M</span>
              </div>
              Reactova is an official Meta Tech Partner
            </div>

            <div className="h-px bg-border" />

            {/* Step 1: Connect IG */}
            <div className={cn("p-4 rounded-xl border", igConnected ? "border-success/30 bg-success/5" : "border-border bg-background")}>
              <div className="flex items-start gap-3">
                <div className={cn("h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5", igConnected ? "bg-success border-success" : "border-border")}>
                  {igConnected && <Check className="h-3.5 w-3.5 text-white" />}
                </div>
                <div className="flex-1">
                  <div className={cn("font-semibold", igConnected && "line-through text-muted-foreground")}>
                    Step 1: Connect your Instagram Account
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    You'll be able to create automations after connecting your account.
                  </p>
                  <div className="mt-3">
                    {igConnected ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/15 text-success text-xs font-medium">
                        <Check className="h-3 w-3" /> Connected
                      </span>
                    ) : (
                      <Button
                        onClick={async () => {
                          try {
                            await startMetaOAuth.mutateAsync();
                          } catch (error) {
                            toast.error((error as Error).message);
                          }
                        }}
                        className="w-full sm:w-auto"
                        disabled={startMetaOAuth.isPending}
                      >
                        <Instagram className="h-4 w-4" />{" "}
                        {startMetaOAuth.isPending ? "Connecting…" : "Connect Instagram"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Create automation */}
            <div className={cn("p-4 rounded-xl border bg-background", !igConnected && "opacity-50")}>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full border-2 border-border flex items-center justify-center shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold">Step 2: Create your first Automation</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    We'll walk you through it in the next step.
                  </p>
                </div>
              </div>
            </div>

            {metaFixReason === "no_instagram_business_account" && (
              <div className="p-4 rounded-xl border border-warning/40 bg-warning/5 space-y-3">
                <div className="text-sm font-semibold">Fix these before reconnecting Instagram</div>
                <p className="text-xs text-muted-foreground">
                  We could not find a linked Instagram account on your authorized Facebook Page. Complete this checklist,
                  then retry from here.
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 mt-0.5 text-warning" />
                    <span>Use an Instagram Professional account (Creator or Business).</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 mt-0.5 text-warning" />
                    <span>Link that Instagram account to the same Facebook Page you authorize in Meta login.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 mt-0.5 text-warning" />
                    <span>Enable message access in Instagram privacy settings for connected tools.</span>
                  </div>
                </div>
                {metaDiagnostic && (
                  <div className="rounded-lg border border-border bg-background p-3 space-y-2">
                    <div className="text-xs font-semibold">Latest connection diagnostics</div>
                    <div className="text-xs text-muted-foreground">
                      {metaDiagnostic.pageCount ?? 0} page(s) returned from Meta
                      {metaDiagnostic.targetHandle ? ` for @${metaDiagnostic.targetHandle.replace(/^@/, "")}` : ""}.
                    </div>
                    {(metaDiagnostic.pages ?? []).slice(0, 3).map((page) => (
                      <div key={page.id} className="text-xs border border-border rounded-md p-2">
                        <div className="font-medium">{page.name || "Unnamed page"} ({page.id})</div>
                        <div className="text-muted-foreground">
                          instagram_business_account: {page.hasInstagramBusinessAccount ? "linked" : "not linked"}
                        </div>
                        <div className="text-muted-foreground">
                          connected_instagram_account: {page.hasConnectedInstagramAccount ? "linked" : "not linked"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openExternal("https://www.instagram.com/accounts/edit/")}
                  >
                    Open Instagram settings
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openExternal("https://www.facebook.com/pages/?category=your_pages")}
                  >
                    Open Facebook Pages
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openExternal("https://business.facebook.com/settings")}
                  >
                    Open Meta business settings
                  </Button>
                </div>
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  disabled={startMetaOAuth.isPending}
                  onClick={async () => {
                    try {
                      await startMetaOAuth.mutateAsync();
                    } catch (error) {
                      toast.error((error as Error).message);
                    }
                  }}
                >
                  {startMetaOAuth.isPending ? "Rechecking with Meta..." : "I fixed this, reconnect now"}
                </Button>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 text-center py-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-primary/15 flex items-center justify-center">
              <Zap className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Build your first automation</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                Every comment that matches your keyword will receive a personalized DM — automatically.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button onClick={() => setShowWizard(true)} variant="accent" size="lg">
                Start Building <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                disabled={completeOnboarding.isPending}
                onClick={async () => {
                  try {
                    await completeOnboarding.mutateAsync();
                    navigate("/dashboard", { replace: true });
                  } catch (error) {
                    toast.error((error as Error).message);
                  }
                }}
              >
                {completeOnboarding.isPending ? "Completing..." : "Finish onboarding"}
              </Button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 flex items-center justify-between gap-4">
          <div className="flex-1 max-w-xs">
            <div className="text-xs text-muted-foreground mb-1.5">Step {step} of 4</div>
            <div className="h-1 bg-border rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${(step / 4) * 100}%` }} />
            </div>
          </div>
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)}>Back</Button>
            )}
            {step < 4 && (
              <Button variant="ghost" onClick={() => setStep((s) => s + 1)}>
                Skip
              </Button>
            )}
            {step < 4 && (
              <Button
                onClick={async () => {
                  try {
                    if (step === 1) {
                      await saveWorkspace.mutateAsync({
                        igHandle: handle ? `@${handle}` : undefined,
                        onboarding: { niches, step: 1 }
                      });
                    }
                    if (step === 2) {
                      await saveWorkspace.mutateAsync({ onboarding: { goal, step: 2 } });
                    }
                    setStep((s) => s + 1);
                  } catch (error) {
                    toast.error((error as Error).message);
                  }
                }}
                disabled={!canNext || saveWorkspace.isPending}
              >
                Next
              </Button>
            )}
          </div>
        </div>
      </div>

      {showWizard && (
        <AutomationWizard
          onClose={() => setShowWizard(false)}
          onLaunch={async () => {
            try {
              await completeOnboarding.mutateAsync();
              setShowWizard(false);
              setShowCompletion(true);
            } catch (error) {
              toast.error((error as Error).message);
            }
          }}
        />
      )}
      {showCompletion && (
        <CompletionModal onDone={() => navigate("/dashboard")} />
      )}
    </div>
  );
}

function GoalCard({ selected, onClick, icon, title, desc }: { selected: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative text-left p-5 rounded-xl border transition-all bg-background",
        selected ? "border-primary glow-primary" : "border-border hover:border-muted-foreground/40"
      )}
    >
      <div className={cn("absolute top-3 right-3 h-4 w-4 rounded-full border-2", selected ? "bg-primary border-primary" : "border-muted-foreground/40")}>
        {selected && <div className="h-1.5 w-1.5 rounded-full bg-white m-auto mt-[3px]" />}
      </div>
      <div className="mb-3">{icon}</div>
      <div className="font-semibold text-sm">{title}</div>
      <p className="text-xs text-muted-foreground mt-1">{desc}</p>
    </button>
  );
}

/* ----------------- Automation Wizard Modal ----------------- */
function AutomationWizard({ onClose, onLaunch }: { onClose: () => void; onLaunch: () => void }) {
  const [sub, setSub] = useState<1 | 2 | 3 | 4>(1);
  const [postMode, setPostMode] = useState<"specific" | "any" | "next">("specific");
  const [selectedPost, setSelectedPost] = useState<number | null>(0);
  const [keywordMode, setKeywordMode] = useState<"specific" | "any">("specific");
  const [keywords, setKeywords] = useState<string[]>(["GUIDE"]);
  const [kwInput, setKwInput] = useState("");
  const [autoReply, setAutoReply] = useState(true);
  const [replies, setReplies] = useState(["Sent! Check your DMs 💌", "On its way to your inbox ✨", "Just DM'd you the link 🔥"]);
  const [dmType, setDmType] = useState("text-button");
  const [dmText, setDmText] = useState("Hi there! Appreciate your comment 🙌 As promised, here's the link for you ⬇️");
  const [hasButton, setHasButton] = useState(true);
  const [btnLabel, setBtnLabel] = useState("Get Your Free Guide");
  const [btnUrl, setBtnUrl] = useState("https://reactova.com/guide");

  const addKw = () => {
    const v = kwInput.trim();
    if (!v) return;
    if (!keywords.includes(v.toUpperCase())) setKeywords((k) => [...k, v.toUpperCase()]);
    setKwInput("");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
            <div className="text-sm font-semibold truncate">When someone comments on your Post/Reel</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-accent to-primary" />
          <div className="text-sm font-medium">@yourbrand</div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 scrollbar-thin">
          {sub === 1 && (
            <>
              <Label>The Comment is on...</Label>
              <Segmented
                value={postMode}
                onChange={(v) => setPostMode(v as any)}
                options={[
                  { v: "specific", l: "Specific Post/Reel" },
                  { v: "any", l: "Any Post/Reel" },
                  { v: "next", l: "Next Post/Reel" },
                ]}
              />
              {postMode === "specific" && (
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedPost(i)}
                      className={cn(
                        "relative aspect-square rounded-lg border-2 bg-muted overflow-hidden transition-all",
                        selectedPost === i ? "border-primary" : "border-border hover:border-muted-foreground/50"
                      )}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10" />
                      {selectedPost === i && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-4 w-4 text-white" />
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {sub === 2 && (
            <>
              <Label>What kind of comment should trigger this automation?</Label>
              <Segmented
                value={keywordMode}
                onChange={(v) => setKeywordMode(v as any)}
                options={[
                  { v: "specific", l: "Specific keyword" },
                  { v: "any", l: "Any comment" },
                ]}
              />
              {keywordMode === "specific" && (
                <>
                  <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 flex gap-2 text-xs text-warning">
                    <Info className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>You can add 1 keyword per automation on the Free plan. <a className="underline">Upgrade for unlimited keywords.</a></span>
                  </div>
                  <Label>Should include any of these:</Label>
                  <div className="flex gap-2">
                    <Input
                      value={kwInput}
                      onChange={(e) => setKwInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKw(); } }}
                      placeholder="e.g. GUIDE"
                      className="bg-input border-border"
                    />
                    <Button variant="outline" onClick={addKw}><Plus className="h-4 w-4" /> Add</Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {keywords.map((k) => (
                      <span key={k} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-xs">
                        {k}
                        <button onClick={() => setKeywords((kw) => kw.filter((x) => x !== k))} className="text-muted-foreground hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Keywords are not case-sensitive. Exact matches only.</p>
                  <button className="text-xs text-primary inline-flex items-center gap-1"><Info className="h-3 w-3" /> Add excluded keywords?</button>
                </>
              )}

              <div className="h-px bg-border my-3" />

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Auto-Reply to comments on the post</div>
                  <p className="text-xs text-muted-foreground">3 random replies keep your responses looking natural — not bot-like</p>
                </div>
                <Switch checked={autoReply} onCheckedChange={setAutoReply} />
              </div>

              {autoReply && (
                <div className="space-y-2">
                  {replies.map((r, i) => (
                    <div key={i}>
                      <Label className="text-xs">Comment response {i + 1}</Label>
                      <Textarea
                        value={r}
                        onChange={(e) => {
                          const next = [...replies]; next[i] = e.target.value.slice(0, 140); setReplies(next);
                        }}
                        maxLength={140}
                        rows={2}
                        className="bg-input border-border resize-none"
                      />
                      <div className="text-[10px] text-muted-foreground text-right">{r.length}/140</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {sub === 3 && (
            <>
              <Label>Before you send your primary DM, send them...</Label>
              <div className="space-y-2">
                <LockedCard label="a DM asking to follow you" />
                <LockedCard label="a DM asking to share their email" />
              </div>
              <div className="h-px bg-border" />
              <Label>Then send the primary DM...</Label>
              <p className="text-xs text-muted-foreground">Write the message that gets automatically sent when someone comments</p>
              <Select value={dmType} onValueChange={setDmType}>
                <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text-button">Text + Button</SelectItem>
                  <SelectItem value="text">Text only</SelectItem>
                </SelectContent>
              </Select>

              <div className="relative">
                <Textarea
                  value={dmText}
                  onChange={(e) => setDmText(e.target.value.slice(0, 900))}
                  rows={4}
                  className="bg-input border-border resize-none"
                />
                <div className="text-[10px] text-muted-foreground text-right">{dmText.length}/900</div>
                <p className="text-[11px] italic text-muted-foreground mt-1">
                  Sent via @Reactova · <a className="text-primary underline">To remove branding, Upgrade →</a>
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <button className="text-primary inline-flex items-center gap-1"><Plus className="h-3 w-3" /> Add a variable</button>
                <span className="text-muted-foreground">→ {"{{name}}"} {"{{username}}"} {"{{keyword}}"}</span>
              </div>

              {dmType === "text-button" && (
                hasButton ? (
                  <div className="p-3 rounded-lg border border-border bg-background space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Button</Label>
                      <button onClick={() => setHasButton(false)} className="text-muted-foreground hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Input value={btnLabel} onChange={(e) => setBtnLabel(e.target.value)} placeholder="Button label" className="bg-input border-border" />
                    <Input value={btnUrl} onChange={(e) => setBtnUrl(e.target.value)} placeholder="https://..." className="bg-input border-border" />
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => setHasButton(true)}><Plus className="h-4 w-4" /> Add a button</Button>
                )
              )}

              <LockedCard label="Send follow-up messages" />
            </>
          )}

          {sub === 4 && (
            <>
              <h3 className="text-lg font-bold text-center">Awesome! Let's review once before we launch! 🚀</h3>
              <ReviewRow title="When someone..." body="comments on this specific post">
                <div className="flex gap-2 items-start">
                  <div className="h-12 w-12 rounded-md bg-gradient-to-br from-primary/20 to-accent/20 shrink-0" />
                  <div className="text-xs text-muted-foreground line-clamp-2">"New launch dropping this Friday — comment GUIDE for early access 🔥"</div>
                </div>
              </ReviewRow>
              <ReviewRow title="and includes the following keywords in their comment">
                <div className="flex gap-1.5 flex-wrap">
                  {keywords.map((k) => (
                    <span key={k} className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-xs">{k}</span>
                  ))}
                </div>
              </ReviewRow>
              {autoReply && (
                <ReviewRow title="leave a reply to their comment on the post">
                  <div className="text-xs text-muted-foreground italic">"{replies[0]}"</div>
                </ReviewRow>
              )}
              <ReviewRow title="after they click the button, send the primary DM">
                <div className="rounded-2xl rounded-tl-sm bg-background border border-border p-3 max-w-[85%]">
                  <p className="text-sm">{dmText}</p>
                  {hasButton && (
                    <div className="mt-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs text-center font-medium">
                      {btnLabel}
                    </div>
                  )}
                </div>
              </ReviewRow>
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex items-center justify-between">
          <div className="text-xs text-muted-foreground">Step {Math.min(sub, 3)} of 3</div>
          <div className="flex gap-2">
            {sub > 1 && <Button variant="outline" onClick={() => setSub((s) => (s - 1) as any)}>Back</Button>}
            {sub < 3 && <Button onClick={() => setSub((s) => (s + 1) as any)}>Next</Button>}
            {sub === 3 && <Button onClick={() => setSub(4)}>Review & Launch</Button>}
            {sub === 4 && <Button onClick={onLaunch}>Confirm & Launch</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <div className="inline-flex p-1 rounded-lg bg-background border border-border">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
            value === o.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

function LockedCard({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-background">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lock className="h-4 w-4" />
        {label}
      </div>
      <button className="px-2.5 py-1 rounded-full bg-primary/15 text-primary text-xs font-medium hover:bg-primary/25">Unlock</button>
    </div>
  );
}

function ReviewRow({ title, body, children }: { title: string; body?: string; children?: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <div className="text-muted-foreground select-none">↳</div>
      <div className="flex-1 space-y-1.5">
        <div className="text-sm font-medium">{title}{body && <span className="text-muted-foreground"> {body}</span>}</div>
        {children}
      </div>
    </div>
  );
}

function CompletionModal({ onDone }: { onDone: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 text-center shadow-2xl">
        <div className="mx-auto h-20 w-20 rounded-full bg-primary/15 flex items-center justify-center mb-4 glow-primary">
          <Zap className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Your automation is live! 🔥</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Reactova will now monitor your post and send DMs automatically.
        </p>

        <div className="mt-6 p-4 rounded-xl border border-border bg-background text-left space-y-3">
          <div className="text-sm font-semibold text-center">Unlock more with Pro</div>
          <FeatureRow icon={InfinityIcon} text="Unlimited keywords per automation" />
          <FeatureRow icon={MessageSquare} text="DM follow-up sequences" />
          <FeatureRow icon={UserCheck} text="Follow before DM" />
        </div>

        <Button variant="accent" className="w-full mt-5" onClick={onDone}>
          Upgrade to Pro <ArrowRight className="h-4 w-4" />
        </Button>
        <button onClick={onDone} className="block mx-auto mt-3 text-sm text-muted-foreground hover:text-foreground">
          Maybe later
        </button>
      </div>
    </div>
  );
}

function FeatureRow({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <div className="h-7 w-7 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      {text}
    </div>
  );
}
