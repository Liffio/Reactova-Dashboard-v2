import { Info, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { WITHHELD_HINT, type InstagramIdentity } from "@/lib/instagram-identity";
import { cn } from "@/lib/utils";

/**
 * A chatbot contact's picture, else the first letter of their name or username, else a person
 * icon. An Instagram picture URL expires after a while; the avatar then falls back on its own
 * instead of showing a broken image.
 */
export function ContactAvatar({
  identity,
  src,
  className,
}: {
  identity: InstagramIdentity;
  src: string | null | undefined;
  className?: string;
}) {
  return (
    <Avatar className={cn("h-9 w-9 shrink-0", className)}>
      {src && <AvatarImage src={src} alt="" className="object-cover" />}
      <AvatarFallback className="bg-brand-gradient text-xs font-bold text-white">
        {identity.initial ?? <User className="h-4 w-4" aria-hidden />}
      </AvatarFallback>
    </Avatar>
  );
}

/**
 * The name line: name, else `@username`, else "Instagram user" (never the numeric id). When
 * Instagram declined to share the profile, a small info mark says so, so "Instagram user" reads
 * as a fact rather than a bug.
 */
export function ContactName({
  identity,
  className,
}: {
  identity: InstagramIdentity;
  className?: string;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", className)}>
      <span
        className={cn(
          "truncate",
          !identity.secondary && identity.initial === null && "text-muted-foreground",
        )}
      >
        {identity.primary}
      </span>
      {identity.secondary && (
        <span className="truncate text-xs font-normal text-muted-foreground">
          {identity.secondary}
        </span>
      )}
      {identity.withheld && (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="shrink-0 text-muted-foreground"
                aria-label={WITHHELD_HINT}
                role="img"
              >
                <Info className="h-3.5 w-3.5" aria-hidden />
              </span>
            </TooltipTrigger>
            <TooltipContent>{WITHHELD_HINT}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </span>
  );
}
