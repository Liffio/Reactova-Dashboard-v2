import { useState } from "react";
import { Check, ChevronRight, Pencil } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatHandle, bareHandle } from "@/lib/format";
import { SlotBar } from "./slot-bar";
import { PlanChip, ExpiredChip } from "./plan-chip";
import type { SwitcherGroup, SwitcherWorkspace } from "@/lib/api/workspace-switcher-api";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * The workspace's Instagram avatar, falling back to its initials.
 *
 * Both fallbacks are ordinary paths, not error handling: most workspaces have no Instagram
 * connected, and the CDN URLs that do exist are signed and expire, so one can reach the browser and
 * 403. `failedSrc` is compared against the current `src` rather than being a boolean, so a
 * different workspace re-attempts its own image instead of inheriting the previous failure.
 */
function Avatar({
  name,
  src,
  className,
  muted,
}: {
  name: string;
  src: string | null;
  className?: string;
  /** Expired rows grey their avatar, matching the row's own de-emphasis. */
  muted?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const url = src?.trim() || null;

  if (!url || failedSrc === url) {
    return (
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-lg bg-brand-gradient text-xs font-semibold text-primary-foreground",
          muted && "opacity-50 grayscale",
          className,
        )}
      >
        {initials(name)}
      </span>
    );
  }
  return (
    <img
      src={url}
      alt=""
      className={cn(
        "size-8 shrink-0 rounded-lg object-cover",
        muted && "opacity-50 grayscale",
        className,
      )}
      onError={() => setFailedSrc(url)}
    />
  );
}

/** The second line: what this workspace is, or why it cannot be used. */
function subLine(workspace: SwitcherWorkspace, inGroupName: string | null): string {
  if (workspace.readOnly) {
    const when = workspace.expiredAt
      ? new Date(workspace.expiredAt).toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
        })
      : null;
    return when ? `Plan expired ${when}. Renew to resume` : "Plan expired. Renew to resume";
  }
  if (inGroupName) return `In ${inGroupName}`;
  const handle = bareHandle(workspace.igHandle);
  if (handle) return formatHandle(handle) ?? "";
  return "No Instagram connected";
}

export function WorkspaceRow({
  workspace,
  group,
  isCurrent,
  showSlotNo,
  onSelect,
  onRename,
}: {
  workspace: SwitcherWorkspace;
  /** Set when this row is being shown at the ROOT level as a search hit inside a group. */
  group?: SwitcherGroup | null;
  isCurrent: boolean;
  /** Inside the group view, rows are numbered and the plan chip is redundant. */
  showSlotNo?: boolean;
  onSelect: () => void;
  onRename?: () => void;
}) {
  const expired = workspace.readOnly;

  return (
    <div className="group/row flex items-center rounded-lg hover:bg-accent/60">
      <button
        type="button"
        onClick={onSelect}
        aria-current={isCurrent ? "true" : undefined}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-2 text-left"
      >
        {showSlotNo ? (
          <span className="w-4 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
            {workspace.slotNo}
          </span>
        ) : null}

        <Avatar
          name={workspace.name}
          src={workspace.profilePictureUrl}
          muted={expired}
          className={showSlotNo ? "size-7" : undefined}
        />

        <span className="grid min-w-0 flex-1 leading-tight">
          <span
            className={cn(
              "truncate text-[13.5px] font-semibold",
              expired && "text-muted-foreground",
            )}
          >
            {workspace.name}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {subLine(workspace, group ? group.name : null)}
          </span>
        </span>

        {/* Inside a group the number already says which row this is, and every member shares the
            group's plan — a chip on each would repeat the same word down the list. */}
        {showSlotNo ? null : expired ? (
          <ExpiredChip />
        ) : (
          <PlanChip plan={workspace.plan} label={workspace.planLabel} />
        )}

        <span className="grid w-4 shrink-0 place-items-center text-primary">
          {isCurrent ? <Check className="size-4" /> : null}
        </span>
      </button>

      {onRename ? (
        <button
          type="button"
          onClick={onRename}
          aria-label={`Rename ${workspace.name}`}
          // Always visible on touch, where there is no hover to reveal it.
          className="mr-1 grid size-[30px] shrink-0 place-items-center rounded-lg text-muted-foreground opacity-100 hover:bg-card hover:text-foreground focus-visible:opacity-100 md:opacity-0 md:group-hover/row:opacity-100"
        >
          <Pencil className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

/** An agency group as ONE row at the top level. Tapping it opens the group view. */
export function GroupRow({
  group,
  containsCurrent,
  onOpen,
}: {
  group: SwitcherGroup;
  /** A dot beside the name when the active workspace lives inside this group. */
  containsCurrent: boolean;
  onOpen: () => void;
}) {
  return (
    <div className="flex items-center rounded-lg hover:bg-accent/60">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${group.name}, ${group.slotsUsed} of ${group.slotLimit} workspaces used`}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-2 text-left"
      >
        {/* Stacked tiles: one glance says "this is several workspaces", which a single avatar
            cannot. Purely decorative, so it carries no text of its own. */}
        <span aria-hidden className="relative size-8 shrink-0">
          <span className="absolute left-0 top-0 size-[26px] rounded-lg bg-brand-gradient opacity-40" />
          <span className="absolute left-[5px] top-[3px] size-[26px] rounded-lg bg-brand-gradient opacity-70" />
          <span className="absolute left-[10px] top-[6px] grid size-[26px] place-items-center rounded-lg bg-brand-gradient text-[11px] font-semibold text-primary-foreground">
            {initials(group.name)}
          </span>
        </span>

        <span className="grid min-w-0 flex-1 leading-tight">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[13.5px] font-semibold">{group.name}</span>
            {containsCurrent ? (
              <span
                aria-hidden
                title="You are in this agency"
                className="size-1.5 shrink-0 rounded-full bg-primary"
              />
            ) : null}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {group.slotsUsed} of {group.slotLimit} workspaces used
          </span>
          <SlotBar used={group.slotsUsed} limit={group.slotLimit} className="mt-1.5" />
        </span>

        {group.readOnly ? <ExpiredChip /> : <PlanChip plan={group.plan} label={group.planLabel} />}
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </div>
  );
}
