import { useMemo, useState } from "react";
import { ChevronLeft, Lock, Pencil, Plus, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { SlotBar } from "./slot-bar";
import { WorkspaceRow, GroupRow } from "./workspace-row";
import type { SwitcherGroup, SwitcherPayload } from "@/lib/api/workspace-switcher-api";
import type { RenameTarget } from "./rename-dialog";

type View = { kind: "root" } | { kind: "group"; groupId: string };

/**
 * The switcher's two views and the search that spans them.
 *
 * Search deliberately reaches INSIDE groups. An agency owner looking for "Bloom Room" knows the
 * workspace's name, not which of twenty slots it sits in, and making them drill in first would be
 * asking them to remember something the product already knows.
 *
 * 🔴 NO PENCIL ON TOP-LEVEL ROWS. Spec 5.7: renaming appears only inside the agency group view, on
 * the group header and on each row within it. A standalone workspace is renamed from Settings.
 * This file used to pass `onRename` to every root row the user owned, which put a pencil on rows
 * the HTML shows without one. The group view below still passes it, which is the whole of the
 * distinction.
 */
export function SwitcherContent({
  data,
  currentWorkspaceId,
  onSelectWorkspace,
  onAddWorkspace,
  onAddToGroup,
  onRename,
  onClose,
}: {
  data: SwitcherPayload;
  currentWorkspaceId: string | null;
  onSelectWorkspace: (workspaceId: string) => void;
  onAddWorkspace: () => void;
  onAddToGroup: (group: SwitcherGroup) => void;
  onRename: (target: RenameTarget) => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<View>({ kind: "root" });
  const [query, setQuery] = useState("");

  const group =
    view.kind === "group" ? (data.groups.find((g) => g.id === view.groupId) ?? null) : null;

  const select = (workspaceId: string) => {
    onSelectWorkspace(workspaceId);
    onClose();
  };

  const hits = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return null;

    const rows: React.ReactNode[] = [];
    for (const workspace of data.workspaces) {
      if (workspace.name.toLowerCase().includes(needle)) {
        rows.push(
          <WorkspaceRow
            key={workspace.id}
            workspace={workspace}
            isCurrent={workspace.id === currentWorkspaceId}
            onSelect={() => select(workspace.id)}
          />,
        );
      }
    }
    for (const g of data.groups) {
      if (g.name.toLowerCase().includes(needle)) {
        rows.push(
          <GroupRow
            key={g.id}
            group={g}
            containsCurrent={g.workspaces.some((w) => w.id === currentWorkspaceId)}
            onOpen={() => {
              setQuery("");
              setView({ kind: "group", groupId: g.id });
            }}
          />,
        );
      }
      for (const member of g.workspaces) {
        if (member.name.toLowerCase().includes(needle)) {
          rows.push(
            <WorkspaceRow
              key={member.id}
              workspace={member}
              group={g}
              isCurrent={member.id === currentWorkspaceId}
              onSelect={() => select(member.id)}
            />,
          );
        }
      }
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, data, currentWorkspaceId]);

  if (group) {
    const full = group.slotsUsed >= group.slotLimit;
    const renews = group.renewsAt
      ? new Date(group.renewsAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })
      : null;

    return (
      <>
        <div className="border-b px-3 pb-3.5 pt-2.5">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setView({ kind: "root" })}
              aria-label="Back to all workspaces"
              className="grid size-[30px] shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-0 flex-1 truncate pl-0.5 font-display text-[17px] font-semibold tracking-tight">
              {group.name}
            </span>
            {group.isOwner ? (
              <button
                type="button"
                onClick={() => onRename({ kind: "group", id: group.id, name: group.name })}
                aria-label="Rename agency"
                className="grid size-[30px] shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Pencil className="size-4" />
              </button>
            ) : null}
          </div>

          <div className="mt-2.5 flex justify-between gap-2 px-0.5 text-xs text-muted-foreground">
            <span>
              <b className="font-semibold tabular-nums text-foreground">{group.slotsUsed}</b> of{" "}
              {group.slotLimit} workspaces used
            </span>
            {group.readOnly ? (
              <span className="text-destructive">Expired</span>
            ) : renews ? (
              <span>Renews {renews}</span>
            ) : null}
          </div>

          <SlotBar used={group.slotsUsed} limit={group.slotLimit} size="lg" className="mt-2" />
        </div>

        <div className="max-h-[min(50vh,320px)] flex-1 overflow-y-auto p-1.5">
          {group.workspaces.map((workspace) => (
            <WorkspaceRow
              key={workspace.id}
              workspace={workspace}
              isCurrent={workspace.id === currentWorkspaceId}
              showSlotNo
              onSelect={() => select(workspace.id)}
              onRename={
                group.isOwner
                  ? () => onRename({ kind: "workspace", id: workspace.id, name: workspace.name })
                  : undefined
              }
            />
          ))}
        </div>

        {group.isOwner ? (
          <div className="border-t p-1.5">
            <button
              type="button"
              disabled={full || group.readOnly}
              onClick={() => onAddToGroup(group)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2 py-2.5 text-left text-sm font-medium",
                full || group.readOnly
                  ? "cursor-not-allowed text-muted-foreground"
                  : "text-primary hover:bg-accent/60",
              )}
            >
              {full || group.readOnly ? (
                <Lock aria-hidden className="size-4" />
              ) : (
                <Plus aria-hidden className="size-4" />
              )}
              {group.readOnly
                ? "Renew to add workspaces"
                : full
                  ? `All ${group.slotLimit} slots used`
                  : "Add workspace"}
              <span className="ml-auto text-xs font-medium tabular-nums text-muted-foreground">
                {group.slotsUsed}/{group.slotLimit}
              </span>
            </button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      <label className="flex items-center gap-2 border-b px-3.5 py-2.5 text-muted-foreground">
        <Search aria-hidden className="size-4 shrink-0" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a workspace"
          aria-label="Find a workspace"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </label>

      <div className="max-h-[min(50vh,340px)] flex-1 overflow-y-auto p-1.5">
        {hits ? (
          hits.length > 0 ? (
            hits
          ) : (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No workspace matches “{query.trim()}”.
            </div>
          )
        ) : (
          <>
            <div className="px-2 pb-1 pt-2 text-[11.5px] font-medium text-muted-foreground">
              Your workspaces
            </div>
            {data.workspaces.map((workspace) => (
              <WorkspaceRow
                key={workspace.id}
                workspace={workspace}
                isCurrent={workspace.id === currentWorkspaceId}
                onSelect={() => select(workspace.id)}
              />
            ))}
            {data.groups.map((g) => (
              <GroupRow
                key={g.id}
                group={g}
                containsCurrent={g.workspaces.some((w) => w.id === currentWorkspaceId)}
                onOpen={() => setView({ kind: "group", groupId: g.id })}
              />
            ))}
          </>
        )}
      </div>

      <div className="border-t p-1.5">
        <button
          type="button"
          onClick={onAddWorkspace}
          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2.5 text-left text-sm font-medium text-primary hover:bg-accent/60"
        >
          <Plus aria-hidden className="size-4" />
          Add workspace
          <span className="ml-auto text-xs font-medium text-muted-foreground">
            {data.freeSlotAvailable ? "Free or paid" : "Paid plan"}
          </span>
        </button>
      </div>
    </>
  );
}
