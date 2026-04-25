import { createContext, useContext, useState, ReactNode } from "react";
import { PlanName } from "@/components/PlanBadge";

export type WorkspaceStatus = "active" | "paused" | "failed" | "disconnected";

export interface Workspace {
  id: string;
  handle: string;
  name: string;
  plan: PlanName;
  status: WorkspaceStatus;
  nextBilling: string;
  dmsThisMonth: number;
  renewsInDays?: number;
  renewAmount?: number;
}

interface AppCtx {
  user: { name: string; email: string };
  workspaces: Workspace[];
  current: Workspace;
  setCurrentId: (id: string) => void;
}

const initialWorkspaces: Workspace[] = [
  { id: "w1", handle: "@reactova.studio", name: "Reactova Studio", plan: "Agency", status: "active", nextBilling: "May 14, 2026", dmsThisMonth: 12480, renewsInDays: 2, renewAmount: 299 },
  { id: "w2", handle: "@fitwithmaya", name: "Fit with Maya", plan: "Pro", status: "active", nextBilling: "May 22, 2026", dmsThisMonth: 3214 },
  { id: "w3", handle: "@codecaffeine", name: "Code & Caffeine", plan: "Starter", status: "paused", nextBilling: "May 30, 2026", dmsThisMonth: 540 },
  { id: "w4", handle: "@aurora.travels", name: "Aurora Travels", plan: "Free", status: "disconnected", nextBilling: "—", dmsThisMonth: 0 },
];

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [workspaces] = useState<Workspace[]>(initialWorkspaces);
  const [currentId, setCurrentId] = useState<string>("w1");
  const current = workspaces.find((w) => w.id === currentId) ?? workspaces[0];
  return (
    <Ctx.Provider value={{ user: { name: "Alex Morgan", email: "alex@reactova.com" }, workspaces, current, setCurrentId }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp must be used within AppProvider");
  return c;
}
