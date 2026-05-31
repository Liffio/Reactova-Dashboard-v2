import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PlanName } from "@/components/PlanBadge";
import { apiRequest } from "@/lib/api";
import {
  clearStoredActiveWorkspaceId,
  persistActiveWorkspaceId,
  readStoredActiveWorkspaceId
} from "@/lib/workspacePreference";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearAuthSession, setAuthMe, setAuthorization } from "@/store/authSlice";
import type { AuthMePayload, AuthorizationPayload } from "@/types/auth";
import { useWorkspacesQuery } from "@/hooks/useWorkspaces";
import { resolveInstagramConnected } from "@/lib/workspaceInstagram";

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
  renewsInDays?: number;
  renewAmount?: number;
}

type AuthorizationModule = AuthMePayload["modules"][number];

interface AppCtx {
  user: { name: string; email: string } | null;
  workspaces: Workspace[];
  current: Workspace;
  setCurrentId: (id: string) => void;
  accessToken: string | null;
  modules: AuthorizationModule[];
  signIn: (_email: string, _password: string) => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const Ctx = createContext<AppCtx | null>(null);
const defaultWorkspace: Workspace = {
  id: "default",
  handle: "@workspace",
  name: "Workspace",
  plan: "Free",
  status: "active",
  instagramConnected: false,
  nextBilling: "—",
  dmsThisMonth: 0,
  leadsThisMonth: 0,
  clicksThisMonth: 0,
  activeAutomations: 0
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
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const [currentId, setCurrentIdState] = useState(() => readStoredActiveWorkspaceId() ?? "");
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const authUser = useAppSelector((state) => state.auth.user);
  const authWorkspaceId = useAppSelector((state) => state.auth.workspaceId);
  const modules = useAppSelector((state) => state.auth.modules);
  const persistInFlight = useRef<string | null>(null);

  const workspacesQuery = useWorkspacesQuery();
  const workspaces = useMemo<Workspace[]>(() => {
    if (!workspacesQuery.data) {
      return [];
    }
    return workspacesQuery.data.map((workspace) => {
      const instagramConnected = resolveInstagramConnected(workspace);
      const igHandle = instagramConnected ? workspace.igHandle?.trim() || null : null;
      const label =
        workspace.displayName?.trim() ||
        (igHandle ?? "") ||
        "Unlinked workspace";
      return {
        id: workspace.id,
        handle: label,
        igHandle,
        name: label,
        plan: mapPlan(workspace.plan),
        status:
          workspace.status === "PAUSED"
            ? "paused"
            : workspace.status === "PAYMENT_FAILED"
              ? "failed"
              : !instagramConnected
                ? "disconnected"
                : "active",
        instagramConnected,
        nextBilling: workspace.billingCycleEnd
          ? new Date(workspace.billingCycleEnd).toLocaleDateString()
          : "—",
        dmsThisMonth: workspace.dmsThisMonth ?? 0,
        leadsThisMonth: workspace.leadsThisMonth ?? 0,
        clicksThisMonth: workspace.clicksThisMonth ?? 0,
        activeAutomations: workspace.activeAutomations ?? 0
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
    queryFn: () =>
      apiRequest<AuthMePayload>("/api/v1/auth/me", {
        workspaceId: selectedWorkspaceId || undefined
      }),
    enabled: Boolean(accessToken) && Boolean(selectedWorkspaceId),
    staleTime: 60_000,
    refetchOnWindowFocus: false
  });

  useEffect(() => {
    if (authMeQuery.data) {
      dispatch(setAuthMe(authMeQuery.data));
      if (authMeQuery.data.workspaceId) {
        persistActiveWorkspaceId(authMeQuery.data.workspaceId, authMeQuery.data.user.id);
        setCurrentIdState((prev) =>
          prev === authMeQuery.data.workspaceId ? prev : authMeQuery.data.workspaceId
        );
      }
      return;
    }

    if (authMeQuery.error) {
      dispatch(clearAuthSession());
      clearStoredActiveWorkspaceId(authUser?.id);
    }
  }, [authMeQuery.data, authMeQuery.error, dispatch, authUser?.id]);

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
        const payload = await apiRequest<AuthorizationPayload & { workspaceId: string }>(
          "/api/v1/auth/active-workspace",
          {
            method: "PATCH",
            body: { workspaceId }
          }
        );
        dispatch(setAuthorization(payload));
      } catch (error) {
        console.error("[active-workspace]", error);
      } finally {
        if (persistInFlight.current === workspaceId) {
          persistInFlight.current = null;
        }
      }
    },
    [accessToken, authUser?.id, dispatch]
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

  const refreshAuth = useCallback(async () => {
    await authMeQuery.refetch();
  }, [authMeQuery]);

  const signIn = useCallback(async () => {
    return;
  }, []);

  const ctxValue = useMemo<AppCtx>(
    () => ({
      user: authUser ? { name: authUser.name, email: authUser.email } : null,
      workspaces,
      current,
      setCurrentId,
      accessToken,
      modules,
      signIn,
      refreshAuth
    }),
    [authUser, workspaces, current, setCurrentId, accessToken, modules, signIn, refreshAuth]
  );

  return <Ctx.Provider value={ctxValue}>{children}</Ctx.Provider>;
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp must be used within AppProvider");
  return c;
}
