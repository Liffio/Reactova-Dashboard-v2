import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronsUpDown, ChevronRight } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { usePageTitle } from "@/hooks/use-page-title";
import { useIsMobile } from "@/hooks/use-mobile";
import { WorkspaceIdChip } from "@/components/workspace-id-chip";
import { useApp } from "@/state/app-context";
import { formatHandle } from "@/lib/format";
import { getSwitcher, type SwitcherGroup } from "@/lib/api/workspace-switcher-api";
import { SwitcherContent } from "./workspace-switcher/switcher-content";
import { AddWorkspaceDialog } from "./workspace-switcher/add-workspace-dialog";
import { AddToGroupDialog } from "./workspace-switcher/add-to-group-dialog";
import { RenameDialog, type RenameTarget } from "./workspace-switcher/rename-dialog";
import { PlanChip, ExpiredChip } from "./workspace-switcher/plan-chip";

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
 * Workspace switcher.
 *
 * Three triggers, one panel. `sidebar` is the footer row, `topbar` a compact pill, `crumb` the
 * header's breadcrumb — which already names the workspace and so is the obvious thing to click to
 * change it. The panel itself lives in `workspace-switcher/switcher-content.tsx`, because a second
 * copy is a second thing to keep correct.
 *
 * 🔴 The panel now reads `GET /workspaces/switcher` rather than the flat workspace list. Whether a
 * workspace sits in an agency, how many slots that agency has left, and whether either has expired
 * are server-side facts; the previous version could only render what it could infer, which is why
 * it showed neither groups nor expiry.
 *
 * A `Popover` replaces the old `DropdownMenu` deliberately: the panel contains a search input and
 * nested interactive rows, and a menu's roving-focus and typeahead behaviour actively fights both —
 * typing into the search box would move the menu's selection instead of filtering.
 */
export function WorkspaceSwitcher({
  variant = "sidebar",
}: {
  variant?: "sidebar" | "topbar" | "crumb";
} = {}) {
  const { current, setCurrentId, refreshAuth } = useApp();
  const { isMobile, setOpenMobile } = useSidebar();
  const mobile = useIsMobile();
  const page = usePageTitle();

  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [groupTarget, setGroupTarget] = useState<SwitcherGroup | null>(null);
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);

  /** Fetched only while the panel has been opened at least once — the shell renders the trigger. */
  const switcherQuery = useQuery({
    queryKey: ["workspace-switcher"],
    queryFn: getSwitcher,
    enabled: open || addOpen || Boolean(groupTarget),
  });

  const data = switcherQuery.data;

  /** The active workspace's row, wherever it lives — standalone or inside a group. */
  const activeRow =
    data?.workspaces.find((w) => w.id === current.id) ??
    data?.groups.flatMap((g) => g.workspaces).find((w) => w.id === current.id) ??
    null;
  const activeGroup =
    data?.groups.find((g) => g.workspaces.some((w) => w.id === current.id)) ?? null;

  const switchTo = async (workspaceId: string) => {
    setCurrentId(workspaceId);
    await refreshAuth();
    if (isMobile) setOpenMobile(false);
  };

  const topbar = variant === "topbar";
  const crumb = variant === "crumb";

  const trigger = crumb ? (
    <button
      type="button"
      aria-label={`Workspace: ${current.name}. Switch workspace`}
      className="-ml-2 flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 text-left transition-colors hover:bg-accent"
    >
      <span className="hidden min-w-0 items-center gap-1.5 lg:flex">
        <span className="max-w-[160px] truncate text-sm text-muted-foreground">{current.name}</span>
        <ChevronRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground/60" />
        <span className="max-w-[220px] truncate text-sm font-medium">{page}</span>
      </span>
      <span className="flex min-w-0 flex-col leading-tight lg:hidden">
        <span className="truncate text-sm font-medium">{page}</span>
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[10px] text-muted-foreground">{current.name}</span>
          <WorkspaceIdChip
            humanId={current.humanId}
            className="hidden h-4 px-1 text-[9px] sm:inline-flex"
          />
        </span>
      </span>
      <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground/60" />
    </button>
  ) : topbar ? (
    <button
      type="button"
      aria-label={`Workspace: ${current.name}`}
      className="flex h-9 min-w-0 max-w-[190px] shrink-0 items-center gap-2 rounded-lg border bg-card px-2 shadow-soft transition-colors hover:bg-accent"
    >
      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-brand-gradient text-[10px] font-semibold text-primary-foreground">
        {initials(current.name)}
      </span>
      <span className="hidden min-w-0 flex-1 truncate text-left text-xs font-medium sm:block">
        {current.name}
      </span>
      <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground/60" />
    </button>
  ) : (
    <SidebarMenuButton size="lg" tooltip={current.name}>
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-gradient text-xs font-semibold text-primary-foreground">
        {initials(current.name)}
      </span>
      <span className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-sidebar-foreground">
            {current.name}
          </span>
          {activeRow?.readOnly ? (
            <ExpiredChip />
          ) : activeRow ? (
            <PlanChip plan={activeRow.plan} label={activeRow.planLabel} />
          ) : null}
        </span>
        <span className="truncate text-[11px] text-muted-foreground">
          {activeGroup ? activeGroup.name : (formatHandle(current.igHandle) ?? current.handle)}
        </span>
      </span>
      <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground/60 group-data-[collapsible=icon]:hidden" />
    </SidebarMenuButton>
  );

  const panel = (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align={topbar ? "end" : "start"}
        side={topbar || crumb || mobile ? "bottom" : "right"}
        sideOffset={6}
        className={cn(
          "flex w-[340px] flex-col overflow-hidden p-0",
          // On phones the popover spans the viewport rather than floating in a corner, which is the
          // bottom-sheet shape the rest of this flow uses.
          "max-sm:w-[calc(100vw-2rem)]",
        )}
      >
        {data ? (
          <SwitcherContent
            data={data}
            currentWorkspaceId={current.id}
            onSelectWorkspace={(id) => void switchTo(id)}
            onAddWorkspace={() => {
              setOpen(false);
              setAddOpen(true);
            }}
            onAddToGroup={(group) => {
              setOpen(false);
              setGroupTarget(group);
            }}
            onRename={(target) => {
              setOpen(false);
              setRenameTarget(target);
            }}
            onClose={() => setOpen(false)}
          />
        ) : (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            {switcherQuery.isError ? "Could not load workspaces" : "Loading workspaces…"}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );

  return (
    <>
      {topbar || crumb ? (
        panel
      ) : (
        // Neither header variant is a sidebar: `SidebarMenu`/`SidebarMenuItem` carry list semantics
        // and width rules a header control must not inherit.
        <SidebarMenu>
          <SidebarMenuItem>{panel}</SidebarMenuItem>
        </SidebarMenu>
      )}

      <AddWorkspaceDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        freeSlotAvailable={data?.freeSlotAvailable ?? false}
        freeWorkspaceName={data?.freeWorkspace?.name ?? null}
        prefillFromWorkspaceId={current.id || null}
        onCreated={(id) => void switchTo(id)}
      />

      <AddToGroupDialog
        group={groupTarget}
        open={Boolean(groupTarget)}
        onOpenChange={(next) => !next && setGroupTarget(null)}
        onCreated={(id) => void switchTo(id)}
      />

      <RenameDialog
        target={renameTarget}
        open={Boolean(renameTarget)}
        onOpenChange={(next) => !next && setRenameTarget(null)}
      />
    </>
  );
}
