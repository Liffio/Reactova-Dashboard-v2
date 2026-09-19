import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "./responsive-dialog";
import { renameGroup } from "@/lib/api/workspace-switcher-api";
import { updateWorkspace } from "@/lib/api/workspaces-api";

export type RenameTarget = { kind: "workspace" | "group"; id: string; name: string };

/**
 * Rename a workspace or an agency.
 *
 * One dialog for both because the interaction is identical and the only difference is which
 * endpoint it calls. Renaming never changes a workspace's `slug` or `humanId` — the external API
 * accepts the human id in place of the uuid, so regenerating it would break every integration
 * holding the old value. That is enforced server-side; this component simply sends a new name.
 */
export function RenameDialog({
  target,
  open,
  onOpenChange,
}: {
  target: RenameTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && target) setName(target.name);
    if (!open) setBusy(false);
  }, [open, target]);

  if (!target) return null;

  const submit = async () => {
    const next = name.trim();
    if (!next || next === target.name) {
      onOpenChange(false);
      return;
    }
    setBusy(true);
    try {
      if (target.kind === "group") {
        await renameGroup(target.id, { name: next });
      } else {
        await updateWorkspace(target.id, { displayName: next });
      }
      await queryClient.invalidateQueries({ queryKey: ["workspace-switcher"] });
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      toast.success(`Renamed to ${next}`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not rename");
      setBusy(false);
    }
  };

  const label = target.kind === "group" ? "agency" : "workspace";

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Rename ${label}`}
      className="sm:max-w-[420px]"
    >
      <div className="px-6 pt-6">
        <h2 className="font-display text-xl font-semibold tracking-tight">Rename {label}</h2>
      </div>

      <div className="px-6 py-5">
        <Label htmlFor="rename-input" className="mb-1.5 block text-[13px] font-medium">
          Name
        </Label>
        <Input
          id="rename-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={40}
          autoFocus
          /**
           * Select the existing name on open, the way the reference does. (U8)
           *
           * Renaming almost always means replacing, not appending: the field arrives holding the
           * current name and the first keystroke should overwrite it rather than land at whichever
           * end of it the caret happened to go. `onFocus` rather than a ref effect because
           * `autoFocus` and a `useEffect` race each other inside a dialog that mounts its content
           * lazily.
           */
          onFocus={(event) => event.currentTarget.select()}
          onKeyDown={(event) => {
            if (event.key === "Enter" && name.trim() && !busy) void submit();
          }}
        />
      </div>

      <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button disabled={!name.trim() || busy} onClick={() => void submit()}>
          {busy ? "Saving…" : "Save name"}
        </Button>
      </div>
    </ResponsiveDialog>
  );
}
