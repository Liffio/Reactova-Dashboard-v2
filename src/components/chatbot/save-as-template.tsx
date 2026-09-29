import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  chatbotTemplatesAdminApi,
  chatbotTemplatesAdminKeys,
  type CaptureResult,
} from "@/lib/api/chatbot-templates-admin-api";
import { getUserErrorMessage } from "@/lib/user-facing-error";

/**
 * "Save as template" (platform admins with `platform:module_manage`, from a workspace they belong
 * to). Captures this chatbot's saved draft into the template library, or replaces an existing
 * template's flow while keeping its name, category and visibility. What belongs to this workspace
 * (links, media, webhook address, recipients) is stripped, and the result says what was.
 */
export function SaveAsTemplateDialog({
  open,
  onOpenChange,
  workspaceId,
  chatbotId,
  unsaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  chatbotId: string;
  /** The builder has edits not saved yet; capture reads the saved draft. */
  unsaved: boolean;
}) {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<string>("new");
  const [result, setResult] = useState<CaptureResult | null>(null);

  const library = useQuery({
    queryKey: chatbotTemplatesAdminKeys.all,
    queryFn: chatbotTemplatesAdminApi.list,
    enabled: open,
  });

  const capture = useMutation({
    mutationFn: () =>
      chatbotTemplatesAdminApi.capture({
        workspaceId,
        chatbotId,
        ...(target === "new" ? {} : { templateId: target }),
      }),
    onSuccess: (r) => {
      setResult(r);
      void queryClient.invalidateQueries({ queryKey: chatbotTemplatesAdminKeys.all });
    },
  });

  const close = (o: boolean) => {
    if (!o) {
      setResult(null);
      setTarget("new");
      capture.reset();
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {result ? (result.created ? "Template saved" : "Template updated") : "Save as template"}
          </DialogTitle>
          <DialogDescription>
            {result
              ? result.created
                ? "It starts switched off. Give it a category and a description in the admin panel, then turn it on."
                : "The template now uses this flow. Its name, category and visibility are unchanged."
              : "Adds this chatbot's flow to the template library. Nothing from this workspace goes with it."}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col gap-2 text-sm">
            <p>
              {result.stepCount} step{result.stepCount === 1 ? "" : "s"} captured.
            </p>
            {result.stripped.length > 0 ? (
              <div className="rounded-xl border border-border p-3">
                <p className="mb-1.5 text-xs font-semibold">
                  Removed because they belong to this workspace:
                </p>
                <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                  {result.stripped.map((s, i) => (
                    <li key={i}>
                      {s.step ? <b className="font-medium text-foreground">{s.step}: </b> : null}
                      {s.what}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Nothing needed removing.</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3 text-sm">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium">Save to</span>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="new">A new template</option>
                {(library.data?.templates ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    Replace the flow of “{t.name}”
                  </option>
                ))}
              </select>
            </label>
            {unsaved && (
              <p className="text-xs text-warning">
                Your latest edits aren't saved yet. Wait for "Saved" so they're included.
              </p>
            )}
            {capture.error && (
              <p className="text-xs text-destructive">
                {getUserErrorMessage(capture.error, "Couldn't save this as a template.")}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <>
              <Button variant="outline" asChild>
                <Link to="/admin/chatbot-templates">Open template library</Link>
              </Button>
              <Button onClick={() => close(false)}>Done</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button onClick={() => capture.mutate()} disabled={capture.isPending || unsaved}>
                {capture.isPending
                  ? "Saving…"
                  : target === "new"
                    ? "Save template"
                    : "Replace flow"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
