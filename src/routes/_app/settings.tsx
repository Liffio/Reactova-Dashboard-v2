import { useMemo } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";

import { ProtectedRoute } from "@/components/auth/guards";
import { usePermissions } from "@/hooks/use-auth";
import { useApp } from "@/state/app-context";
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
  const { current } = useApp();
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
    <div className="flex flex-col">
      <div className="border-b bg-soft-gradient px-4 pt-6 sm:px-6 md:px-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Settings</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {scope === "account"
                ? "Your account, the same in every workspace."
                : `Workspace · ${current.name}`}
            </p>
          </div>
          <div
            role="tablist"
            aria-label="Settings scope"
            className="inline-flex self-start rounded-lg border bg-card p-1"
          >
            {SETTINGS_SCOPES.filter((s) => visibleTabs(s.id, permissions).length > 0).map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={s.id === scope}
                onClick={() => switchScope(s.id)}
                className={cn(
                  "max-w-[14rem] truncate rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  s.id === scope
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s.id === "workspace" ? `${s.label} · ${current.name}` : s.label}
              </button>
            ))}
          </div>
        </div>
        <nav aria-label="Settings sections" className="-mb-px mt-5 flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = active?.id === tab.id;
            return (
              <Link
                key={tab.id}
                to={tab.to}
                className={cn(
                  "flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? tab.danger
                      ? "border-destructive text-destructive"
                      : "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="w-full max-w-4xl p-4 sm:p-6 md:p-10">
        <Outlet />
      </div>
    </div>
  );
}
