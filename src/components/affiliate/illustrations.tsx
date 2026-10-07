/**
 * Decorative line-art for the affiliate page. Every colour comes from theme tokens (Tailwind
 * `fill-*` / `stroke-*` utilities), so the art follows light and dark mode. All of it is
 * `aria-hidden`: it carries no information the surrounding text doesn't.
 */
import { cn } from "@/lib/utils";

const LINE = "stroke-foreground/70";
const SOFT = "fill-primary/10";

/** Header band: a referral link chip sending coins up a rising chart. */
export function HeroArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 360 150"
      fill="none"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("pointer-events-none select-none", className)}
    >
      <circle cx="268" cy="70" r="62" className="fill-primary/[0.07]" />
      <circle cx="268" cy="70" r="40" className="fill-primary/[0.07]" />

      {/* rising bars + trend */}
      <rect x="214" y="92" width="16" height="34" rx="4" className={cn(SOFT, LINE)} />
      <rect x="238" y="74" width="16" height="52" rx="4" className={cn(SOFT, LINE)} />
      <rect x="262" y="56" width="16" height="70" rx="4" className={cn("fill-primary/25", LINE)} />
      <rect x="286" y="38" width="16" height="88" rx="4" className={cn("fill-primary/40", LINE)} />
      <path d="M206 84 L238 64 L262 48 L300 22" className="stroke-primary" strokeWidth={2.2} />
      <path d="M290 20 L301 21 L299 32" className="stroke-primary" strokeWidth={2.2} />
      <line x1="200" y1="127" x2="318" y2="127" className={LINE} />

      {/* link chip */}
      <g transform="translate(70 70) rotate(-6)">
        <rect width="112" height="34" rx="17" className={cn("fill-card", LINE)} />
        <path
          d="M22 17 a6 6 0 0 1 6-6 h6 a6 6 0 0 1 0 12 h-3 M34 17 a6 6 0 0 1-6 6 h-6 a6 6 0 0 1 0-12 h3"
          className="stroke-primary"
          strokeWidth={1.8}
        />
        <rect x="50" y="13" width="44" height="4" rx="2" className="fill-foreground/25" />
        <rect x="50" y="20" width="28" height="3" rx="1.5" className="fill-foreground/15" />
      </g>

      {/* coins arcing from the link to the chart */}
      <path
        d="M150 62 C170 30, 186 30, 204 40"
        className="stroke-foreground/30"
        strokeDasharray="3 5"
      />
      <Coin cx={168} cy={38} r={9} />
      <Coin cx={194} cy={30} r={7} />

      {/* sparkles */}
      <Sparkle x={52} y={40} />
      <Sparkle x={328} y={96} s={0.8} />
      <circle cx="120" cy="124" r="3" className="fill-primary/40" />
      <circle cx="338" cy="40" r="2.5" className="fill-foreground/25" />
    </svg>
  );
}

/** Share card: link → friend signs up → you earn. */
export function ShareFlowArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 132 52"
      fill="none"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("pointer-events-none select-none", className)}
    >
      <circle cx="20" cy="26" r="17" className={SOFT} />
      <path
        d="M13 26 a4.5 4.5 0 0 1 4.5-4.5 h4 a4.5 4.5 0 0 1 0 9 h-2 M27 26 a4.5 4.5 0 0 1-4.5 4.5 h-4 a4.5 4.5 0 0 1 0-9 h2"
        className="stroke-primary"
      />
      <path d="M41 26 h14" className="stroke-foreground/30" strokeDasharray="2 4" />
      <circle cx="66" cy="26" r="17" className={SOFT} />
      <circle cx="66" cy="21" r="4.5" className={cn("fill-card", LINE)} />
      <path d="M57.5 34 a8.5 8.5 0 0 1 17 0" className={LINE} />
      <path d="M87 26 h14" className="stroke-foreground/30" strokeDasharray="2 4" />
      <circle cx="112" cy="26" r="17" className="fill-success/15" />
      <Coin cx={112} cy={26} r={9} tone="success" />
    </svg>
  );
}

export type VerificationArtState = "none" | "pending" | "verified" | "rejected";

/** Verification panel: an ID card behind a shield whose badge follows the review state. */
export function VerificationArt({
  state,
  className,
}: {
  state: VerificationArtState;
  className?: string;
}) {
  const badge = {
    none: "fill-muted stroke-foreground/50",
    pending: "fill-warning/20 stroke-warning",
    verified: "fill-success/20 stroke-success",
    rejected: "fill-destructive/15 stroke-destructive",
  }[state];
  const glyph = {
    none: "stroke-foreground/50",
    pending: "stroke-warning",
    verified: "stroke-success",
    rejected: "stroke-destructive",
  }[state];

  return (
    <svg
      viewBox="0 0 200 120"
      fill="none"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("pointer-events-none select-none", className)}
    >
      <ellipse cx="100" cy="108" rx="78" ry="7" className="fill-foreground/[0.05]" />

      {/* ID card */}
      <g transform="translate(26 22) rotate(-5)">
        <rect width="112" height="72" rx="10" className={cn("fill-card", LINE)} />
        <rect width="112" height="18" rx="10" className="fill-primary/15" />
        <rect y="10" width="112" height="8" className="fill-primary/15" />
        <rect x="12" y="28" width="28" height="32" rx="6" className={cn(SOFT, LINE)} />
        <circle cx="26" cy="40" r="5.5" className={LINE} />
        <path d="M17 56 a9 7 0 0 1 18 0" className={LINE} />
        <rect x="50" y="31" width="46" height="4" rx="2" className="fill-foreground/25" />
        <rect x="50" y="41" width="34" height="3.5" rx="1.75" className="fill-foreground/15" />
        <rect x="50" y="50" width="40" height="3.5" rx="1.75" className="fill-foreground/15" />
      </g>

      {/* shield + state glyph */}
      <g transform="translate(122 40)">
        <path
          d="M24 2 L44 9 V27 C44 41 35 50 24 55 C13 50 4 41 4 27 V9 Z"
          className={cn("fill-card", LINE)}
        />
        <path
          d="M24 9 L37 13.5 V27 C37 36.5 31.5 43 24 47 C16.5 43 11 36.5 11 27 V13.5 Z"
          className={badge}
          strokeWidth={1.4}
        />
        {state === "verified" && (
          <path d="M17 28 L22 33 L31 23" className={glyph} strokeWidth={2.4} />
        )}
        {state === "pending" && (
          <>
            <circle cx="24" cy="28" r="8" className={glyph} strokeWidth={1.8} />
            <path d="M24 23.5 V28 L27 30" className={glyph} strokeWidth={1.8} />
          </>
        )}
        {state === "rejected" && (
          <>
            <path d="M24 21 V30" className={glyph} strokeWidth={2.4} />
            <circle cx="24" cy="35" r="1.4" className="fill-destructive" />
          </>
        )}
        {state === "none" && (
          <rect x="18" y="25" width="12" height="10" rx="2" className={glyph} strokeWidth={1.8} />
        )}
        {state === "none" && (
          <path d="M20.5 25 V22.5 a3.5 3.5 0 0 1 7 0 V25" className={glyph} strokeWidth={1.8} />
        )}
      </g>

      <Sparkle x={20} y={20} s={0.8} />
      <Sparkle x={178} y={30} s={0.7} />
    </svg>
  );
}

export type EmptyArtKind = "referrals" | "commissions" | "payouts";

/** Empty tabs: a small scene per tab instead of a lone icon tile. */
export function EmptyArt({ kind, className }: { kind: EmptyArtKind; className?: string }) {
  return (
    <svg
      viewBox="0 0 140 92"
      fill="none"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("pointer-events-none select-none", className)}
    >
      <circle cx="70" cy="46" r="40" className="fill-primary/[0.07]" />
      <ellipse cx="70" cy="84" rx="44" ry="5" className="fill-foreground/[0.05]" />
      {kind === "referrals" && <ReferralsScene />}
      {kind === "commissions" && <CommissionsScene />}
      {kind === "payouts" && <PayoutsScene />}
      <Sparkle x={22} y={22} s={0.7} />
      <Sparkle x={120} y={60} s={0.6} />
    </svg>
  );
}

function ReferralsScene() {
  return (
    <>
      <Person cx={50} cy={44} />
      <Person cx={90} cy={44} faded />
      <path d="M60 52 C66 62, 74 62, 80 52" className="stroke-primary" strokeDasharray="2 4" />
      <circle cx="70" cy="22" r="9" className={cn("fill-card", "stroke-primary")} />
      <path d="M70 18 v8 M66 22 h8" className="stroke-primary" strokeWidth={1.8} />
    </>
  );
}

function CommissionsScene() {
  return (
    <>
      <path
        d="M48 16 h44 v62 l-5.5-4 -5.5 4 -5.5-4 -5.5 4 -5.5-4 -5.5 4 -5.5-4 -5.5 4 Z"
        className={cn("fill-card", LINE)}
      />
      <rect x="56" y="26" width="28" height="4" rx="2" className="fill-foreground/25" />
      <rect x="56" y="36" width="20" height="3.5" rx="1.75" className="fill-foreground/15" />
      <rect x="56" y="45" width="24" height="3.5" rx="1.75" className="fill-foreground/15" />
      <Coin cx={96} cy={60} r={11} tone="success" />
    </>
  );
}

function PayoutsScene() {
  return (
    <>
      <rect x="40" y="30" width="60" height="42" rx="9" className={cn("fill-card", LINE)} />
      <path d="M40 40 h60" className={LINE} />
      <rect x="80" y="48" width="22" height="14" rx="5" className={cn(SOFT, LINE)} />
      <circle cx="88" cy="55" r="2" className="fill-primary" />
      <path d="M70 6 V24 M63 17 L70 24 L77 17" className="stroke-primary" strokeWidth={1.8} />
    </>
  );
}

function Person({ cx, cy, faded }: { cx: number; cy: number; faded?: boolean }) {
  const cls = faded ? "stroke-foreground/35" : LINE;
  return (
    <g>
      <circle cx={cx} cy={cy - 8} r="7" className={cn(faded ? "fill-muted" : "fill-card", cls)} />
      <path
        d={`M${cx - 12} ${cy + 14} a12 11 0 0 1 24 0`}
        className={cn(faded ? "fill-muted" : SOFT, cls)}
      />
    </g>
  );
}

function Coin({
  cx,
  cy,
  r,
  tone = "primary",
}: {
  cx: number;
  cy: number;
  r: number;
  tone?: "primary" | "success";
}) {
  const fill = tone === "success" ? "fill-success/25" : "fill-primary/25";
  const stroke = tone === "success" ? "stroke-success" : "stroke-primary";
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} className={cn(fill, stroke)} />
      <circle cx={cx} cy={cy} r={r * 0.62} className={stroke} strokeWidth={1.1} />
    </g>
  );
}

function Sparkle({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 -7 C1 -2, 2 -1, 7 0 C2 1, 1 2, 0 7 C-1 2, -2 1, -7 0 C-2 -1, -1 -2, 0 -7 Z"
      className="fill-primary/50"
    />
  );
}

/** Upload area and empty "Your documents": fanned pages with an upload arrow. */
export function DocumentsArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 96"
      fill="none"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("pointer-events-none select-none", className)}
    >
      <ellipse cx="80" cy="88" rx="56" ry="5" className="fill-foreground/[0.05]" />
      <circle cx="80" cy="46" r="40" className="fill-primary/[0.07]" />
      <g transform="translate(36 22) rotate(-12)">
        <rect width="40" height="52" rx="6" className={cn("fill-card", LINE)} />
        <rect x="8" y="12" width="22" height="3" rx="1.5" className="fill-foreground/20" />
        <rect x="8" y="20" width="16" height="3" rx="1.5" className="fill-foreground/15" />
      </g>
      <g transform="translate(86 18) rotate(12)">
        <rect width="40" height="52" rx="6" className={cn("fill-card", LINE)} />
        <rect x="8" y="12" width="22" height="3" rx="1.5" className="fill-foreground/20" />
        <rect x="8" y="20" width="18" height="3" rx="1.5" className="fill-foreground/15" />
      </g>
      <g transform="translate(58 14)">
        <rect width="44" height="58" rx="7" className={cn("fill-card", LINE)} />
        <rect x="8" y="9" width="16" height="9" rx="2.5" className="fill-primary/20" />
        <rect x="8" y="24" width="28" height="3" rx="1.5" className="fill-foreground/20" />
        <rect x="8" y="32" width="20" height="3" rx="1.5" className="fill-foreground/15" />
        <circle cx="22" cy="48" r="9" className="fill-primary/15 stroke-primary" />
        <path
          d="M22 52.5 V43.5 M18 47 L22 43 L26 47"
          className="stroke-primary"
          strokeWidth={1.8}
        />
      </g>
      <Sparkle x={26} y={24} s={0.7} />
      <Sparkle x={138} y={64} s={0.6} />
    </svg>
  );
}
