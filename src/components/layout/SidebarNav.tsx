import { type ComponentType } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export type SidebarNavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

function matchNavPath(to: string, pathname: string, search: string) {
  const [path, query] = to.split("?");
  if (pathname !== path) return false;
  if (!query) {
    if (path === "/settings") return true;
    const params = new URLSearchParams(search);
    return !params.has("tab");
  }
  const expected = new URLSearchParams(query);
  const actual = new URLSearchParams(search);
  for (const [key, value] of expected.entries()) {
    if (actual.get(key) !== value) return false;
  }
  return true;
}

function SidebarNavLink({ item, onNavigate }: { item: SidebarNavItem; onNavigate: () => void }) {
  const location = useLocation();
  const isActive = matchNavPath(item.to, location.pathname, location.search);
  const Icon = item.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
        <NavLink to={item.to} onClick={onNavigate} className="flex w-full items-center gap-2.5">
          <Icon className="size-[18px] shrink-0 opacity-70" />
          <span>{item.label}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

type SidebarNavGroupsProps = {
  productItems: SidebarNavItem[];
  adminItems: SidebarNavItem[];
  accountItems: SidebarNavItem[];
  onNavigate: () => void;
};

export function SidebarNavGroups({
  productItems,
  adminItems,
  accountItems,
  onNavigate,
}: SidebarNavGroupsProps) {
  return (
    <>
      {productItems.length > 0 ? (
        <SidebarGroup>
          <SidebarGroupLabel>Product</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {productItems.map((item) => (
                <SidebarNavLink key={item.to} item={item} onNavigate={onNavigate} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ) : null}

      {adminItems.length > 0 ? (
        <SidebarGroup>
          <SidebarGroupLabel>Admin</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item) => (
                <SidebarNavLink key={item.to} item={item} onNavigate={onNavigate} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ) : null}

      {accountItems.length > 0 ? (
        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {accountItems.map((item) => (
                <SidebarNavLink key={item.to} item={item} onNavigate={onNavigate} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ) : null}
    </>
  );
}
