import { cn } from "@/lib/utils";

type IllustrationProps = {
  className?: string;
};

export function DmAutomationIllustration({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 360 320"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-full max-w-[340px]", className)}
      aria-hidden
    >
      <rect x="88" y="24" width="184" height="272" rx="28" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="2" />
      <rect x="104" y="44" width="152" height="28" rx="14" fill="hsl(var(--muted))" />
      <circle cx="120" cy="58" r="8" fill="hsl(var(--primary) / 0.35)" />
      <rect x="136" y="52" width="72" height="12" rx="6" fill="hsl(var(--border))" />

      <rect x="104" y="88" width="120" height="44" rx="14" fill="hsl(var(--primary) / 0.12)" stroke="hsl(var(--primary) / 0.35)" />
      <rect x="116" y="100" width="72" height="8" rx="4" fill="hsl(var(--primary) / 0.5)" />
      <rect x="116" y="114" width="48" height="6" rx="3" fill="hsl(var(--primary) / 0.25)" />

      <rect x="136" y="148" width="120" height="40" rx="14" fill="hsl(var(--muted))" />
      <rect x="148" y="160" width="80" height="8" rx="4" fill="hsl(var(--border))" />
      <rect x="148" y="172" width="56" height="6" rx="3" fill="hsl(var(--border) / 0.7)" />

      <rect x="104" y="200" width="152" height="52" rx="16" fill="hsl(var(--success) / 0.12)" stroke="hsl(var(--success) / 0.4)" />
      <path d="M120 220h8v8h-8z" fill="hsl(var(--success))" />
      <rect x="136" y="216" width="96" height="8" rx="4" fill="hsl(var(--success) / 0.55)" />
      <rect x="136" y="230" width="72" height="6" rx="3" fill="hsl(var(--success) / 0.3)" />

      <g className="auth-float-slow">
        <rect x="248" y="108" width="88" height="56" rx="12" fill="hsl(var(--card))" stroke="hsl(var(--primary) / 0.45)" strokeWidth="1.5" />
        <circle cx="268" cy="128" r="10" fill="hsl(var(--accent) / 0.35)" />
        <rect x="284" y="122" width="40" height="6" rx="3" fill="hsl(var(--border))" />
        <rect x="284" y="134" width="28" height="5" rx="2.5" fill="hsl(var(--muted-foreground) / 0.35)" />
        <text x="262" y="152" fill="hsl(var(--primary))" fontSize="10" fontWeight="700" fontFamily="system-ui">
          Auto-reply
        </text>
      </g>

      <g className="auth-float-delayed">
        <rect x="24" y="168" width="72" height="72" rx="16" fill="hsl(var(--card))" stroke="hsl(var(--border))" />
        <path
          d="M44 198c8-12 24-12 32 0 8 12 24 12 32 0"
          stroke="hsl(var(--primary))"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="60" cy="210" r="4" fill="hsl(var(--primary))" />
        <circle cx="76" cy="210" r="4" fill="hsl(var(--primary) / 0.5)" />
        <circle cx="92" cy="210" r="4" fill="hsl(var(--primary) / 0.25)" />
      </g>
    </svg>
  );
}

export function AnalyticsIllustration({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 360 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-full max-w-[340px]", className)}
      aria-hidden
    >
      <rect x="40" y="40" width="280" height="200" rx="20" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="2" />
      <rect x="56" y="56" width="120" height="12" rx="6" fill="hsl(var(--muted))" />
      <rect x="56" y="76" width="80" height="8" rx="4" fill="hsl(var(--border))" />

      <rect x="72" y="168" width="28" height="56" rx="6" fill="hsl(var(--primary) / 0.25)" />
      <rect x="112" y="140" width="28" height="84" rx="6" fill="hsl(var(--primary) / 0.45)" />
      <rect x="152" y="120" width="28" height="104" rx="6" fill="hsl(var(--primary) / 0.65)" />
      <rect x="192" y="100" width="28" height="124" rx="6" fill="hsl(var(--primary))" />
      <rect x="232" y="128" width="28" height="96" rx="6" fill="hsl(var(--accent) / 0.55)" />

      <path
        d="M72 148 L112 118 L152 132 L192 96 L232 108 L272 88"
        stroke="hsl(var(--success))"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="192" cy="96" r="5" fill="hsl(var(--success))" />

      <g className="auth-float-slow">
        <rect x="248" y="24" width="96" height="48" rx="12" fill="hsl(var(--card))" stroke="hsl(var(--success) / 0.5)" />
        <text x="262" y="46" fill="hsl(var(--success))" fontSize="11" fontWeight="700" fontFamily="system-ui">
          +34% CTR
        </text>
        <text x="262" y="62" fill="hsl(var(--muted-foreground))" fontSize="9" fontFamily="system-ui">
          vs last week
        </text>
      </g>

      <g className="auth-float-delayed">
        <rect x="24" y="200" width="88" height="64" rx="14" fill="hsl(var(--card))" stroke="hsl(var(--border))" />
        <circle cx="48" cy="224" r="14" fill="hsl(var(--violet) / 0.25)" />
        <rect x="68" y="216" width="32" height="6" rx="3" fill="hsl(var(--border))" />
        <rect x="68" y="228" width="24" height="5" rx="2.5" fill="hsl(var(--muted-foreground) / 0.35)" />
        <text x="36" y="252" fill="hsl(var(--foreground))" fontSize="10" fontWeight="600" fontFamily="system-ui">
          2.4k leads
        </text>
      </g>
    </svg>
  );
}

export function SecurityIllustration({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 320 280"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-full max-w-[300px]", className)}
      aria-hidden
    >
      <path
        d="M160 32 L248 72 V140 C248 188 208 228 160 248 C112 228 72 188 72 140 V72 Z"
        fill="hsl(var(--primary) / 0.1)"
        stroke="hsl(var(--primary) / 0.45)"
        strokeWidth="2"
      />
      <path
        d="M160 88 L200 108 V148 C200 172 184 188 160 196 C136 188 120 172 120 148 V108 Z"
        fill="hsl(var(--card))"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
      />
      <rect x="148" y="128" width="24" height="32" rx="4" fill="hsl(var(--primary))" />
      <circle cx="160" cy="140" r="6" fill="hsl(var(--primary-foreground))" />

      <g className="auth-float-slow">
        <rect x="220" y="100" width="72" height="40" rx="10" fill="hsl(var(--card))" stroke="hsl(var(--border))" />
        <text x="232" y="124" fill="hsl(var(--foreground))" fontSize="10" fontWeight="600" fontFamily="system-ui">
          MFA ready
        </text>
      </g>

      <g className="auth-float-delayed">
        <rect x="28" y="120" width="72" height="40" rx="10" fill="hsl(var(--card))" stroke="hsl(var(--success) / 0.45)" />
        <text x="40" y="144" fill="hsl(var(--success))" fontSize="10" fontWeight="600" fontFamily="system-ui">
          Encrypted
        </text>
      </g>
    </svg>
  );
}

export function OnboardingIllustration({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 360 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-full max-w-[340px]", className)}
      aria-hidden
    >
      <rect x="48" y="48" width="264" height="180" rx="20" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="2" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <circle cx={88 + i * 88} cy={108} r={20} fill={i === 2 ? "hsl(var(--primary))" : "hsl(var(--muted))"} />
          {i < 2 && (
            <rect x={108 + i * 88} y={104} width={48} height={8} rx={4} fill="hsl(var(--border))" />
          )}
        </g>
      ))}
      <rect x="72" y="148" width="216" height="12" rx="6" fill="hsl(var(--muted))" />
      <rect x="72" y="168" width="160" height="12" rx="6" fill="hsl(var(--border))" />
      <rect x="72" y="196" width="120" height="20" rx="10" fill="hsl(var(--primary))" />

      <g className="auth-float-slow">
        <rect x="248" y="24" width="88" height="48" rx="12" fill="hsl(var(--card))" stroke="hsl(var(--accent) / 0.5)" />
        <text x="262" y="48" fill="hsl(var(--accent))" fontSize="10" fontWeight="700" fontFamily="system-ui">
          3 min setup
        </text>
        <text x="262" y="62" fill="hsl(var(--muted-foreground))" fontSize="9" fontFamily="system-ui">
          Meta API
        </text>
      </g>
    </svg>
  );
}
