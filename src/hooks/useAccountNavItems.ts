import { useMemo, type ComponentType } from "react";
import {
  Bell,
  Building2,
  CreditCard,
  Gift,
  KeyRound,
  LogOut,
  Mail,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { useModules } from "@/hooks/useModules";
import type { AuthorizationModule } from "@/types/auth";

export type AccountNavLink = {
  id: string;
  label: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
  section: "workspace" | "account" | "programs" | "admin";
};

const hasAction = (module: AuthorizationModule, action: string) => module.actions.includes(action);

export function useAccountNavItems() {
  const modules = useModules();
  const isPlatformSuperAdmin = useAppSelector((state) => state.auth.isPlatformSuperAdmin);

  return useMemo(() => {
    const links: AccountNavLink[] = [];
    const workspace = modules.find((m) => m.key === "workspace");

    if (workspace && hasAction(workspace, "read")) {
      links.push(
        { id: "settings", label: "Settings", to: "/settings", icon: Settings, section: "account" },
        { id: "billing", label: "Billing", to: "/billing", icon: CreditCard, section: "account" },
        {
          id: "notifications",
          label: "Notifications",
          to: "/settings?tab=Notifications",
          icon: Bell,
          section: "account",
        },
        { id: "team", label: "Team & invites", to: "/settings?tab=Team", icon: Users, section: "account" },
        { id: "api", label: "API credentials", to: "/settings?tab=API", icon: KeyRound, section: "account" },
        {
          id: "security",
          label: "Security",
          to: "/settings?tab=Security",
          icon: Shield,
          section: "account",
        }
      );
    }

    const affiliate = modules.find((m) => m.key === "affiliate");
    if (affiliate && hasAction(affiliate, "read")) {
      links.push({
        id: "affiliate",
        label: "Affiliate program",
        to: "/affiliate",
        icon: Gift,
        section: "programs",
      });
    }

    const agency = modules.find((m) => m.key === "agency");
    if (agency && hasAction(agency, "read")) {
      links.push({
        id: "agency",
        label: "Agency panel",
        to: "/agency",
        icon: Building2,
        section: "programs",
      });
    }

    if (isPlatformSuperAdmin) {
      links.push(
        {
          id: "rbac",
          label: "RBAC master",
          to: "/rbac-master",
          icon: Shield,
          section: "admin",
        },
        {
          id: "email-templates",
          label: "Email templates",
          to: "/admin/email-templates",
          icon: Mail,
          section: "admin",
        }
      );
    }

    const bySection = (section: AccountNavLink["section"]) =>
      links.filter((item) => item.section === section);

    return {
      all: links,
      account: bySection("account"),
      programs: bySection("programs"),
      admin: bySection("admin"),
      logout: { id: "logout", label: "Sign out", icon: LogOut } as const,
    };
  }, [modules, isPlatformSuperAdmin]);
}
