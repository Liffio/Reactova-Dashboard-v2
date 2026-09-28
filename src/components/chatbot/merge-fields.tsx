import { Sparkles } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PlanChip, useUpgradeSheet } from "./upgrade";

/**
 * Merge fields (`chatbot:personalization`): inserts `{{first_name|there}}`-style tokens into a
 * message. The server renders them when the message is sent, from the person's details at that
 * moment; without the plan they render as their fallback, so the control is locked, not hidden.
 */
export function MergeFieldPicker({
  enabled,
  answerKeys,
  onInsert,
}: {
  enabled: boolean;
  /** Answer keys saved by this chatbot's Question steps. */
  answerKeys: string[];
  onInsert: (token: string) => void;
}) {
  const openUpgrade = useUpgradeSheet();

  if (!enabled) {
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
        onClick={() =>
          openUpgrade({ capability: "chatbot:personalization", feature: "Merge fields" })
        }
      >
        <Sparkles className="h-3.5 w-3.5" /> Insert a field
        <PlanChip capability="chatbot:personalization" />
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
        >
          <Sparkles className="h-3.5 w-3.5" /> Insert a field
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Filled in when the message is sent. The text after | shows if it's unknown.
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onInsert("{{first_name|there}}")}>
          First name
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onInsert("{{username}}")}>
          Instagram username
        </DropdownMenuItem>
        {answerKeys.length > 0 && <DropdownMenuSeparator />}
        {answerKeys.map((key) => (
          <DropdownMenuItem key={key} onSelect={() => onInsert(`{{answer.${key}}}`)}>
            Answer: {key}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
