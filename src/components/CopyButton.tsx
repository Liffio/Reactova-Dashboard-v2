import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function CopyButton({ value, className, label }: { value: string; className?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className={cn(
        "relative inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
        className
      )}
      aria-label="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      {label && <span>{copied ? "Copied!" : label}</span>}
      {!label && copied && (
        <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[11px] bg-foreground text-background px-2 py-0.5 rounded">
          Copied!
        </span>
      )}
    </button>
  );
}

export function CopyField({ value, mono = true }: { value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-input border border-border">
      <span className={cn("flex-1 text-sm text-foreground truncate", mono && "font-mono")}>{value}</span>
      <CopyButton value={value} />
    </div>
  );
}
