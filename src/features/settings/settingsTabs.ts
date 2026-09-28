import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Bell,
  Building2,
  Code2,
  CreditCard,
  Instagram,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";

/**
 * The Settings tab registry (plan/settings-revamp.md, spec §1/§11). The layout maps over this and
 * filters by scope and by the permission set `/auth/me` returned — never an inline `<Tab>` list
 * or an `if (isOwner)` in a component. Adding a tab is one entry here plus its route file.
 *
 * `permission` is a `module:action` key; omitted = every signed-in user (account-level tabs).
 */
export type SettingsScope = "account" | "workspace";

/** The tab routes that exist under `src/routes/_app/settings.*.tsx` (typed for `<Link to>`). */
export type SettingsPath =
  | "/settings/profile"
  | "/settings/security"
  | "/settings/notifications"
  | "/settings/danger"
  | "/settings/general"
  | "/settings/instagram"
  | "/settings/team"
  | "/settings/billing"
  | "/settings/developer";

export type SettingsTab = {
  id: string;
  label: string;
  icon: LucideIcon;
  scope: SettingsScope;
  /** Route path under `/settings`. */
  to: SettingsPath;
  permission?: string;
  danger?: boolean;
};

export const SETTINGS_TABS: readonly SettingsTab[] = [
  { id: "profile", label: "Profile", icon: UserRound, scope: "account", to: "/settings/profile" },
  {
    id: "security",
    label: "Security",
    icon: ShieldCheck,
    scope: "account",
    to: "/settings/security",
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
    scope: "account",
    to: "/settings/notifications",
  },
  {
    id: "danger",
    label: "Danger zone",
    icon: AlertTriangle,
    scope: "account",
    to: "/settings/danger",
    danger: true,
  },
  {
    id: "general",
    label: "General",
    icon: Building2,
    scope: "workspace",
    to: "/settings/general",
    permission: "workspace:read",
  },
  {
    id: "instagram",
    label: "Instagram",
    icon: Instagram,
    scope: "workspace",
    to: "/settings/instagram",
    permission: "workspace:read",
  },
  {
    id: "team",
    label: "Team",
    icon: UsersRound,
    scope: "workspace",
    to: "/settings/team",
    permission: "workspace:read",
  },
  {
    id: "billing",
    label: "Billing",
    icon: CreditCard,
    scope: "workspace",
    to: "/settings/billing",
    permission: "workspace:read",
  },
  {
    id: "developer",
    label: "Developer",
    icon: Code2,
    scope: "workspace",
    to: "/settings/developer",
    permission: "workspace:read",
  },
];

export const SETTINGS_SCOPES: readonly { id: SettingsScope; label: string }[] = [
  { id: "account", label: "Account" },
  { id: "workspace", label: "Workspace" },
];

export function visibleTabs(scope: SettingsScope, permissions: ReadonlySet<string>): SettingsTab[] {
  return SETTINGS_TABS.filter(
    (t) => t.scope === scope && (!t.permission || permissions.has(t.permission)),
  );
}

export function tabForPath(pathname: string): SettingsTab | undefined {
  return SETTINGS_TABS.find((t) => pathname === t.to || pathname.startsWith(`${t.to}/`));
}
