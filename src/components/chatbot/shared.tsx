import { ApiError } from "@/lib/api/http";
import type { PublishProblem } from "@/lib/api/chatbot-api";
import { getUserErrorMessage } from "@/lib/user-facing-error";
import { cn } from "@/lib/utils";

/** A publish 422 carries the problems. */
export function publishProblems(e: unknown): PublishProblem[] {
  return (
    (e instanceof ApiError
      ? (e.body as { details?: { problems?: PublishProblem[] } })?.details?.problems
      : undefined) ?? []
  );
}

/** The first blocking problem is the sentence worth showing in a toast. */
export function publishErrorMessage(e: unknown): string {
  const blocking = publishProblems(e).filter((p) => p.severity === "error");
  if (blocking.length)
    return blocking.length > 1
      ? `${blocking[0].message} (and ${blocking.length - 1} more)`
      : blocking[0].message;
  return getUserErrorMessage(e, "Couldn't go live.");
}

export function StatusPill({ status }: { status: string }) {
  const live = status === "LIVE";
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        live ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
      )}
    >
      {live && (
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-success align-[1px]" />
      )}
      {live ? "Live" : status === "PAUSED" ? "Paused" : "Draft"}
    </span>
  );
}
