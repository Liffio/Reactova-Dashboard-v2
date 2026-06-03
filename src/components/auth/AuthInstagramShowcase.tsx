import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import type { AuthPanelVariant } from "./AuthFeaturePanel";

const TITLE: Record<AuthPanelVariant, string> = {
  login: "Automate your Instagram DMs",
  register: "Grow with smart automations",
  "forgot-password": "Recover your account",
  "confirm-email": "Verify your email",
  default: "Instagram automation",
};

function DmPreviewCard() {
  return (
    <div className="glass-inset relative mt-5 overflow-hidden rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className="auth-ig-ring h-10 w-10 shrink-0 rounded-full p-[2px]">
          <div className="flex h-full w-full items-center justify-center rounded-full bg-card/90 text-[10px] font-bold">
            LF
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">@yourbrand</p>
          <p className="text-[11px] text-muted-foreground">Auto-reply on</p>
        </div>
        <span className="auth-live-dot h-1.5 w-1.5 shrink-0 rounded-full" />
      </div>
      <div className="mt-3 space-y-2">
        <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm glass-inset px-3 py-2 text-[12px] text-foreground">
          How do I get the link?
        </div>
        <div className="max-w-[90%] rounded-2xl rounded-bl-sm auth-bubble-in px-3 py-2 text-[12px] text-foreground">
          Here you go — link in bio ✨
        </div>
      </div>
    </div>
  );
}

export function AuthInstagramShowcase({ variant = "default" }: { variant?: AuthPanelVariant }) {
  return (
    <div className={cn("auth-glass-panel relative w-full max-w-md mx-auto lg:max-w-none lg:mx-0")}>
      <div className="relative p-6 sm:p-7">
        <Logo size="sm" />
        <h2 className="mt-5 text-lg font-semibold leading-snug tracking-tight sm:text-xl">
          <span className="auth-ig-gradient-text">{TITLE[variant]}</span>
        </h2>
        <DmPreviewCard />
      </div>
    </div>
  );
}
