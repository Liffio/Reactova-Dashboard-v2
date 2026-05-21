import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { useQuery } from "@tanstack/react-query";
import { PlanName } from "@/components/PlanBadge";
import { apiRequest } from "@/lib/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearAuthSession, setAuthMe } from "@/store/authSlice";
import type { AuthMePayload } from "@/types/auth";
import { useWorkspacesQuery } from "@/hooks/useWorkspaces";
import { resolveInstagramConnected } from "@/lib/workspaceInstagram";

export type WorkspaceStatus = "active" | "paused" | "failed" | "disconnected";

export interface Workspace {
  id: string;
  handle: string;
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

export function AppProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const [currentId, setCurrentId] = useState<string>("");
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const authUser = useAppSelector((state) => state.auth.user);
  const authWorkspaceId = useAppSelector((state) => state.auth.workspaceId);
  const modules = useAppSelector((state) => state.auth.modules);

  const workspacesQuery = useWorkspacesQuery();
  const workspaces = useMemo<Workspace[]>(() => {
    if (!workspacesQuery.data) {
      return [];
    }
    return workspacesQuery.data.map((workspace) => {
      const instagramConnected = resolveInstagramConnected(workspace);
      return {
      id: workspace.id,
      handle: workspace.igHandle ?? "Unlinked workspace",
      name: workspace.igHandle ?? "Unlinked workspace",
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
      dmsThisMonth: workspace.dmsThisMonth,
      leadsThisMonth: workspace.leadsThisMonth,
      clicksThisMonth: workspace.clicksThisMonth,
      activeAutomations: workspace.activeAutomations
    };
    });
  }, [workspacesQuery.data]);

  const selectedWorkspaceId = currentId || authWorkspaceId || workspaces[0]?.id;

  const authMeQuery = useQuery({
    queryKey: ["auth-me", accessToken, currentId],
    queryFn: () =>
      apiRequest<AuthMePayload>("/api/v1/auth/me", {
        workspaceId: currentId || undefined
      }),
    enabled: Boolean(accessToken),
    staleTime: 60_000,
    refetchOnWindowFocus: false
  });

  useEffect(() => {
    if (authMeQuery.data) {
      dispatch(setAuthMe(authMeQuery.data));
      return;
    }

    if (authMeQuery.error) {
      dispatch(clearAuthSession());
    }
  }, [authMeQuery.data, authMeQuery.error, dispatch]);

  const current = useMemo(
    () =>
      workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ??
      workspaces[0] ??
      defaultWorkspace,
    [selectedWorkspaceId, workspaces]
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
    [
      authUser,
      workspaces,
      current,
      accessToken,
      modules,
      signIn,
      refreshAuth
    ]
  );

  return <Ctx.Provider value={ctxValue}>{children}</Ctx.Provider>;
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp must be used within AppProvider");
  return c;
}
