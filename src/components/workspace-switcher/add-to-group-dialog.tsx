import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";

import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "./responsive-dialog";
import { SlotBar } from "./slot-bar";
import { createWorkspaceInGroup, type SwitcherGroup } from "@/lib/api/workspace-switcher-api";

/**
 * Add a workspace inside an agency. No payment and no price.
 *
 * The slot was bought when the agency was, so this screen deliberately shows no amount at all —
 * a price here, even a zero, would invite the reader to wonder what they are about to be charged.
 * What it shows instead is which slot this is and when the agency renews, because those are the two
 * things that are actually true about the workspace they are creating.
 */
export function AddToGroupDialog({
  group,
  open,
  onOpenChange,
  onCreated,
}: {
  group: SwitcherGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (workspaceId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setName("");
      setBusy(false);
    }
  }, [open]);

  if (!group) return null;

  const nextSlot = group.slotsUsed + 1;
  const remaining = group.slotLimit - nextSlot;
  const renews = group.renewsAt
    ? new Date(group.renewsAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })
    : null;

  const submit = async () => {
    setBusy(true);
    try {
      const created = await createWorkspaceInGroup(group.id, { name: name.trim() });
      await queryClient.invalidateQueries({ queryKey: ["workspace-switcher"] });
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      toast.success(`Created in ${group.name}, ${created.slotsUsed}/${created.slotLimit} used`);
      onCreated(created.id);
      onOpenChange(false);
    } catch (error) {
      // The server refuses a full or expired agency by code; its message is the actionable one.
      toast.error(error instanceof Error ? error.message : "Could not create the workspace");
      setBusy(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title={`Add to ${group.name}`}>
      <div className="px-6 pt-6">
        <h2 className="font-display text-xl font-semibold tracking-tight">Add to {group.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          No payment needed. This uses one of your agency slots.
        </p>
      </div>

      <div className="px-6 py-5">
        <Label htmlFor="group-ws-name" className="mb-1.5 block text-[13px] font-medium">
          Workspace name
        </Label>
        <Input
          id="group-ws-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Client name"
          maxLength={40}
          autoFocus
          onKeyDown={(event) => {
            if (event.key === "Enter" && name.trim() && !busy) void submit();
          }}
        />

        <div className="mt-4 flex gap-3 rounded-xl bg-muted p-3.5 text-sm">
          <Building2 aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
          <div>
            <b className="block">
              Slot {nextSlot} of {group.slotLimit}
            </b>
            <span className="text-muted-foreground">
              Gets every feature the agency includes
              {renews ? `, and renews with the rest of the agency on ${renews}.` : "."}
            </span>
          </div>
        </div>

        <SlotBar used={nextSlot} limit={group.slotLimit} size="lg" className="mt-3" />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t px-6 py-4">
        <span className="min-w-[180px] flex-1 text-xs text-muted-foreground">
          {remaining} {remaining === 1 ? "slot" : "slots"} left after this one
        </span>
        <Button disabled={!name.trim() || busy} onClick={() => void submit()}>
          {busy ? "Creating…" : "Create workspace"}
        </Button>
      </div>
    </ResponsiveDialog>
  );
}
