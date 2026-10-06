import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FOLLOW_UNKNOWN_HINT } from "@/lib/instagram-identity";

/**
 * Three states, not two (spec item 4): `true`/`false` are both known facts, `null` is Instagram
 * never having shared it — a platform limit, not a loading failure, so it gets its own label and
 * an explanation rather than reading as the same dash a real "No" would.
 */
export function FollowingStatus({ value }: { value: boolean | null }) {
  if (value === null) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="gap-1 border-border bg-muted text-muted-foreground"
          >
            Unknown
            <Info className="h-3 w-3" aria-hidden />
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{FOLLOW_UNKNOWN_HINT}</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Badge
      variant="outline"
      className={
        value
          ? "border-success/30 bg-success/10 text-success"
          : "border-border bg-muted text-muted-foreground"
      }
    >
      {value ? "Yes" : "No"}
    </Badge>
  );
}
