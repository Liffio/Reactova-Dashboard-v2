/**
 * Workspace/app context — ported from the previous client. Resolves the
 * active workspace, keeps `auth/me` in sync with it, and exposes the
 * workspace switcher API used by the sidebar.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAuthMe, patchActiveWorkspace } from "@/lib/api/auth-api";
import { listWorkspaces } from "@/lib/api/workspaces-api";
import { resolveInstagramConnected } from "@/lib/api/integrations-api";
import {
  clearStoredActiveWorkspaceId,
  persistActiveWorkspaceId,
  readStoredActiveWorkspaceId,
} from "@/lib/workspace-preference";
import {
  authStore,
  useAuthState,
  type AuthorizationModule,
} from "@/lib/auth/auth-store";

export type PlanName = "Free" | "Starter" | "Pro" | "Business" | "Agency";
export type WorkspaceStatus = "active" | "paused" | "failed" | "disconnected";

export interface Workspace {
  id: string;
  handle: string;
  igHandle: string | null;
  name: string;
  plan: PlanName;
  status: WorkspaceStatus;
  instagramConnected: boolean;
  nextBilling: string;
  dmsThisMonth: number;
  leadsThisMonth: number;
  clicksThisMonth: number;
  activeAutomations: number;
}

interface AppCtx {
  user: { name: string; email: string } | null;
  workspaces: Workspace[];
  workspacesLoading: boolean;
  current: Workspace;
  setCurrentId: (id: string) => void;
  accessToken: string | null;
  modules: AuthorizationModule[];
  refreshAuth: () => Promise<void>;
}

const Ctx = createContext<AppCtx | null>(null);

const defaultWorkspace: Workspace = {
  id: "default",
  handle: "@workspace",
  igHandle: null,
  name: "Workspace",
  plan: "Free",
  status: "active",
  instagramConnected: false,
  nextBilling: "—",
  dmsThisMonth: 0,
  leadsThisMonth: 0,
  clicksThisMonth: 0,
  activeAutomations: 0,
};

const mapPlan = (planKey?: string): PlanName => {
  switch (planKey) {
    case "STARTER":
      return "Starter";
    case "PRO":
      return "Pro";
    case "BUSINESS":
      return "Business";
    case "AGENCY":
      return "Agency";
    default:
      return "Free";
  }
};

const pickWorkspaceId = (
  workspaces: Workspace[],
  preferredId: string | null | undefined
): string => {
  if (preferredId && workspaces.some((workspace) => workspace.id === preferredId)) {
    return preferredId;
  }
  return workspaces[0]?.id ?? "";
};

export function AppProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [currentId, setCurrentIdState] = useState(() => readStoredActiveWorkspaceId() ?? "");
  const accessToken = useAuthState((s) => s.accessToken);
  const authUser = useAuthState((s) => s.user);
  const authWorkspaceId = useAuthState((s) => s.workspaceId);
  const modules = useAuthState((s) => s.modules);
  const persistInFlight = useRef<string | null>(null);

  const workspacesQuery = useQuery({
    queryKey: ["workspaces", accessToken],
    queryFn: () => listWorkspaces(),
    enabled: Boolean(accessToken),
  });

  const workspaces = useMemo<Workspace[]>(() => {
    if (!workspacesQuery.data) {
      return [];
    }
    return workspacesQuery.data.map((workspace) => {
      const instagramConnected = resolveInstagramConnected(workspace);
      const igHandle = instagramConnected ? workspace.igHandle?.trim() || null : null;
      const label = workspace.displayName?.trim() || (igHandle ?? "") || "Unlinked workspace";
      return {
        id: workspace.id,
        handle: label,
        igHandle,
        name: label,
        plan: mapPlan(workspace.plan),
        status:
          workspace.status === "PAUSED"
            ? ("paused" as const)
            : workspace.status === "PAYMENT_FAILED"
              ? ("failed" as const)
              : !instagramConnected
                ? ("disconnected" as const)
                : ("active" as const),
        instagramConnected,
        nextBilling: workspace.billingCycleEnd
          ? new Date(workspace.billingCycleEnd).toLocaleDateString()
          : "—",
        dmsThisMonth: workspace.dmsThisMonth ?? 0,
        leadsThisMonth: workspace.leadsThisMonth ?? 0,
        clicksThisMonth: workspace.clicksThisMonth ?? 0,
        activeAutomations: workspace.activeAutomations ?? 0,
      };
    });
  }, [workspacesQuery.data]);

  const storedWorkspaceId = readStoredActiveWorkspaceId(authUser?.id);
  const selectedWorkspaceId = pickWorkspaceId(
    workspaces,
    currentId || storedWorkspaceId || authWorkspaceId || undefined
  );

  useEffect(() => {
    if (!workspaces.length) {
      return;
    }
    if (selectedWorkspaceId && selectedWorkspaceId !== currentId) {
      setCurrentIdState(selectedWorkspaceId);
    }
  }, [workspaces.length, selectedWorkspaceId, currentId]);

  const authMeQuery = useQuery({
    queryKey: ["auth-me", accessToken, selectedWorkspaceId],
    queryFn: () => getAuthMe({ workspaceId: selectedWorkspaceId || undefined }),
    enabled: Boolean(accessToken) && Boolean(selectedWorkspaceId),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (authMeQuery.data) {
      authStore.setAuthMe(authMeQuery.data);
      if (authMeQuery.data.workspaceId) {
        persistActiveWorkspaceId(authMeQuery.data.workspaceId, authMeQuery.data.user.id);
        // Only sync currentId when the server-side workspace differs from what
        // we requested (e.g. user lost access and the server fell back).
        if (authMeQuery.data.workspaceId !== selectedWorkspaceId) {
          setCurrentIdState((prev) =>
            prev === authMeQuery.data.workspaceId ? prev : authMeQuery.data.workspaceId
          );
        }
      }
      return;
    }

    if (authMeQuery.error) {
      authStore.clear();
      clearStoredActiveWorkspaceId(authUser?.id);
    }
  }, [authMeQuery.data, authMeQuery.error, authUser?.id, selectedWorkspaceId]);

  const current = useMemo(
    () =>
      workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ??
      workspaces[0] ??
      defaultWorkspace,
    [selectedWorkspaceId, workspaces]
  );

  const persistActiveWorkspace = useCallback(
    async (workspaceId: string) => {
      if (!workspaceId || !accessToken) {
        return;
      }
      persistActiveWorkspaceId(workspaceId, authUser?.id);
      if (persistInFlight.current === workspaceId) {
        return;
      }
      persistInFlight.current = workspaceId;
      try {
        const payload = await patchActiveWorkspace(workspaceId);
        authStore.setAuthorization(payload);
      } catch (error) {
        console.error("[active-workspace]", error);
      } finally {
        if (persistInFlight.current === workspaceId) {
          persistInFlight.current = null;
        }
      }
    },
    [accessToken, authUser?.id]
  );

  const setCurrentId = useCallback(
    (id: string) => {
      if (!id.trim()) {
        return;
      }
      setCurrentIdState(id);
      persistActiveWorkspaceId(id, authUser?.id);
      void persistActiveWorkspace(id);
      void queryClient.invalidateQueries({ queryKey: ["auth-me"] });
    },
    [authUser?.id, persistActiveWorkspace, queryClient]
  );

  // Invalidate all auth-me entries rather than refetching the captured query —
  // a direct refetch right after setCurrentId() still points at the previous
  // workspace and would overwrite the new selection.
  const refreshAuth = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["auth-me"] });
  }, [queryClient]);

  const ctxValue = useMemo<AppCtx>(
    () => ({
      user: authUser ? { name: authUser.name, email: authUser.email } : null,
      workspaces,
      workspacesLoading: workspacesQuery.isLoading,
      current,
      setCurrentId,
      accessToken,
      modules,
      refreshAuth,
    }),
    [
      authUser,
      workspaces,
      workspacesQuery.isLoading,
      current,
      setCurrentId,
      accessToken,
      modules,
      refreshAuth,
    ]
  );

  return <Ctx.Provider value={ctxValue}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
