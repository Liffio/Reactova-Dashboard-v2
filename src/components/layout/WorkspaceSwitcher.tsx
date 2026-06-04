import { useState } from "react";
import { ChevronsUpDown, Check, Plus } from "lucide-react";
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
import { PlanBadge } from "@/components/PlanBadge";
import { StatusDot } from "@/components/StatusBadge";
import { getWorkspaceIndicatorStatus } from "@/lib/workspaceIndicator";
import { resolveInstagramConnected } from "@/lib/workspaceInstagram";
import { useApp } from "@/state/AppContext";
import { useCreateWorkspaceMutation } from "@/hooks/useCreateWorkspace";
import { toast } from "@/components/ui/sonner";
import { LinkInstagramPromptDialog } from "@/components/workspace/LinkInstagramPromptDialog";

function workspaceInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function WorkspaceSwitcher() {
  const { current, workspaces, setCurrentId, refreshAuth } = useApp();
  const { isMobile, setOpenMobile } = useSidebar();
  const [createOpen, setCreateOpen] = useState(false);
  const [showLinkPrompt, setShowLinkPrompt] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");

  const createWorkspaceMutation = useCreateWorkspaceMutation(async (workspaceId) => {
    setCurrentId(workspaceId);
    await refreshAuth();
    setWorkspaceName("");
    setCreateOpen(false);
    toast.success("Workspace created");
    setShowLinkPrompt(true);
    if (isMobile) setOpenMobile(false);
  });

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton size="lg" tooltip={current.name}>
                <span className="liffio-sidebar-avatar">{workspaceInitials(current.name)}</span>
                <span className="grid min-w-0 flex-1 text-left leading-tight">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-sidebar-foreground">
                      {current.name}
                    </span>
                    <PlanBadge plan={current.plan} className="shrink-0 scale-[0.92] origin-left" />
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground">{current.handle}</span>
                </span>
                <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground/60" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
              align="start"
              side={isMobile ? "bottom" : "right"}
              sideOffset={4}
            >
              <DropdownMenuLabel className="text-xs text-muted-foreground">Workspaces</DropdownMenuLabel>
              {workspaces.map((w) => (
                <DropdownMenuItem
                  key={w.id}
                  className="gap-2 p-2 cursor-pointer"
                  onClick={() => {
                    setCurrentId(w.id);
                    if (isMobile) setOpenMobile(false);
                  }}
                >
                  <StatusDot
                    status={getWorkspaceIndicatorStatus({
                      status: w.status,
                      instagramConnected: resolveInstagramConnected(w),
                    })}
                  />
                  <span className="flex-1 truncate">{w.name}</span>
                  <PlanBadge plan={w.plan} />
                  {w.id === current.id ? <Check className="ml-auto size-4 text-primary" /> : null}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 p-2 cursor-pointer text-primary"
                onSelect={(e) => {
                  e.preventDefault();
                  setCreateOpen((prev) => !prev);
                }}
              >
                <Plus className="size-4" />
                Add workspace
              </DropdownMenuItem>
              {createOpen ? (
                <div className="border-t p-3 space-y-2">
                  <Input
                    value={workspaceName}
                    onChange={(event) => setWorkspaceName(event.target.value)}
                    placeholder="Workspace name (optional)"
                    className="h-8"
                    maxLength={80}
                  />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Instagram is linked per workspace in Settings after creation.
                  </p>
                  <Button
                    type="button"
                    className="h-8 w-full"
                    disabled={createWorkspaceMutation.isPending}
                    onClick={() =>
                      createWorkspaceMutation.mutate(
                        { name: workspaceName.trim() || undefined },
                        { onError: (error) => toast.error((error as Error).message) }
                      )
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

      <LinkInstagramPromptDialog open={showLinkPrompt} onOpenChange={setShowLinkPrompt} />
    </>
  );
}
