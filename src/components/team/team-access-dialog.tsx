import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ShieldCheck, X } from "lucide-react";

import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DialogBody,
  DialogFooterBar,
  DialogHeaderBar,
  ResponsiveDialog,
} from "@/components/workspace-switcher/responsive-dialog";
import { WorkspaceTile } from "@/components/workspace-switcher/workspace-tile";
import { cn } from "@/lib/utils";
import {
  getTeamOptions,
  upsertGroupMember,
  type TeamOverview,
  type TeamOverviewMember,
} from "@/lib/api/team-api";
import { ApiError } from "@/lib/api/http";

/**
 * Roles come from the SERVER, never a list written here. (U5)
 *
 * 🔴 The reference prototype offers Admin, Editor and Viewer. This product has no EDITOR role at
 * all, and its VIEWER holds no `workspace` permission, so two of those three would either be
 * refused outright with `INVALID_ROLE` or grant somebody access they cannot use. `GET /team/options`
 * returns exactly the roles this workspace can assign, which is the only list that cannot go stale.
 */
const FALLBACK_ROLE = "MEMBER";

/**
 * Invite somebody to an agency, or change what an existing member can reach. (U5, spec 5.7)
 *
 * ## One dialog, two jobs
 *
 * The reference draws invite and edit as the same surface, and they differ in exactly three ways:
 * the title, whether the email field exists, and the label on the primary button. Splitting them
 * into two components would duplicate the scope picker, the workspace checklist and the invoice
 * switch, which are the parts with real behaviour in them.
 *
 * ## Why the scope choice is not a checkbox
 *
 * "Whole group" and "Selected workspaces" are not a setting with a default, they are a decision
 * about what happens to workspaces that do not exist yet: a whole-group member reaches them
 * automatically, a selected member does not. The reference makes it a radio for that reason, and
 * the copy says so on the row itself rather than in a tooltip.
 */
export function TeamAccessDialog({
  open,
  onOpenChange,
  overview,
  editing,
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overview: TeamOverview;
  /** The workspace whose assignable roles the server should answer with. */
  workspaceId: string;
  /** The member being edited, or null when inviting somebody new. */
  editing: TeamOverviewMember | null;
}) {
  const queryClient = useQueryClient();
  const group = overview.group;

  const rolesQuery = useQuery({
    queryKey: ["team-options", group?.id ?? "standalone"],
    queryFn: () => getTeamOptions(workspaceId),
    enabled: open,
  });
  const roles = rolesQuery.data?.roles ?? [];

  const [email, setEmail] = useState("");
  const [roleKey, setRoleKey] = useState<string>(FALLBACK_ROLE);
  const [scope, setScope] = useState<"GROUP" | "SELECTED">("SELECTED");
  const [workspaceIds, setWorkspaceIds] = useState<string[]>([]);
  /** Spec 2.7: off by default, because invoices carry billing and tax details. */
  const [canDownloadInvoices, setCanDownloadInvoices] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail("");
    setRoleKey(editing?.roleKey ?? FALLBACK_ROLE);
    setScope(editing?.scope ?? "SELECTED");
    setWorkspaceIds(editing?.selectedWorkspaceIds ?? []);
    setCanDownloadInvoices(editing?.canDownloadInvoices ?? false);
  }, [open, editing]);

  const save = useMutation({
    mutationFn: async () => {
      if (!group) throw new Error("This workspace is not part of an agency.");
      return upsertGroupMember(group.id, {
        ...(editing ? { userId: editing.userId } : { email: email.trim() }),
        roleKey,
        scope,
        workspaceIds: scope === "SELECTED" ? workspaceIds : undefined,
        canDownloadInvoices,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["team-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["workspace-switcher"] });
      toast.success(editing ? "Access updated" : `Invite sent to ${email.trim()}`);
      onOpenChange(false);
    },
    onError: (error) => {
      // The server names what went wrong (the workspace that is full, the account that does not
      // exist), and that is the actionable part, so it is shown rather than a generic failure.
      toast.error(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Could not save that access",
      );
    },
  });

  const emailLooksValid = /.+@.+\..+/.test(email.trim());
  const canSave =
    (editing ? true : emailLooksValid) && (scope === "GROUP" || workspaceIds.length > 0);

  const toggleWorkspace = (id: string) =>
    setWorkspaceIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit access" : "Invite to the agency"}
    >
      <DialogHeaderBar>
        <h2 className="font-display text-xl font-semibold tracking-tight">
          {editing
            ? `Edit access for ${editing.name ?? editing.email}`
            : `Invite to ${group?.name ?? "this workspace"}`}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {editing ? editing.email : "They get an email with a link to join."}
        </p>
      </DialogHeaderBar>

      <DialogBody className="px-6 py-5">
        {!editing ? (
          <div>
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
              className="mt-1.5"
              autoFocus
            />
          </div>
        ) : null}

        <div className={cn(!editing && "mt-3.5")}>
          <Label htmlFor="invite-role">Role</Label>
          <select
            id="invite-role"
            value={roleKey}
            onChange={(event) => setRoleKey(event.target.value)}
            className="mt-1.5 h-10 w-full rounded-lg border-[1.5px] bg-card px-3 text-sm outline-none focus:border-primary"
          >
            {(roles.length > 0 ? roles : [{ key: FALLBACK_ROLE, name: "Member" }]).map((option) => (
              <option key={option.key} value={option.key}>
                {option.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            Applies to every workspace they can open.
          </p>
        </div>

        {group ? (
          <div className="mt-3.5">
            <div className="mb-1.5 text-[13px] font-medium">Access</div>
            <div role="radiogroup" aria-label="Access" className="flex flex-col gap-2">
              <ScopeChoice
                checked={scope === "GROUP"}
                onSelect={() => setScope("GROUP")}
                title="Whole group"
                description={`Every workspace in ${group.name}, including ones added later`}
              />
              <ScopeChoice
                checked={scope === "SELECTED"}
                onSelect={() => setScope("SELECTED")}
                title="Selected workspaces"
                description="Only the workspaces you tick"
              />
            </div>

            {scope === "SELECTED" ? (
              <div className="ml-[30px] mt-2 overflow-hidden rounded-xl border">
                {group.workspaces.map((workspace) => {
                  const on = workspaceIds.includes(workspace.id);
                  return (
                    <button
                      key={workspace.id}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggleWorkspace(workspace.id)}
                      className="flex w-full items-center gap-2.5 border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-accent/60"
                    >
                      <span
                        className={cn(
                          "grid size-[18px] shrink-0 place-items-center rounded-[5px] border-[1.5px]",
                          on ? "border-primary bg-primary text-primary-foreground" : "border-border",
                        )}
                      >
                        {on ? <Check aria-hidden className="size-3 stroke-[3]" /> : null}
                      </span>
                      <span className="w-[18px] shrink-0 text-right text-[11.5px] tabular-nums text-muted-foreground">
                        {workspace.slotNo}
                      </span>
                      <WorkspaceTile name={workspace.name} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">
                        {workspace.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-3.5 flex items-center gap-3 rounded-xl border px-3.5 py-3">
          <span className="grid min-w-0 flex-1 leading-tight">
            <span className="text-[13.5px] font-semibold">Can download invoices</span>
            <span className="text-[12.5px] text-muted-foreground">
              Off by default. Invoices include billing and tax details.
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={canDownloadInvoices}
            aria-label="Can download invoices"
            onClick={() => setCanDownloadInvoices((value) => !value)}
            className={cn(
              "relative h-6 w-10 shrink-0 rounded-full transition-colors",
              canDownloadInvoices ? "bg-primary" : "bg-border",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute left-[3px] top-[3px] size-[18px] rounded-full bg-white shadow transition-transform",
                canDownloadInvoices && "translate-x-4",
              )}
            />
          </button>
        </div>
      </DialogBody>

      <DialogFooterBar>
        <span className="flex min-w-[180px] flex-1 items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck aria-hidden className="size-3.5" />
          Only you can change billing.
        </span>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button disabled={!canSave || save.isPending} onClick={() => save.mutate()}>
          {editing ? "Save access" : "Send invite"}
        </Button>
      </DialogFooterBar>
    </ResponsiveDialog>
  );
}

function ScopeChoice({
  checked,
  onSelect,
  title,
  description,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border bg-card px-3.5 py-3 text-left",
        checked && "border-primary ring-[3px] ring-primary/15",
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border-[1.5px]",
          checked ? "border-primary" : "border-border",
        )}
      >
        {checked ? <span aria-hidden className="size-2 rounded-full bg-primary" /> : null}
      </span>
      <span className="grid min-w-0 flex-1 leading-tight">
        <span className="text-[13.5px] font-semibold">{title}</span>
        <span className="text-[12.5px] text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

/** The close affordance the header bar draws, kept beside the dialog it belongs to. */
export function DialogCloseX({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
      className="grid size-[30px] shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <X aria-hidden className="size-4" />
    </button>
  );
}
