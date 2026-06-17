import { Fragment, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Instagram,
  Lock,
  MessageSquare,
  Plus,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Logo } from "@/components/logo";
import { VerifiedRoute } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getAuthMe } from "@/lib/api/auth-api";
import {
  createAutomation,
  getAutomationWizardData,
  type AutomationWizardData,
} from "@/lib/api/automations-api";
import {
  buildMetaOAuthStartPath,
  isWorkspaceInstagramConnected,
} from "@/lib/api/integrations-api";
import { listWorkspaces, updateWorkspace } from "@/lib/api/workspaces-api";
import { apiRequest } from "@/lib/api/http";
import { openMetaOAuthPopup } from "@/lib/meta-oauth-popup";
import { authStore, useAuthState } from "@/lib/auth/auth-store";
import { useApp } from "@/state/app-context";

type OnboardingSearch = {
  meta?: string;
  reason?: string;
  step?: number;
};

export const Route = createFileRoute("/onboarding")({
  validateSearch: (search: Record<string, unknown>): OnboardingSearch => ({
    meta: typeof search.meta === "string" ? search.meta : undefined,
    reason: typeof search.reason === "string" ? search.reason : undefined,
    step: Number(search.step) || undefined,
  }),
  head: () => ({ meta: [{ title: "Get started — Liffio" }] }),
  component: OnboardingRoute,
});

// ── Error copy ────────────────────────────────────────────────────────────────

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

const IG_ERRORS: Record<string, { title: string; summary: string; steps: string[] }> = {
  no_instagram_business_account: {
    title: "Instagram account not found",
    summary: "No Professional Instagram account was found linked to your Facebook Page.",
    steps: [
      "Switch your Instagram to a Professional account — Instagram → Settings → Account → Switch to Professional",
      "Link that Instagram account to your Facebook Page — Facebook Page → Settings → Linked accounts → Instagram",
      "Enable message access in Instagram → Settings → Privacy → Messages",
    ],
  },
  instagram_already_linked: {
    title: "Could not move Instagram connection",
    summary:
      "This Instagram account was linked on another workspace, but we could not move it automatically. Try again from Settings, or disconnect Instagram on the other workspace first.",
    steps: [
      "Open Settings → General on the workspace that should keep Instagram",
      "Use a different Instagram Professional account for this workspace, or disconnect the other workspace first",
      "Return here and connect again",
    ],
  },
  invalid_platform_app: {
    title: "Meta app configuration error",
    summary:
      "Instagram rejected the connection — the Meta developer app may not be configured for Instagram Business Login.",
    steps: [
      "In Meta for Developers → Instagram → API setup with Instagram login → Business login settings: add your callback URL to OAuth Redirect URIs",
      "Confirm META_INSTAGRAM_BUSINESS_LOGIN_APP_ID / APP_SECRET match the Instagram App ID / Secret on that page",
      "If the app is in Development mode, add your Instagram user under Roles → Instagram Testers",
    ],
  },
  redirect_uri_mismatch: {
    title: "Redirect URI mismatch",
    summary: "The OAuth callback URL in your server config doesn't match what's registered in Meta.",
    steps: [
      "Copy the exact value of META_OAUTH_REDIRECT_URI from your server .env file",
      "Add it verbatim to Meta → Instagram → Business login settings → OAuth Redirect URIs",
    ],
  },
  token_exchange_failed: {
    title: "Token exchange failed",
    summary: "Instagram returned an error when exchanging the login code for an access token.",
    steps: [
      "Confirm META_APP_ID, META_APP_SECRET, and META_OAUTH_REDIRECT_URI are set correctly in server .env",
      "Check server logs for the full error message, then reconnect",
    ],
  },
};

function OnboardingRoute() {
  return (
    <VerifiedRoute>
      <Onboarding />
    </VerifiedRoute>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function Onboarding() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const queryClient = useQueryClient();
  const { setCurrentId, refreshAuth } = useApp();
  const workspaceIdFromStore = useAuthState((s) => s.workspaceId);
  const isOnboarded = useAuthState((s) => s.isOnboarded);

  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [igConnected, setIgConnected] = useState(false);
  const [igError, setIgError] = useState<{
    reason: string;
    diagnostic?: MetaOAuthDiagnostic | null;
  } | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [automationCreated, setAutomationCreated] = useState(false);

  const resolveWorkspaceId = async (): Promise<string> => {
    if (workspaceIdFromStore) return workspaceIdFromStore;
    const authMe = await getAuthMe();
    authStore.setAuthMe(authMe);
    if (!authMe.workspaceId) throw new Error("No workspace found. Please sign in again.");
    return authMe.workspaceId;
  };

  const saveStep1 = useMutation({
    mutationFn: async () => {
      const workspaceId = await resolveWorkspaceId();
      await updateWorkspace(workspaceId, {
        ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        onboarding: {
          handle: handle.trim() ? `@${handle.replace(/^@/, "")}` : undefined,
          step: 1,
        },
      });
    },
  });

  const applyConnected = async (workspaceId?: string) => {
    if (workspaceId) {
      setCurrentId(workspaceId);
    }
    await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    if (workspaceId) {
      const persisted = await isWorkspaceInstagramConnected(workspaceId);
      if (!persisted) {
        return false;
      }
    }
    await refreshAuth();
    return true;
  };

  const startMetaOAuth = useMutation({
    mutationFn: async () => {
      const oauthWorkspaceId = await resolveWorkspaceId();
      return openMetaOAuthPopup(
        async () => {
          const { url } = await apiRequest<{ url: string }>(
            buildMetaOAuthStartPath("onboarding"),
            { workspaceId: oauthWorkspaceId }
          );
          return url;
        },
        {
          oauthWorkspaceId,
          checkConnected: () => isWorkspaceInstagramConnected(oauthWorkspaceId),
          verifyConnected: () => isWorkspaceInstagramConnected(oauthWorkspaceId),
        }
      );
    },
    onSuccess: async (result) => {
      if (result.meta === "connected") {
        const applied = await applyConnected(result.workspaceId);
        if (!applied) {
          setIgError({ reason: "connection_not_persisted" });
          setStep(2);
          toast.error(
            "Instagram authorized but this workspace did not update. Try again or pick the correct workspace."
          );
          return;
        }
        setIgConnected(true);
        setIgError(null);
        setStep(3);
        toast.success(
          result.igHandle
            ? `Instagram connected as ${result.igHandle}`
            : "Instagram connected successfully"
        );
        return;
      }
      const reason = result.reason ?? "token_exchange_failed";
      if (reason === "user_canceled") {
        // User deliberately closed the Meta popup — no error to show
        return;
      }
      setIgError({ reason });
      setStep(2);
      toast.error(IG_ERRORS[reason]?.title ?? "Instagram connection failed");
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const finishOnboarding = useMutation({
    mutationFn: async () => {
      const workspaceId = await resolveWorkspaceId();
      await updateWorkspace(workspaceId, { isOnboarded: true });
      const authMe = await getAuthMe({ workspaceId });
      authStore.setAuthMe(authMe);
    },
    onSuccess: () => void navigate({ to: "/dashboard", replace: true }),
    onError: (err) => toast.error((err as Error).message),
  });

  // Redirect if already onboarded
  useEffect(() => {
    if (isOnboarded) void navigate({ to: "/dashboard", replace: true });
  }, [isOnboarded, navigate]);

  // Handle OAuth redirect params (runs once on mount)
  useEffect(() => {
    const meta = search.meta;

    if (meta === "connected") {
      const stepParam = Number(search.step);
      const nextStep = Number.isFinite(stepParam) && stepParam > 0
        ? Math.min(Math.max(stepParam, 1), 3)
        : 3;
      setIgConnected(true);
      setIgError(null);
      setStep((prev) => Math.max(prev, nextStep));
    }

    if (meta === "error") {
      const reason = decodeURIComponent(search.reason ?? "");
      if (reason !== "user_canceled") {
        setIgError({ reason });
        setStep((prev) => (prev < 2 ? 2 : prev));

        if (reason === "no_instagram_business_account") {
          resolveWorkspaceId()
            .then((wid) =>
              listWorkspaces().then((ws) => {
                const diag = ws.find((w) => w.id === wid)?.metadata?.lastOAuthDiagnostic as
                  | MetaOAuthDiagnostic
                  | undefined;
                if (diag) setIgError({ reason, diagnostic: diag });
              })
            )
            .catch(() => {});
        }
      }
    }

    if (meta) {
      void navigate({ to: "/onboarding", search: {}, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goNext = () => setStep((s) => s + 1);
  const goBack = () => setStep((s) => s - 1);

  const handleStep1Continue = async () => {
    try {
      await saveStep1.mutateAsync();
    } catch {
      // non-fatal — proceed anyway
    }
    goNext();
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-soft-gradient opacity-80"
      />
      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        <Logo size="sm" />
      </header>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10">
        <StepProgress step={step} />

        <div key={step} className="w-full max-w-lg">
          <div className="w-full rounded-2xl border bg-card p-8 shadow-soft">
            {/* ── Step 1: Brand ─────────────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-7">
                <div>
                  <h1 className="font-display text-2xl font-bold tracking-tight">
                    Welcome to Liffio
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Connect your Instagram and start sending automated DMs in minutes.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="ws-name">Workspace name</Label>
                    <Input
                      id="ws-name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value.slice(0, 80))}
                      placeholder="My Brand, Studio Name…"
                    />
                    <p className="text-xs text-muted-foreground">
                      Used as your workspace label inside Liffio.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ig-handle">
                      Instagram handle{" "}
                      <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <div className="relative">
                      <Instagram className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <span className="absolute left-9 top-1/2 -translate-y-1/2 select-none text-sm text-muted-foreground">
                        @
                      </span>
                      <Input
                        id="ig-handle"
                        value={handle}
                        onChange={(e) =>
                          setHandle(e.target.value.replace(/^@/, "").replace(/\s/g, ""))
                        }
                        placeholder="yourbrand"
                        className="pl-12"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      We'll verify it when you connect your account.
                    </p>
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={() => void handleStep1Continue()}
                  disabled={saveStep1.isPending}
                >
                  {saveStep1.isPending ? "Saving…" : "Continue"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* ── Step 2: Connect Instagram ─────────────────────────── */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h1 className="font-display text-2xl font-bold tracking-tight">
                    Connect your Instagram
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Liffio connects via Instagram Business Login — your password is never shared.
                  </p>
                </div>

                {igConnected ? (
                  <div className="space-y-5">
                    <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/5 p-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/15">
                        <Check className="h-5 w-5 text-success" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">Instagram connected</div>
                        {handle && (
                          <div className="text-xs text-muted-foreground">
                            @{handle.replace(/^@/, "")}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button className="w-full" onClick={goNext}>
                      Continue <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3 rounded-xl border bg-background p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Requirements
                      </p>
                      <Requirement text="Professional account (Creator or Business)" />
                      <Requirement text="Instagram linked to a Facebook Page" />
                      <Requirement text="Admin access on that Facebook Page" />
                    </div>

                    {igError && (
                      <IgErrorPanel reason={igError.reason} diagnostic={igError.diagnostic} />
                    )}

                    <div className="space-y-2.5">
                      <Button
                        className="w-full"
                        onClick={() => {
                          setIgError(null);
                          startMetaOAuth.mutate();
                        }}
                        disabled={startMetaOAuth.isPending}
                      >
                        <Instagram className="h-4 w-4" />
                        {startMetaOAuth.isPending
                          ? "Opening Instagram…"
                          : igError
                            ? "Retry Instagram connect"
                            : "Connect with Instagram"}
                      </Button>
                      <Button
                        variant="ghost"
                        className="w-full text-sm text-muted-foreground"
                        onClick={goNext}
                      >
                        Skip for now — I'll connect later
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Step 3: First Automation ──────────────────────────── */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h1 className="font-display text-2xl font-bold tracking-tight">
                    {automationCreated ? "Automation is live 🚀" : "Create your first automation"}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {automationCreated
                      ? "Liffio is now monitoring your comments 24/7 and sending DMs automatically."
                      : "When someone comments a keyword on your post, Liffio sends them a DM instantly."}
                  </p>
                </div>

                {automationCreated ? (
                  <div className="space-y-4">
                    <div className="space-y-1.5 rounded-xl border border-primary/20 bg-primary/5 p-4">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Check className="h-4 w-4 text-primary" />
                        Your automation is active
                      </div>
                      <p className="pl-6 text-xs text-muted-foreground">
                        New comments that match your keyword will receive a DM automatically.
                      </p>
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => finishOnboarding.mutate()}
                      disabled={finishOnboarding.isPending}
                    >
                      {finishOnboarding.isPending ? "Opening dashboard…" : "Go to dashboard"}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="divide-y overflow-hidden rounded-xl border bg-background">
                      <ValueProp
                        icon={<MessageSquare className="h-4 w-4 text-primary" />}
                        title="Comment triggers DM"
                        desc="Someone comments your keyword → they receive a personal DM instantly"
                      />
                      <ValueProp
                        icon={<Zap className="h-4 w-4 text-accent-foreground" />}
                        title="Auto-reply on the post"
                        desc="Reply publicly to boost engagement and post reach"
                      />
                      <ValueProp
                        icon={<ArrowRight className="h-4 w-4 text-muted-foreground" />}
                        title="Link button in DM"
                        desc="Send a button to your link, product, or free resource"
                      />
                    </div>

                    <div className="space-y-2.5">
                      <Button
                        className="w-full"
                        onClick={() => setShowWizard(true)}
                        disabled={!igConnected}
                      >
                        <Zap className="h-4 w-4" />
                        Set up automation
                      </Button>
                      {!igConnected && (
                        <p className="text-center text-xs text-muted-foreground">
                          Connect Instagram first to enable automations
                        </p>
                      )}
                      <Button
                        variant="ghost"
                        className="w-full text-sm text-muted-foreground"
                        onClick={() => finishOnboarding.mutate()}
                        disabled={finishOnboarding.isPending}
                      >
                        {finishOnboarding.isPending
                          ? "Setting up your dashboard…"
                          : "Skip — I'll set up later"}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {step > 1 && (
          <button
            className="mt-5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            onClick={goBack}
          >
            ← Back
          </button>
        )}
      </div>

      {showWizard && (
        <AutomationWizard
          onClose={() => setShowWizard(false)}
          resolveWorkspaceId={resolveWorkspaceId}
          onLaunch={() => {
            setShowWizard(false);
            setAutomationCreated(true);
          }}
        />
      )}
    </div>
  );
}

// ── StepProgress ──────────────────────────────────────────────────────────────

function StepProgress({ step }: { step: number }) {
  const steps = ["Your Brand", "Connect", "Automate"];
  return (
    <div className="mb-8 flex w-full max-w-lg items-start">
      {steps.map((label, i) => {
        const num = i + 1;
        const done = num < step;
        const active = num === step;
        return (
          <Fragment key={label}>
            <div className="flex w-24 shrink-0 flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all duration-300",
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : active
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground"
                )}
              >
                {done ? <Check className="h-4 w-4" /> : num}
              </div>
              <span
                className={cn(
                  "text-center text-xs font-medium leading-tight",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "mt-4 h-[2px] flex-1 transition-all duration-500",
                  done ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

// ── Requirement ───────────────────────────────────────────────────────────────

function Requirement({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15">
        <Check className="h-2.5 w-2.5 text-primary" />
      </div>
      {text}
    </div>
  );
}

// ── ValueProp ─────────────────────────────────────────────────────────────────

function ValueProp({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3.5">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
        {icon}
      </div>
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div>
      </div>
    </div>
  );
}

// ── IgErrorPanel ──────────────────────────────────────────────────────────────

function IgErrorPanel({
  reason,
  diagnostic,
}: {
  reason: string;
  diagnostic?: MetaOAuthDiagnostic | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const info = IG_ERRORS[reason];

  if (!info) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-sm">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <span className="text-destructive">
          {reason || "Instagram connect failed. Please try again."}
        </span>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-warning/30 bg-warning/5">
      <div className="space-y-1 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <AlertCircle className="h-4 w-4 shrink-0 text-warning" />
          {info.title}
        </div>
        <p className="pl-6 text-xs text-muted-foreground">{info.summary}</p>
      </div>

      <button
        type="button"
        className="flex w-full items-center justify-between border-t border-warning/20 px-4 py-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted/20 hover:text-foreground"
        onClick={() => setExpanded((e) => !e)}
      >
        How to fix this
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>

      {expanded && (
        <div className="space-y-2.5 border-t border-warning/10 px-4 pb-4 pt-2">
          {info.steps.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-warning/20 text-[10px] font-bold text-warning">
                {i + 1}
              </span>
              <span>{s}</span>
            </div>
          ))}

          {reason === "no_instagram_business_account" && diagnostic && (
            <div className="mt-2 space-y-2 rounded-lg border bg-background p-3">
              <div className="text-xs font-semibold">Connection diagnostics</div>
              <div className="text-xs text-muted-foreground">
                {diagnostic.pageCount ?? 0} Facebook Page(s) returned
                {diagnostic.targetHandle
                  ? ` for @${diagnostic.targetHandle.replace(/^@/, "")}`
                  : ""}
              </div>
              {(diagnostic.pages ?? []).slice(0, 3).map((page) => (
                <div key={page.id} className="space-y-0.5 rounded-md border p-2 text-xs">
                  <div className="font-medium">
                    {page.name || "Unnamed page"} ({page.id})
                  </div>
                  <div className="text-muted-foreground">
                    Instagram business: {page.hasInstagramBusinessAccount ? "✓ linked" : "✗ not linked"}
                  </div>
                  <div className="text-muted-foreground">
                    Connected Instagram:{" "}
                    {page.hasConnectedInstagramAccount ? "✓ linked" : "✗ not linked"}
                  </div>
                </div>
              ))}
            </div>
          )}

          {reason === "no_instagram_business_account" && (
            <div className="mt-2 flex flex-wrap gap-3">
              <a
                href="https://www.instagram.com/accounts/edit/"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary underline"
              >
                Instagram settings →
              </a>
              <a
                href="https://www.facebook.com/pages/?category=your_pages"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary underline"
              >
                Facebook Pages →
              </a>
              <a
                href="https://business.facebook.com/settings"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary underline"
              >
                Meta Business Settings →
              </a>
            </div>
          )}

          {reason === "invalid_platform_app" && (
            <a
              href="https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login"
              target="_blank"
              rel="noreferrer"
              className="mt-1 block text-xs text-primary underline"
            >
              Instagram Business Login docs →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ── AutomationWizard ──────────────────────────────────────────────────────────

function AutomationWizard({
  onClose,
  onLaunch,
  resolveWorkspaceId,
}: {
  onClose: () => void;
  onLaunch: () => void;
  resolveWorkspaceId: () => Promise<string>;
}) {
  const [sub, setSub] = useState<1 | 2 | 3 | 4>(1);
  const [postMode, setPostMode] = useState<"specific" | "any" | "next">("any");
  const [selectedPost, setSelectedPost] = useState<string | null>(null);
  const [keywordMode, setKeywordMode] = useState<"specific" | "any">("specific");
  const [keywords, setKeywords] = useState<string[]>(["GUIDE"]);
  const [kwInput, setKwInput] = useState("");
  const [autoReply, setAutoReply] = useState(true);
  const [replies, setReplies] = useState([
    "Sent! Check your DMs 💌",
    "On its way to your inbox ✨",
    "Just DM'd you the link 🔥",
  ]);
  const [dmType, setDmType] = useState("text-button");
  const [dmText, setDmText] = useState(
    "Hi there! Appreciate your comment 🙌 Here's the link you asked for ⬇️"
  );
  const [hasButton, setHasButton] = useState(true);
  const [btnLabel, setBtnLabel] = useState("Get Your Free Guide");
  const [btnUrl, setBtnUrl] = useState("https://");

  const wizardData = useQuery<AutomationWizardData>({
    queryKey: ["automation-wizard-data"],
    queryFn: async () => {
      const workspaceId = await resolveWorkspaceId();
      return getAutomationWizardData(workspaceId);
    },
  });

  const createAutomationMutation = useMutation({
    mutationFn: async () => {
      const workspaceId = await resolveWorkspaceId();
      const cleanKeywords =
        keywordMode === "any" ? [] : keywords.map((k) => k.trim()).filter(Boolean);
      const cleanReplies = autoReply ? replies.map((r) => r.trim()).filter(Boolean) : [];
      await createAutomation(workspaceId, {
        name: `${(wizardData.data?.profile.username ?? "Instagram").replace(/^@/, "")} – Comment DM`,
        keywords: cleanKeywords,
        excludedKeywords: [],
        anyComment: keywordMode === "any",
        postScope: postMode,
        postId: postMode === "specific" ? (selectedPost ?? null) : null,
        dmMessage: dmText.trim(),
        autoReply,
        replyMessages: cleanReplies,
        dmButtonLabel:
          dmType === "text-button" && hasButton ? btnLabel.trim() || undefined : undefined,
        dmButtonUrl: dmType === "text-button" && hasButton ? btnUrl.trim() || undefined : undefined,
      });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  useEffect(() => {
    if (!selectedPost && wizardData.data?.media?.length) {
      setSelectedPost(wizardData.data.media[0].id);
    }
  }, [selectedPost, wizardData.data?.media]);

  const selectedMedia = wizardData.data?.media.find((m) => m.id === selectedPost) ?? null;

  const addKw = () => {
    const v = kwInput.trim().toUpperCase();
    if (!v || keywords.includes(v)) return;
    setKeywords((k) => [...k, v]);
    setKwInput("");
  };

  const SUBSTEP_LABELS = ["Trigger", "Keywords & Replies", "Message"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-sm font-semibold">New automation</div>
              <div className="text-xs text-muted-foreground">Comment → auto DM</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 transition-colors hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 border-b px-5 py-2.5">
          {wizardData.data?.profile.profilePictureUrl ? (
            <img
              src={wizardData.data.profile.profilePictureUrl}
              alt="Instagram profile"
              className="h-7 w-7 rounded-full object-cover"
            />
          ) : (
            <div className="h-7 w-7 rounded-full bg-brand-gradient" />
          )}
          <span className="text-sm font-medium">
            @{wizardData.data?.profile.username ?? "yourbrand"}
          </span>
          <div className="ml-auto flex items-center gap-1">
            {SUBSTEP_LABELS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 w-6 rounded-full transition-all",
                  i + 1 <= Math.min(sub, 3) ? "bg-primary" : "bg-border"
                )}
              />
            ))}
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {wizardData.isLoading && (
            <div className="rounded-lg border bg-background p-3 text-sm text-muted-foreground">
              Loading your Instagram profile…
            </div>
          )}
          {wizardData.isError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {(wizardData.error as Error).message}
            </div>
          )}

          {sub === 1 && (
            <>
              <div>
                <Label className="text-sm font-semibold">
                  Which post triggers this automation?
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Choose when comments on your Instagram should trigger a DM.
                </p>
              </div>
              <Segmented
                value={postMode}
                onChange={(v) => setPostMode(v as "specific" | "any" | "next")}
                options={[
                  { v: "any", l: "All posts" },
                  { v: "next", l: "Next post only" },
                  { v: "specific", l: "Pick a post" },
                ]}
              />
              {postMode === "any" && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                  One automation covers every post and reel on your account — past and future.
                </div>
              )}
              {postMode === "next" && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                  This automation activates only on your next published post.
                </div>
              )}
              {postMode === "specific" && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {(wizardData.data?.media ?? []).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedPost(item.id)}
                        className={cn(
                          "relative aspect-square overflow-hidden rounded-lg border-2 bg-muted transition-all",
                          selectedPost === item.id
                            ? "border-primary"
                            : "border-border hover:border-muted-foreground/50"
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
                        {selectedPost === item.id && (
                          <div className="absolute inset-0 flex items-center justify-center bg-primary/25">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary">
                              <Check className="h-4 w-4 text-white" />
                            </div>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  {(wizardData.data?.media?.length ?? 0) === 0 && !wizardData.isLoading && (
                    <p className="text-xs text-muted-foreground">
                      No posts found on this account yet.
                    </p>
                  )}
                </>
              )}
            </>
          )}

          {sub === 2 && (
            <>
              <div>
                <Label className="text-sm font-semibold">What triggers the automation?</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Send a DM when someone comments a specific keyword, or on any comment.
                </p>
              </div>
              <Segmented
                value={keywordMode}
                onChange={(v) => setKeywordMode(v as "specific" | "any")}
                options={[
                  { v: "specific", l: "Specific keyword" },
                  { v: "any", l: "Any comment" },
                ]}
              />
              {keywordMode === "specific" && (
                <>
                  <div className="flex gap-2">
                    <Input
                      value={kwInput}
                      onChange={(e) => setKwInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addKw();
                        }
                      }}
                      placeholder="e.g. GUIDE, LINK, FREE"
                    />
                    <Button variant="outline" onClick={addKw} type="button">
                      <Plus className="h-4 w-4" /> Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {keywords.map((k) => (
                      <span
                        key={k}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                      >
                        {k}
                        <button
                          type="button"
                          onClick={() => setKeywords((kw) => kw.filter((x) => x !== k))}
                          className="text-primary/60 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Not case-sensitive. The comment must contain the keyword.
                  </p>
                </>
              )}

              <div className="h-px bg-border" />

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Auto-reply on the post</div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Reply publicly to their comment — rotates between variations to look natural
                  </p>
                </div>
                <Switch checked={autoReply} onCheckedChange={setAutoReply} />
              </div>

              {autoReply && (
                <div className="space-y-2.5">
                  {replies.map((r, i) => (
                    <div key={i}>
                      <Label className="text-xs">Reply variation {i + 1}</Label>
                      <Textarea
                        value={r}
                        onChange={(e) => {
                          const next = [...replies];
                          next[i] = e.target.value.slice(0, 140);
                          setReplies(next);
                        }}
                        maxLength={140}
                        rows={2}
                        className="mt-1 resize-none"
                      />
                      <div className="mt-0.5 text-right text-[10px] text-muted-foreground">
                        {r.length}/140
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {sub === 3 && (
            <>
              <div>
                <Label className="text-sm font-semibold">What DM do you want to send?</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Write the message that gets sent automatically when someone comments.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Message type</Label>
                <Select value={dmType} onValueChange={setDmType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text-button">Text + Button link</SelectItem>
                    <SelectItem value="text">Text only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Message</Label>
                <Textarea
                  value={dmText}
                  onChange={(e) => setDmText(e.target.value.slice(0, 900))}
                  rows={4}
                  className="mt-1 resize-none"
                  placeholder="Hi there! Here's the resource you asked for…"
                />
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    Use {"{{name}}"} {"{{username}}"} {"{{keyword}}"} as variables
                  </span>
                  <span className="text-[10px] text-muted-foreground">{dmText.length}/900</span>
                </div>
              </div>

              <div className="space-y-2">
                <LockedCard label="Follow-up message sequence" />
                <LockedCard label="Ask to follow before DM" />
              </div>

              {dmType === "text-button" &&
                (hasButton ? (
                  <div className="space-y-2.5 rounded-xl border bg-background p-3.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">Button</Label>
                      <button
                        type="button"
                        onClick={() => setHasButton(false)}
                        className="rounded p-1 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      <Input
                        value={btnLabel}
                        onChange={(e) => setBtnLabel(e.target.value)}
                        placeholder="Button label"
                      />
                      <Input
                        value={btnUrl}
                        onChange={(e) => setBtnUrl(e.target.value)}
                        placeholder="https://yourlink.com"
                      />
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => setHasButton(true)} type="button">
                    <Plus className="h-4 w-4" /> Add button link
                  </Button>
                ))}
            </>
          )}

          {sub === 4 && (
            <>
              <div>
                <h3 className="font-display text-base font-bold">Review your automation</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Confirm the details before launching.
                </p>
              </div>

              <div className="space-y-3">
                <ReviewRow title="Trigger">
                  {postMode === "specific"
                    ? "Comment on a specific post"
                    : postMode === "next"
                      ? "Comment on your next post"
                      : "Comment on any post or reel"}
                  {postMode === "specific" && selectedMedia && (
                    <div className="mt-1.5 flex items-center gap-2">
                      {selectedMedia.thumbnailUrl && (
                        <img
                          src={selectedMedia.thumbnailUrl}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-md object-cover"
                        />
                      )}
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {selectedMedia.caption || "Selected post"}
                      </span>
                    </div>
                  )}
                </ReviewRow>

                <ReviewRow title="Keyword">
                  {keywordMode === "any" ? (
                    "Any comment"
                  ) : (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {keywords.map((k) => (
                        <span
                          key={k}
                          className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  )}
                </ReviewRow>

                {autoReply && (
                  <ReviewRow title="Public reply">
                    <span className="italic text-muted-foreground">"{replies[0]}"</span>
                    {replies.length > 1 && (
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        +{replies.length - 1} variations
                      </span>
                    )}
                  </ReviewRow>
                )}

                <ReviewRow title="DM message">
                  <div className="mt-1 max-w-[85%] rounded-xl rounded-tl-sm border bg-background p-3">
                    <p className="text-sm">{dmText}</p>
                    {dmType === "text-button" && hasButton && btnLabel && (
                      <div className="mt-2 rounded-md bg-primary px-3 py-1.5 text-center text-xs font-medium text-primary-foreground">
                        {btnLabel}
                      </div>
                    )}
                  </div>
                </ReviewRow>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t px-5 py-4">
          <span className="text-xs text-muted-foreground">
            {sub <= 3 ? `Step ${sub} of 3` : "Review"}
          </span>
          <div className="flex gap-2">
            {sub > 1 && (
              <Button variant="outline" onClick={() => setSub((s) => (s - 1) as 1 | 2 | 3 | 4)}>
                Back
              </Button>
            )}
            {sub < 3 && <Button onClick={() => setSub((s) => (s + 1) as 1 | 2 | 3 | 4)}>Next</Button>}
            {sub === 3 && <Button onClick={() => setSub(4)}>Review & Launch</Button>}
            {sub === 4 && (
              <Button
                disabled={
                  createAutomationMutation.isPending ||
                  wizardData.isLoading ||
                  !!wizardData.isError ||
                  (postMode === "specific" && !selectedPost) ||
                  (keywordMode === "specific" && keywords.length === 0)
                }
                onClick={async () => {
                  await createAutomationMutation.mutateAsync();
                  onLaunch();
                }}
              >
                {createAutomationMutation.isPending ? "Launching…" : "Confirm & Launch"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <div className="inline-flex w-full rounded-lg border bg-background p-1">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            value === o.v
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
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
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lock className="h-4 w-4 shrink-0" />
        {label}
      </div>
      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
        Pro
      </span>
    </div>
  );
}

function ReviewRow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1 rounded-xl border bg-background p-3.5">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
