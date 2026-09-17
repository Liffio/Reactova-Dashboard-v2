import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

/** Mirrors the server's `Plan` enum. GROWTH is real — see the note in `app-context`. */
export type WorkspacePlanKey = "FREE" | "STARTER" | "GROWTH" | "PRO" | "BUSINESS" | "AGENCY";

export type SwitcherWorkspace = {
  id: string;
  name: string;
  humanId: string | null;
  igHandle: string | null;
  profilePictureUrl: string | null;
  plan: WorkspacePlanKey;
  /**
   * The display name for the plan, resolved SERVER-side.
   *
   * 🔴 Deliberately not derived from `plan` here. The client used to map the enum to a label itself
   * and had no `GROWTH` case, so every Growth workspace rendered a "Free" chip — a bug that
   * survived because the mapping lived somewhere nobody looked. Render this string; do not infer it.
   */
  planLabel: string;
  /** Paid window closed and not renewed. Reads still work; writes are refused by the server. */
  readOnly: boolean;
  /** ISO string. Null unless `readOnly`. */
  expiredAt: string | null;
  /** Drives whether rename / add are offered. The server re-checks regardless. */
  isOwner: boolean;
  /** 1-based position inside its group. Null for a standalone workspace. */
  slotNo: number | null;
};

export type SwitcherGroup = {
  id: string;
  name: string;
  kind: string;
  slotLimit: number;
  slotsUsed: number;
  plan: WorkspacePlanKey;
  planLabel: string;
  /** ISO string, or null when the group has expired. */
  renewsAt: string | null;
  readOnly: boolean;
  expiredAt: string | null;
  isOwner: boolean;
  workspaces: SwitcherWorkspace[];
};

export type SwitcherPayload = {
  /** Whether the user may still create their one free workspace. */
  freeSlotAvailable: boolean;
  /** The workspace currently using the free slot, so the refusal can name it. */
  freeWorkspace: { id: string; name: string } | null;
  /** Standalone workspaces only. Grouped ones live under their group. */
  workspaces: SwitcherWorkspace[];
  groups: SwitcherGroup[];
};

export function getSwitcher() {
  return apiRequest<SwitcherPayload>(apiUri.workspaces.switcher);
}

export function createWorkspaceInGroup(groupId: string, body: { name: string }) {
  return apiRequest<{
    id: string;
    name: string;
    slotNo: number;
    slotsUsed: number;
    slotLimit: number;
  }>(apiUri.workspaceGroups.createWorkspace(groupId), { method: "POST", body });
}

export function renameGroup(groupId: string, body: { name: string }) {
  return apiRequest<{ id: string; name: string }>(apiUri.workspaceGroups.rename(groupId), {
    method: "PATCH",
    body,
  });
}
