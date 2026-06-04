import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, X } from "lucide-react";
import { SheetClose } from "@/components/ui/sheet";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PlanBadge } from "@/components/PlanBadge";
import { useApp } from "@/state/AppContext";
import { useAccountNavItems } from "@/hooks/useAccountNavItems";
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

function AccountMenuLink({
  to,
  label,
  icon: Icon,
  onNavigate,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onNavigate: () => void;
}) {
  const location = useLocation();
  const href = `${location.pathname}${location.search}`;
  const isActive = href === to || (to === "/settings" && href === "/settings");

  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={cn("account-menu-link", isActive && "account-menu-link-active")}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-80" />
      <span className="flex-1">{label}</span>
      <ChevronRight className="h-4 w-4 opacity-40" />
    </Link>
  );
}

function AccountMenuSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="account-menu-section-label">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

type UserAccountSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: ReactNode;
};

export function UserAccountSheet({ open, onOpenChange, trigger }: UserAccountSheetProps) {
  const { user, current } = useApp();
  const nav = useAccountNavItems();
  const logoutMutation = useLogoutMutation();
  const navigate = useNavigate();
  const close = () => onOpenChange(false);

  const handleLogout = async () => {
    close();
    await logoutMutation.mutateAsync();
    navigate("/login");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger}
      <SheetContent
        side="right"
        className="glass-surface border-border/50 w-full sm:max-w-sm p-0 flex flex-col gap-0 overflow-hidden"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Account menu</SheetTitle>
          <SheetDescription>Profile, settings, and sign out</SheetDescription>
        </SheetHeader>

        <div className="account-sheet-profile relative px-5 pt-6 pb-5 border-b border-border/50">
          <SheetClose
            type="button"
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </SheetClose>
          <div className="flex items-center gap-3 pr-8">
            <div className="auth-ig-ring h-14 w-14 shrink-0 rounded-full p-[2px]">
              <span className="flex h-full w-full items-center justify-center rounded-full glass-inset text-primary font-semibold text-base">
                {userInitials(user?.name)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-base truncate">{user?.name ?? "Unknown user"}</p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{user?.email ?? "—"}</p>
              <div className="mt-2 flex items-center gap-2 min-w-0">
                <span className="text-xs text-muted-foreground truncate">{current.name}</span>
                <PlanBadge plan={current.plan} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-thin">
          {nav.account.length > 0 && (
            <AccountMenuSection title="Workspace">
              {nav.account.map((item) => (
                <AccountMenuLink
                  key={item.id}
                  to={item.to}
                  label={item.label}
                  icon={item.icon}
                  onNavigate={close}
                />
              ))}
            </AccountMenuSection>
          )}

          {nav.programs.length > 0 && (
            <AccountMenuSection title="Programs">
              {nav.programs.map((item) => (
                <AccountMenuLink
                  key={item.id}
                  to={item.to}
                  label={item.label}
                  icon={item.icon}
                  onNavigate={close}
                />
              ))}
            </AccountMenuSection>
          )}

          {nav.admin.length > 0 && (
            <AccountMenuSection title="Platform admin">
              {nav.admin.map((item) => (
                <AccountMenuLink
                  key={item.id}
                  to={item.to}
                  label={item.label}
                  icon={item.icon}
                  onNavigate={close}
                />
              ))}
            </AccountMenuSection>
          )}
        </div>

        <div className="p-3 border-t border-border/50 safe-bottom">
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={logoutMutation.isPending}
            className="account-menu-link account-menu-link-danger w-full"
          >
            <nav.logout.icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">
              {logoutMutation.isPending ? "Signing out…" : nav.logout.label}
            </span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

type UserAccountTriggerProps = {
  className?: string;
  size?: "sm" | "md";
  showChevron?: boolean;
  onClick?: () => void;
};

export function UserAccountTrigger({
  className,
  size = "md",
  showChevron = false,
  onClick,
}: UserAccountTriggerProps) {
  const { user } = useApp();
  const dim = size === "sm" ? "h-9 w-9 text-xs" : "h-10 w-10 text-sm";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open account menu"
      className={cn(
        "group flex items-center gap-2 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        showChevron && "w-full px-2 py-2 hover:bg-foreground/5",
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
      {showChevron && (
        <>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium truncate">{user?.name ?? "Account"}</p>
            <p className="text-[11px] text-muted-foreground truncate">{user?.email ?? ""}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />
        </>
      )}
    </button>
  );
}

export function UserAccountMenuButton({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <UserAccountTrigger className={className} size={size} onClick={() => setOpen(true)} />
      <UserAccountSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
