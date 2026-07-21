import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * The workspace's human-readable id, click-to-copy.
 *
 * People need this to hand to support or paste into an API integration, so the whole chip is the
 * copy target rather than a small icon — and it shows the id itself rather than a "Copy ID"
 * button, because the common case is reading it aloud or comparing it against a config file.
 */
export function WorkspaceIdChip({
  humanId,
  className,
  size = "sm",
}: {
  humanId: string | null;
  className?: string;
  size?: "sm" | "md";
}) {
  const [copied, setCopied] = useState(false);

  if (!humanId) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(humanId);
      setCopied(true);
      toast.success("Workspace ID copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard is unavailable over plain http and in some embedded webviews; the id is still
      // on screen to read, so this is a non-event rather than an error worth shouting about.
      toast.message(humanId, { description: "Copy manually — clipboard unavailable" });
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy workspace ID"
      aria-label={`Workspace ID ${humanId}. Click to copy.`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border bg-muted/50 font-mono text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        className
      )}
    >
      <span className="max-w-[180px] truncate">{humanId}</span>
      {copied ? (
        <Check className="h-3 w-3 shrink-0 text-success" />
      ) : (
        <Copy className="h-3 w-3 shrink-0 opacity-60" />
      )}
    </button>
  );
}
