import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

export type AuthPanelVariant = "login" | "register" | "forgot-password" | "confirm-email" | "default";

const COPY: Record<AuthPanelVariant, { eyebrow: string; title: string; lines: string[] }> = {
  login: {
    eyebrow: "Workspace",
    title: "Instagram operations, centralized.",
    lines: [
      "Automate direct messages from comments and keywords.",
      "Measure conversions from first touch to checkout.",
      "Manage scheduling, bio links, and team access in one place.",
    ],
  },
  register: {
    eyebrow: "Get started",
    title: "Create your Liffio workspace.",
    lines: [
      "No credit card required for the free tier.",
      "Connect Instagram through the official Meta API.",
      "Scale with analytics, automations, and team roles.",
    ],
  },
  "forgot-password": {
    eyebrow: "Account recovery",
    title: "Secure password reset.",
    lines: [
      "Verification codes expire after five minutes.",
      "Active sessions are revoked when your password changes.",
      "Your workspace data and automations are unchanged.",
    ],
  },
  "confirm-email": {
    eyebrow: "Verification",
    title: "Confirm your email address.",
    lines: [
      "Required before workspace and billing access.",
      "Enter the six-digit code from your inbox.",
      "You may paste the code from any device.",
    ],
  },
  default: {
    eyebrow: "Liffio",
    title: "Professional Instagram automation.",
    lines: [
      "Official Meta API integration.",
      "Enterprise-grade access controls.",
      "Built for creators, agencies, and brands.",
    ],
  },
};

export function AuthFeaturePanel({ variant = "default" }: { variant?: AuthPanelVariant }) {
  const { eyebrow, title, lines } = COPY[variant];

  return (
    <aside
      className={cn(
        "relative hidden lg:flex w-[280px] xl:w-[300px] shrink-0 flex-col",
        "border-r border-border/80 bg-muted/20 px-8 py-10"
      )}
    >
      <Logo size="sm" />

      <div className="mt-12 flex flex-1 flex-col justify-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {eyebrow}
        </p>
        <h2 className="mt-3 text-lg font-semibold leading-snug text-foreground tracking-tight">
          {title}
        </h2>
        <ul className="mt-6 space-y-3 border-t border-border/60 pt-6">
          {lines.map((line) => (
            <li key={line} className="text-[13px] leading-relaxed text-muted-foreground pl-3 border-l-2 border-primary/30">
              {line}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
        Meta Business API · SOC-ready practices · Encrypted in transit
      </p>
    </aside>
  );
}
