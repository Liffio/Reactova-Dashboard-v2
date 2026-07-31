import { useState, type ReactNode } from "react";
import { AlertTriangle, Check, Copy, Info } from "lucide-react";

/**
 * Presentation pieces for in-console developer documentation.
 *
 * Kept separate from `form-page.tsx` because docs and forms want different things: a doc page is
 * read top to bottom and its code samples are meant to be copied, where a form is filled in.
 */

export function DocSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-soft sm:p-6">
      <h2 className="font-display text-base font-semibold">{title}</h2>
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** A copyable code sample. Copying is the primary interaction, so the button is always present. */
export function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(children).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      },
      () => {
        /* Clipboard is unavailable on insecure origins; the text is selectable regardless. */
      },
    );
  };

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={copy}
        aria-label="Copy code"
        className="absolute right-2 top-2 rounded-md border bg-background/80 p-1.5 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 focus:opacity-100"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
      {/* Scrolls inside itself — a wide sample must never make the page scroll sideways. */}
      <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
        {children}
      </pre>
    </div>
  );
}

export function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <div className="mt-1 text-sm text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

/**
 * A highlighted aside.
 *
 * `warn` is for things that will bite you; `info` for things worth knowing. Two tones only —
 * a palette of five makes every one of them ignorable.
 */
export function Callout({
  tone,
  title,
  children,
}: {
  tone: "info" | "warn";
  title: string;
  children: ReactNode;
}) {
  const styles =
    tone === "warn" ? "border-warning/30 bg-warning/5" : "border-primary/25 bg-primary/5";
  const Icon = tone === "warn" ? AlertTriangle : Info;
  const iconTone = tone === "warn" ? "text-warning" : "text-primary";

  return (
    <div className={`mt-3 flex gap-2.5 rounded-xl border p-3 ${styles}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconTone}`} />
      <div className="min-w-0 text-sm">
        <p className="font-medium">{title}</p>
        <div className="mt-0.5 text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}
