import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { useApp } from "@/state/AppContext";
import { useAccountNavItems, type AccountNavLink } from "@/hooks/useAccountNavItems";
import { useLogoutMutation } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { ChevronsUpDown } from "lucide-react";

function userInitials(name: string | undefined) {
  return (name ?? "NA")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function AccountDropdownItem({
  item,
  onClose,
}: {
  item: AccountNavLink;
  onClose: () => void;
}) {
  const Icon = item.icon;
  return (
    <DropdownMenuItem asChild className="cursor-pointer">
      <Link to={item.to} onClick={onClose} className="flex w-full items-center">
        <Icon className="mr-2 h-4 w-4" />
        {item.label}
      </Link>
    </DropdownMenuItem>
  );
}

function AccountMenuItems({ onClose }: { onClose: () => void }) {
  const nav = useAccountNavItems();
  const logoutMutation = useLogoutMutation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    onClose();
    await logoutMutation.mutateAsync();
    navigate("/login");
  };

  const sections: { label: string; items: AccountNavLink[] }[] = [
    { label: "My account", items: nav.primary },
    { label: "Workspace", items: nav.settings },
    { label: "Programs", items: nav.programs },
    { label: "Platform admin", items: nav.admin },
  ].filter((section) => section.items.length > 0);

  return (
    <>
      {sections.map((section, index) => (
        <div key={section.label}>
          {index > 0 ? <DropdownMenuSeparator /> : null}
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
            {section.label}
          </DropdownMenuLabel>
          {section.items.map((item) => (
            <AccountDropdownItem key={item.id} item={item} onClose={onClose} />
          ))}
        </div>
      ))}
      {sections.length > 0 ? <DropdownMenuSeparator /> : null}
      <DropdownMenuItem
        className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
        disabled={logoutMutation.isPending}
        onClick={() => void handleLogout()}
      >
        <nav.logout.icon className="mr-2 h-4 w-4" />
        {logoutMutation.isPending ? "Signing out…" : nav.logout.label}
      </DropdownMenuItem>
    </>
  );
}

type UserAccountMenuProps = {
  className?: string;
  size?: "sm" | "md";
  /** @deprecated Use variant="sidebar" */
  fullWidth?: boolean;
  variant?: "header" | "sidebar";
};

export function UserAccountMenu({
  className,
  size = "md",
  fullWidth = false,
  variant = fullWidth ? "sidebar" : "header",
}: UserAccountMenuProps) {
  const { user } = useApp();
  const { isMobile, setOpenMobile } = useSidebar();
  const [open, setOpen] = useState(false);
  const dim = size === "sm" ? "h-8 w-8 text-[11px]" : "h-9 w-9 text-xs";
  const displayName = user?.name?.trim() || "Account";
  const email = user?.email?.trim();

  const closeMenu = () => {
    setOpen(false);
    if (isMobile) setOpenMobile(false);
  };

  if (variant === "sidebar") {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton size="lg" tooltip={displayName}>
                <span className="liffio-sidebar-avatar tabular-nums">{userInitials(user?.name)}</span>
                <span className="grid min-w-0 flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold text-sidebar-foreground">{displayName}</span>
                  {email ? (
                    <span className="truncate text-[11px] text-muted-foreground">{email}</span>
                  ) : null}
                </span>
                <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground/60" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
              side="top"
              align="end"
              sideOffset={4}
            >
              <AccountMenuItems onClose={closeMenu} />
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Open account menu"
          aria-expanded={open}
          className={cn(
            "group flex items-center gap-2 outline-none min-w-0 transition-colors",
            "focus-visible:ring-2 focus-visible:ring-ring",
            "hover:bg-muted/70",
            className
          )}
        >
         
          <span className="grid min-w-0 flex-1 text-left leading-tight">
            <span className="truncate text-sm font-semibold text-sidebar-foreground">{displayName}</span>
            {email ? (
              <span className="truncate text-[11px] text-muted-foreground">{email}</span>
            ) : null}
          </span>
          <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground/60" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="z-[60] w-56">
        <AccountMenuItems onClose={() => setOpen(false)} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const UserAccountMenuButton = UserAccountMenu;
