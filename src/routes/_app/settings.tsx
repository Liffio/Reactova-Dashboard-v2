import { useMemo } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";

import { ProtectedRoute } from "@/components/auth/guards";
import { usePermissions } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  SETTINGS_SCOPES,
  tabForPath,
  visibleTabs,
  type SettingsScope,
} from "@/features/settings/settingsTabs";

/**
 * `/settings` layout (plan/settings-revamp.md, spec §1): an Account / Workspace segmented control
 * over a top tab bar, both driven by `settingsTabs.ts` and filtered by the caller's permission set.
 * Each tab is its own child route, so links and the back button work.
 */
export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — Liffio" }] }),
  component: SettingsLayoutRoute,
});

function SettingsLayoutRoute() {
  return (
    <ProtectedRoute>
      <SettingsLayout />
    </ProtectedRoute>
  );
}

function SettingsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const permissionList = usePermissions();
  const permissions = useMemo(() => new Set(permissionList), [permissionList]);

  const active = tabForPath(pathname);
  const scope: SettingsScope = active?.scope ?? "account";
  const tabs = visibleTabs(scope, permissions);

  const switchScope = (next: SettingsScope) => {
    if (next === scope) return;
    const first = visibleTabs(next, permissions)[0];
    if (first) void navigate({ to: first.to });
  };

  return (
    <div className="flex w-full flex-col gap-6 px-4 pb-16 pt-7 sm:px-5 lg:px-8">
      <div className="flex flex-col gap-[18px]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <h1 className="m-0 font-display text-[26px] font-bold tracking-[-0.02em] text-foreground">
            Settings
          </h1>
          <div
            role="tablist"
            aria-label="Settings scope"
            className="inline-flex max-w-full gap-0.5 self-start rounded-[11px] bg-muted p-[3px] sm:self-auto"
          >
            {SETTINGS_SCOPES.filter((s) => visibleTabs(s.id, permissions).length > 0).map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={s.id === scope}
                onClick={() => switchScope(s.id)}
                className={cn(
                  "inline-flex h-8 max-w-[16rem] cursor-pointer items-center truncate rounded-[8px] border-0 px-4 font-sans text-[13px] font-semibold transition-colors",
                  s.id === scope
                    ? "bg-card text-foreground shadow-[0_1px_2px_rgba(22,10,8,0.08)]"
                    : "bg-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <nav
          aria-label="Settings sections"
          className="flex gap-7 overflow-x-auto border-b border-border"
        >
          {tabs.map((tab) => {
            const isActive = active?.id === tab.id;
            return (
              <Link
                key={tab.id}
                to={tab.to}
                className={cn(
                  "inline-flex h-[46px] shrink-0 items-center px-0.5 font-sans text-sm no-underline transition-colors",
                  isActive ? "font-semibold" : "font-medium",
                  tab.danger
                    ? "text-[#B0122B] hover:text-[#B0122B] dark:text-destructive"
                    : isActive
                      ? "text-foreground hover:text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  isActive &&
                    (tab.danger
                      ? "shadow-[inset_0_-2px_0_#B0122B]"
                      : "shadow-[inset_0_-2px_0_#F5184C]"),
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
