import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

/**
 * Only shown when the chatbot has running conversations (the caller skips straight to pausing
 * when there are none — nothing to choose between). Pausing itself always refuses new runs; this
 * is only about whatever's already under way.
 */
export function PauseConfirmDialog({
  open,
  chatbotName,
  activeSessionCount,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  chatbotName: string;
  activeSessionCount: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (endRunning: boolean) => void;
}) {
  const [choice, setChoice] = useState<"finish" | "end">("finish");

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Pause {chatbotName}?</AlertDialogTitle>
          <AlertDialogDescription>
            {activeSessionCount} conversation{activeSessionCount === 1 ? "" : "s"}{" "}
            {activeSessionCount === 1 ? "is" : "are"} running right now. Pausing always stops new
            ones from starting — choose what happens to these.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <RadioGroup
          value={choice}
          onValueChange={(v) => setChoice(v as "finish" | "end")}
          className="gap-3"
        >
          <div className="flex items-start gap-2">
            <RadioGroupItem value="finish" id="pause-finish" className="mt-0.5" />
            <Label htmlFor="pause-finish" className="flex-1 cursor-pointer font-normal">
              <span className="block font-medium text-foreground">Let current chats finish</span>
              <span className="block text-xs text-muted-foreground">
                They keep going on the version they started; nothing new starts.
              </span>
            </Label>
          </div>
          <div className="flex items-start gap-2">
            <RadioGroupItem value="end" id="pause-end" className="mt-0.5" />
            <Label htmlFor="pause-end" className="flex-1 cursor-pointer font-normal">
              <span className="block font-medium text-foreground">End them now</span>
              <span className="block text-xs text-muted-foreground">
                Every running conversation with this bot stops immediately.
              </span>
            </Label>
          </div>
        </RadioGroup>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              onConfirm(choice === "end");
            }}
          >
            Pause
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
