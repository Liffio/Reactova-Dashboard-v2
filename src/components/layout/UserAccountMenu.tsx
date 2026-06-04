import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PlanBadge } from "@/components/PlanBadge";
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
    <DropdownMenuItem asChild className="cursor-pointer gap-2 rounded-lg">
      <Link to={item.to} onClick={onClose}>
        <Icon className="h-4 w-4 shrink-0 opacity-80" />
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

  const hasLinks = nav.all.length > 0;

  return (
    <>
      {hasLinks && (
        <>
          {nav.account.map((item) => (
            <AccountDropdownItem key={item.id} item={item} onClose={onClose} />
          ))}
          {nav.programs.length > 0 && (
            <>
              <DropdownMenuSeparator className="bg-border/60" />
              {nav.programs.map((item) => (
                <AccountDropdownItem key={item.id} item={item} onClose={onClose} />
              ))}
            </>
          )}
          {nav.admin.length > 0 && (
            <>
              <DropdownMenuSeparator className="bg-border/60" />
              {nav.admin.map((item) => (
                <AccountDropdownItem key={item.id} item={item} onClose={onClose} />
              ))}
            </>
          )}
          <DropdownMenuSeparator className="bg-border/60" />
        </>
      )}
      <DropdownMenuItem
        className="cursor-pointer gap-2 rounded-lg text-destructive focus:text-destructive focus:bg-destructive/10"
        disabled={logoutMutation.isPending}
        onClick={() => void handleLogout()}
      >
        <nav.logout.icon className="h-4 w-4 shrink-0" />
        <span>{logoutMutation.isPending ? "Signing out…" : nav.logout.label}</span>
      </DropdownMenuItem>
    </>
  );
}

type UserAccountMenuProps = {
  className?: string;
  size?: "sm" | "md";
  /** Avatar-only (header) or full profile row (sidebar footer) */
  variant?: "avatar" | "profile";
};

export function UserAccountMenu({
  className,
  size = "md",
  variant = "avatar",
}: UserAccountMenuProps) {
  const { user, current } = useApp();
  const [open, setOpen] = useState(false);
  const dim = size === "sm" ? "h-9 w-9 text-xs" : "h-10 w-10 text-sm";
  const isProfile = variant === "profile";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Open account menu"
          className={cn(
            "group flex items-center gap-2 rounded-xl transition-colors outline-none",
            "focus-visible:ring-2 focus-visible:ring-primary/40",
            isProfile && "w-full px-2 py-2 hover:bg-foreground/5",
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
          {isProfile && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium truncate">{user?.name ?? "Account"}</p>
                <p className="text-[11px] text-muted-foreground truncate">{user?.email ?? ""}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0 group-data-[state=open]:rotate-180 transition-transform" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={isProfile ? "start" : "end"}
        side={isProfile ? "top" : "bottom"}
        sideOffset={8}
        className="glass-surface account-dropdown-content z-[60] w-56 sm:w-60 p-1.5 border-border/50"
      >
        <DropdownMenuLabel className="px-2 py-2 font-normal">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="auth-ig-ring h-10 w-10 shrink-0 rounded-full p-[2px]">
              <span className="flex h-full w-full items-center justify-center rounded-full glass-inset text-primary font-semibold text-sm">
                {userInitials(user?.name)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{user?.name ?? "Unknown user"}</p>
              <p className="text-[11px] text-muted-foreground truncate">{user?.email ?? "—"}</p>
              <div className="mt-1.5 flex items-center gap-1.5 min-w-0">
                <span className="text-[11px] text-muted-foreground truncate">{current.name}</span>
                <PlanBadge plan={current.plan} />
              </div>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border/60" />
        <AccountMenuItems onClose={() => setOpen(false)} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** @deprecated Use UserAccountMenu — kept for existing imports */
export const UserAccountMenuButton = UserAccountMenu;
