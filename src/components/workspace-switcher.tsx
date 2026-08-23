import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronsUpDown, Check, ChevronRight, Plus, Instagram } from "lucide-react";
import { toast } from "@/lib/toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { usePageTitle } from "@/hooks/use-page-title";
import { WorkspaceIdChip } from "@/components/workspace-id-chip";
import { createWorkspace } from "@/lib/api/workspaces-api";
import { useApp, type PlanName, type Workspace, type WorkspaceStatus } from "@/state/app-context";
import { bareHandle, formatHandle } from "@/lib/format";

function workspaceInitials(name: string) {
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
 * connected at all, and the CDN URLs that do exist are signed and cached server-side for an hour,
 * so an expired one can reach the browser and 403. Straight from Instagram's CDN with no proxy,
 * matching how the analytics post thumbnails already load.
 *
 * `failedSrc` is compared against the current `src` rather than being a plain boolean, so switching
 * to a different workspace re-attempts its own image instead of inheriting the previous failure.
 */
function WorkspaceAvatar({
  name,
  profilePictureUrl,
  className,
}: {
  name: string;
  profilePictureUrl: string | null;
  /** The topbar pill needs a 24px avatar where the sidebar row wants 32px. */
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = profilePictureUrl?.trim() || null;

  if (!src || failedSrc === src) {
    return (
      <span
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-gradient text-xs font-semibold text-primary-foreground",
          className,
        )}
      >
        {workspaceInitials(name)}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className={cn("h-8 w-8 shrink-0 rounded-lg object-cover", className)}
      onError={() => setFailedSrc(src)}
    />
  );
}

const planBadgeStyles: Record<PlanName, string> = {
  Free: "border-border bg-muted text-muted-foreground",
  Starter: "border-accent bg-accent/50 text-accent-foreground",
  Pro: "border-primary/30 bg-primary/10 text-primary",
  Business: "border-success/30 bg-success/10 text-success",
  Agency: "border-warning/30 bg-warning/10 text-warning",
};

function PlanBadge({ plan, className }: { plan: PlanName; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("px-1.5 py-0 text-[10px] font-medium", planBadgeStyles[plan], className)}
    >
      {plan}
    </Badge>
  );
}

const statusDotStyles: Record<WorkspaceStatus, string> = {
  active: "bg-success",
  paused: "bg-warning",
  failed: "bg-destructive",
  disconnected: "bg-muted-foreground/50",
};

function StatusDot({ status }: { status: WorkspaceStatus }) {
  return <span className={cn("h-2 w-2 shrink-0 rounded-full", statusDotStyles[status])} />;
}

/**
 * The connected Instagram account for a workspace, as a secondary line in the switcher.
 * Returns null when the workspace has no display name of its own — in that case `name` already
 * *is* the handle (see `app-context`'s label fallback), so a second line would just repeat it.
 */
function instagramLine(workspace: Workspace): string | null {
  const handle = bareHandle(workspace.igHandle);
  if (!handle) return null;
  return workspace.name.trim().toLowerCase() === handle.toLowerCase() ? null : formatHandle(handle);
}

/** Workspace switcher — lives in the sidebar footer. */
/**
 * Workspace switcher.
 *
 * Two triggers, one menu. `variant="sidebar"` (default) is the full-width footer row;
 * `variant="crumb"` is the header's top-left breadcrumb, which already names the workspace and
 * so is the obvious thing to click to change it — a separate pill beside it was a second
 * control saying the same word. The menu itself — the workspace list, the plan badges, the
 * create dialog — is identical across variants, because a second copy is a second thing to
 * keep correct.
 */
export function WorkspaceSwitcher({
  variant = "sidebar",
}: {
  variant?: "sidebar" | "topbar" | "crumb";
} = {}) {
  const { current, workspaces, setCurrentId, refreshAuth } = useApp();
  const { isMobile, setOpenMobile } = useSidebar();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");

  const createWorkspaceMutation = useMutation({
    mutationFn: (input: { name?: string }) => createWorkspace(input),
    onSuccess: async (workspace) => {
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setCurrentId(workspace.id);
      await refreshAuth();
      setWorkspaceName("");
      setCreateOpen(false);
      toast.success("Workspace created");
      if (isMobile) setOpenMobile(false);
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const topbar = variant === "topbar";
  const crumb = variant === "crumb";
  const page = usePageTitle();

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {crumb ? (
          <button
            type="button"
            aria-label={`Workspace: ${current.name} — switch workspace`}
            className="-ml-2 flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 text-left transition-colors hover:bg-accent"
          >
            {/* Above lg the crumb reads `workspace › page` inline, below it stacks — the same two
                facts either way, which is why one trigger covers both. */}
            <span className="hidden min-w-0 items-center gap-1.5 lg:flex">
              <span className="max-w-[160px] truncate text-sm text-muted-foreground">
                {current.name}
              </span>
              <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
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
            <WorkspaceAvatar
              name={current.name}
              profilePictureUrl={current.profilePictureUrl}
              className="size-6"
            />
            <span className="hidden min-w-0 flex-1 truncate text-left text-xs font-medium sm:block">
              {current.name}
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground/60" />
          </button>
        ) : (
          <SidebarMenuButton size="lg" tooltip={current.name}>
            <WorkspaceAvatar name={current.name} profilePictureUrl={current.profilePictureUrl} />
            <span className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-sm font-semibold text-sidebar-foreground">
                  {current.name}
                </span>
                <PlanBadge plan={current.plan} className="shrink-0" />
              </span>
              <span className="truncate text-[11px] text-muted-foreground">
                {formatHandle(current.igHandle) ?? current.handle}
              </span>
            </span>
            <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground/60 group-data-[collapsible=icon]:hidden" />
          </SidebarMenuButton>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="min-w-56 rounded-lg"
        align={topbar ? "end" : "start"}
        side={topbar || crumb || isMobile ? "bottom" : "right"}
        sideOffset={4}
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground">Workspaces</DropdownMenuLabel>
        {workspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            className="cursor-pointer gap-2 p-2"
            onClick={() => {
              setCurrentId(workspace.id);
              if (isMobile) setOpenMobile(false);
            }}
          >
            <StatusDot status={workspace.status} />
            <span className="grid min-w-0 flex-1 leading-tight">
              <span className="truncate">{workspace.name}</span>
              {instagramLine(workspace) ? (
                <span className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
                  <Instagram className="size-3 shrink-0" />
                  <span className="truncate">{instagramLine(workspace)}</span>
                </span>
              ) : workspace.igHandle ? null : (
                <span className="truncate text-[11px] text-muted-foreground/70">
                  No Instagram connected
                </span>
              )}
            </span>
            <PlanBadge plan={workspace.plan} />
            {workspace.id === current.id ? (
              <Check className="size-4 shrink-0 text-primary" />
            ) : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer gap-2 p-2 text-primary"
          onSelect={(event) => {
            event.preventDefault();
            setCreateOpen((prev) => !prev);
          }}
        >
          <Plus className="size-4" />
          Add workspace
        </DropdownMenuItem>
        {createOpen ? (
          <div className="space-y-2 border-t p-3">
            <Input
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              placeholder="Workspace name (optional)"
              className="h-8"
              maxLength={80}
            />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Instagram is linked per workspace in Settings after creation.
            </p>
            <Button
              type="button"
              className="h-8 w-full"
              disabled={createWorkspaceMutation.isPending}
              onClick={() =>
                createWorkspaceMutation.mutate({ name: workspaceName.trim() || undefined })
              }
            >
              {createWorkspaceMutation.isPending ? "Creating…" : "Create workspace"}
            </Button>
          </div>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Neither header variant is a sidebar: `SidebarMenu`/`SidebarMenuItem` carry list semantics
  // and sidebar width rules that a header control must not inherit.
  if (topbar || crumb) return menu;

  return (
    <SidebarMenu>
      <SidebarMenuItem>{menu}</SidebarMenuItem>
    </SidebarMenu>
  );
}
