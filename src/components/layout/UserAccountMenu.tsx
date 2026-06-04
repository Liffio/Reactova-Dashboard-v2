import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useApp } from "@/state/AppContext";
import { useAccountNavItems, type AccountNavLink } from "@/hooks/useAccountNavItems";
import { useLogoutMutation } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

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
    <DropdownMenuItem asChild className="account-dropdown-item cursor-pointer">
      <Link to={item.to} onClick={onClose} className="flex w-full items-center gap-2.5">
        <span className="account-dropdown-icon">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span>{item.label}</span>
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

  const sections = [
    { title: "Account", items: nav.primary },
    { title: "Workspace", items: nav.settings },
    { title: "Programs", items: nav.programs },
    { title: "Platform admin", items: nav.admin },
  ].filter((section) => section.items.length > 0);

  return (
    <div className="account-dropdown-body py-1">
      {sections.map((section, index) => (
        <div key={section.title}>
          {index > 0 && <DropdownMenuSeparator className="account-dropdown-separator" />}
          <p className="account-dropdown-section-label">{section.title}</p>
          {section.items.map((item) => (
            <AccountDropdownItem key={item.id} item={item} onClose={onClose} />
          ))}
        </div>
      ))}
      {sections.length > 0 && <DropdownMenuSeparator className="account-dropdown-separator" />}
      <DropdownMenuItem
        className="account-dropdown-item account-dropdown-item-danger cursor-pointer mx-1.5"
        disabled={logoutMutation.isPending}
        onClick={() => void handleLogout()}
      >
        <span className="account-dropdown-icon account-dropdown-icon-danger">
          <nav.logout.icon className="h-3.5 w-3.5" />
        </span>
        <span>{logoutMutation.isPending ? "Signing out…" : nav.logout.label}</span>
      </DropdownMenuItem>
    </div>
  );
}

type UserAccountMenuProps = {
  className?: string;
  size?: "sm" | "md";
  /** Wider hit area for sidebar footer */
  fullWidth?: boolean;
};

export function UserAccountMenu({
  className,
  size = "md",
  fullWidth = false,
}: UserAccountMenuProps) {
  const { user } = useApp();
  const [open, setOpen] = useState(false);
  const dim = size === "sm" ? "h-9 w-9 text-xs" : "h-10 w-10 text-sm";
  const displayName = user?.name?.trim() || "Account";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Open account menu"
          className={cn(
            "group flex items-center gap-2 rounded-xl transition-colors outline-none min-w-0",
            "focus-visible:ring-2 focus-visible:ring-primary/40",
            "hover:bg-foreground/5",
            fullWidth && "w-full px-2 py-2",
            className
          )}
        >
          <div className={cn("auth-ig-ring shrink-0 rounded-full p-[2px]", dim)}>
            <span
              className={cn(
                "flex h-full w-full items-center justify-center rounded-full glass-inset text-primary font-semibold",
                size === "sm" ? "text-xs" : "text-sm"
              )}
            >
              {userInitials(user?.name)}
            </span>
          </div>
          <span
            className={cn(
              "text-sm font-medium truncate text-foreground min-w-0",
              fullWidth ? "flex-1 text-left" : "max-w-[5.5rem] sm:max-w-[8rem]"
            )}
          >
            {displayName}
          </span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={fullWidth ? "start" : "end"}
        side={fullWidth ? "top" : "bottom"}
        sideOffset={8}
        className="account-dropdown-panel z-[60] w-52 p-0"
      >
        <AccountMenuItems onClose={() => setOpen(false)} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const UserAccountMenuButton = UserAccountMenu;
