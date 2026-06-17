import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronsUpDown, Check, Plus } from "lucide-react";
import { toast } from "sonner";
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
import { createWorkspace } from "@/lib/api/workspaces-api";
import { useApp, type PlanName, type WorkspaceStatus } from "@/state/app-context";

function workspaceInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
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

/** Workspace switcher — lives in the sidebar footer. */
export function WorkspaceSwitcher() {
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

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" tooltip={current.name}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-gradient text-xs font-semibold text-primary-foreground">
                {workspaceInitials(current.name)}
              </span>
              <span className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-sidebar-foreground">
                    {current.name}
                  </span>
                  <PlanBadge plan={current.plan} className="shrink-0" />
                </span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {current.igHandle ? `@${current.igHandle.replace(/^@/, "")}` : current.handle}
                </span>
              </span>
              <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground/60 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Workspaces
            </DropdownMenuLabel>
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
                <span className="flex-1 truncate">{workspace.name}</span>
                <PlanBadge plan={workspace.plan} />
                {workspace.id === current.id ? (
                  <Check className="ml-auto size-4 text-primary" />
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
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
