import { useNavigate } from "react-router-dom";
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

type LinkInstagramPromptDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function LinkInstagramPromptDialog({ open, onOpenChange }: LinkInstagramPromptDialogProps) {
  const navigate = useNavigate();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Link Instagram for this workspace?</AlertDialogTitle>
          <AlertDialogDescription>
            Your workspace is ready. Connect an Instagram Professional account in Settings to run automations, DMs,
            and scheduling. You can skip this and link later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <AlertDialogCancel className="w-full sm:w-auto">Not now</AlertDialogCancel>
          <AlertDialogAction
            className="w-full sm:w-auto"
            onClick={() => {
              onOpenChange(false);
              navigate("/settings?tab=General");
            }}
          >
            Link Instagram
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
