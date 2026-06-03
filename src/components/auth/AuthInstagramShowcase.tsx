import { BarChart3, MessageCircle, Sparkles, Zap } from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import type { AuthPanelVariant } from "./AuthFeaturePanel";

const TAGS: Record<AuthPanelVariant, string[]> = {
  login: ["Comment → DM", "Keyword triggers", "Lead sync"],
  register: ["Free workspace", "Meta API", "Team roles"],
  "forgot-password": ["Secure reset", "Session revoke", "Data safe"],
  "confirm-email": ["Verify once", "Full access", "Connect IG"],
  default: ["DM automation", "Analytics", "Bio links"],
};

const HEADLINES: Record<AuthPanelVariant, { title: string; subtitle: string }> = {
  login: {
    title: "Your Instagram inbox, on autopilot",
    subtitle: "Reply to comments, capture leads, and track every conversion — without leaving Liffio.",
  },
  register: {
    title: "Start automating DMs today",
    subtitle: "Join creators using the official Meta API to scale conversations and content.",
  },
  "forgot-password": {
    title: "Back to your automations",
    subtitle: "Reset access in minutes. Your flows and audience data stay intact.",
  },
  "confirm-email": {
    title: "Almost in — verify your email",
    subtitle: "One code unlocks your workspace, Instagram connect, and full dashboard.",
  },
  default: {
    title: "Social growth, engineered",
    subtitle: "Instagram DM automation built for creators, agencies, and brands.",
  },
};

function DmPreviewCard() {
  return (
    <div className="auth-glass-inner relative mt-6 overflow-hidden rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <div className="auth-ig-ring h-11 w-11 shrink-0 rounded-full p-[2px]">
          <div className="flex h-full w-full items-center justify-center rounded-full bg-card/90 text-xs font-bold text-foreground">
            LF
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">@yourbrand</p>
          <p className="text-[11px] text-muted-foreground">Active · Auto-reply on</p>
        </div>
        <span className="auth-live-dot h-2 w-2 shrink-0 rounded-full" />
      </div>

      <div className="mt-4 space-y-2.5">
        <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md auth-bubble-out px-3.5 py-2.5 text-[13px] leading-snug text-foreground">
          Love this drop! 🔥 How do I get the link?
        </div>
        <div className="max-w-[92%] rounded-2xl rounded-bl-md auth-bubble-in px-3.5 py-2.5 text-[13px] leading-snug">
          <span className="text-[10px] font-medium uppercase tracking-wider text-primary/90">Automation</span>
          <p className="mt-0.5 text-foreground">Hey! Tap the link in bio — code CREATOR saves 10% ✨</p>
        </div>
        <div className="ml-auto max-w-[75%] rounded-2xl rounded-br-md auth-bubble-out px-3.5 py-2 text-[12px] text-muted-foreground">
          Sent · Lead captured
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <span className="auth-glass-pill inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium">
          <Zap className="h-3 w-3 text-accent" />
          Instant reply
        </span>
        <span className="auth-glass-pill inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium">
          <BarChart3 className="h-3 w-3 text-primary" />
          Tracked
        </span>
      </div>
    </div>
  );
}

export function AuthInstagramShowcase({ variant = "default" }: { variant?: AuthPanelVariant }) {
  const { title, subtitle } = HEADLINES[variant];
  const tags = TAGS[variant];

  return (
    <div className={cn("auth-glass-panel relative w-full max-w-md mx-auto lg:max-w-none lg:mx-0")}>
      <div className="relative p-6 sm:p-7">
        <Logo size="sm" />

        <div className="mt-6 inline-flex items-center gap-2 auth-glass-pill px-3 py-1.5 text-xs font-medium text-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Official Meta · Instagram DM API
        </div>

        <h2 className="mt-5 text-xl font-bold leading-tight tracking-tight sm:text-2xl">
          <span className="auth-ig-gradient-text">{title}</span>
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="auth-glass-pill px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>

        <DmPreviewCard />

        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          {[
            { icon: MessageCircle, label: "DMs sent", value: "2.4M" },
            { icon: Zap, label: "Avg reply", value: "<2s" },
            { icon: BarChart3, label: "CTR lift", value: "+34%" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="auth-glass-inner rounded-xl px-2 py-3">
              <Icon className="mx-auto h-4 w-4 text-primary" />
              <p className="mt-1.5 text-sm font-bold tabular-nums text-foreground">{value}</p>
              <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
