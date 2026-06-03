import {
  BarChart3,
  Calendar,
  Link2,
  MessageSquare,
  Shield,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import {
  AnalyticsIllustration,
  DmAutomationIllustration,
  OnboardingIllustration,
  SecurityIllustration,
} from "./AuthIllustrations";

export type AuthPanelVariant = "login" | "register" | "forgot-password" | "confirm-email" | "default";

type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

const FEATURES_BY_VARIANT: Record<AuthPanelVariant, Feature[]> = {
  login: [
    { icon: MessageSquare, title: "DM automations", description: "Reply to comments and keywords in seconds." },
    { icon: BarChart3, title: "Conversion tracking", description: "See every click from comment to sale." },
    { icon: Link2, title: "Bio links & short URLs", description: "One link hub with branded go-links." },
  ],
  register: [
    { icon: Zap, title: "Free to start", description: "No credit card — upgrade when you grow." },
    { icon: Calendar, title: "Content scheduler", description: "Plan posts and stories in one calendar." },
    { icon: Users, title: "Team workspaces", description: "Invite collaborators with role-based access." },
  ],
  "forgot-password": [
    { icon: Shield, title: "Account security", description: "Time-limited codes and session reset on change." },
    { icon: Sparkles, title: "Official Meta API", description: "Built on Instagram's approved integration." },
    { icon: MessageSquare, title: "Always in sync", description: "Your automations stay live after recovery." },
  ],
  "confirm-email": [
    { icon: Shield, title: "Verify once", description: "Keeps your workspace and billing secure." },
    { icon: Zap, title: "Almost there", description: "Connect Instagram right after confirmation." },
    { icon: BarChart3, title: "Full dashboard", description: "Analytics, leads, and automations unlock instantly." },
  ],
  default: [
    { icon: MessageSquare, title: "Instagram DM automation", description: "Turn comments into conversations." },
    { icon: BarChart3, title: "Real-time analytics", description: "Track performance across campaigns." },
    { icon: Link2, title: "Bio link pages", description: "Beautiful mobile-first link hubs." },
  ],
};

const HEADLINE_BY_VARIANT: Record<AuthPanelVariant, { title: string; subtitle: string }> = {
  login: {
    title: "Turn every comment into a conversation",
    subtitle: "Automate Instagram DMs, capture leads, and measure what converts — all from one workspace.",
  },
  register: {
    title: "Grow on Instagram without the busywork",
    subtitle: "Join creators and brands using Liffio to automate replies, schedule content, and track every lead.",
  },
  "forgot-password": {
    title: "We'll get you back in quickly",
    subtitle: "Secure reset codes expire in minutes. Your automations and data stay exactly where you left them.",
  },
  "confirm-email": {
    title: "One quick step to unlock your workspace",
    subtitle: "We sent a code to protect your account. Paste it from any device — then you're in.",
  },
  default: {
    title: "Your Instagram growth command center",
    subtitle: "DM automation, scheduling, bio links, and analytics — powered by the official Meta API.",
  },
};

const STATS = [
  { value: "10M+", label: "DMs automated" },
  { value: "98%", label: "Delivery rate" },
  { value: "<2s", label: "Avg. reply time" },
];

function IllustrationForVariant({ variant }: { variant: AuthPanelVariant }) {
  if (variant === "forgot-password" || variant === "confirm-email") {
    return <SecurityIllustration className="mx-auto" />;
  }
  if (variant === "register") {
    return <OnboardingIllustration className="mx-auto" />;
  }
  if (variant === "login") {
    return <DmAutomationIllustration className="mx-auto" />;
  }
  return <AnalyticsIllustration className="mx-auto" />;
}

export function AuthFeaturePanel({ variant = "default" }: { variant?: AuthPanelVariant }) {
  const headline = HEADLINE_BY_VARIANT[variant];
  const features = FEATURES_BY_VARIANT[variant];

  return (
    <aside
      className={cn(
        "relative hidden lg:flex flex-col justify-between overflow-hidden",
        "border-r border-border/60 bg-gradient-to-br from-background via-background to-primary/[0.04]",
        "px-10 xl:px-14 py-10"
      )}
    >
      <div className="auth-panel-mesh pointer-events-none absolute inset-0" aria-hidden />
      <div className="auth-grid pointer-events-none absolute inset-0 opacity-20 dark:opacity-10" aria-hidden />
      <div className="auth-orb auth-orb-primary pointer-events-none absolute -left-24 top-1/4 h-64 w-64 rounded-full blur-3xl" aria-hidden />
      <div className="auth-orb auth-orb-accent pointer-events-none absolute -right-16 bottom-1/4 h-48 w-48 rounded-full blur-3xl" aria-hidden />

      <div className="relative z-10">
        <Logo size="md" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col justify-center py-8 max-w-lg">
        <p className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-5 w-fit">
          <Sparkles className="h-3.5 w-3.5" />
          Official Meta API partner flow
        </p>
        <h2 className="text-3xl xl:text-4xl font-bold tracking-tight text-foreground leading-[1.15]">
          {headline.title}
        </h2>
        <p className="mt-4 text-base text-muted-foreground leading-relaxed">{headline.subtitle}</p>

        <div className="mt-10 flex justify-center py-2">
          <IllustrationForVariant variant={variant} />
        </div>

        <ul className="mt-8 space-y-3">
          {features.map((f) => (
            <li
              key={f.title}
              className="flex gap-3 rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm px-4 py-3 transition-colors hover:border-primary/30 hover:bg-card/80"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <f.icon className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-foreground">{f.title}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">{f.description}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative z-10 grid grid-cols-3 gap-3 pt-6 border-t border-border/50">
        {STATS.map((s) => (
          <div key={s.label} className="text-center sm:text-left">
            <p className="text-lg xl:text-xl font-bold text-foreground tabular-nums">{s.value}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">{s.label}</p>
          </div>
        ))}
      </div>
    </aside>
  );
}

export function AuthMobileHighlights({ variant = "default" }: { variant?: AuthPanelVariant }) {
  const features = FEATURES_BY_VARIANT[variant].slice(0, 2);

  return (
    <div className="lg:hidden mb-6 space-y-4">
      <div className="flex justify-center py-2 opacity-95">
        {variant === "forgot-password" || variant === "confirm-email" ? (
          <SecurityIllustration className="max-h-[140px] w-auto" />
        ) : variant === "register" ? (
          <OnboardingIllustration className="max-h-[140px] w-auto" />
        ) : (
          <DmAutomationIllustration className="max-h-[140px] w-auto" />
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-center"
          >
            <f.icon className="h-4 w-4 mx-auto text-primary mb-1" />
            <p className="text-[11px] font-semibold text-foreground leading-tight">{f.title}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
