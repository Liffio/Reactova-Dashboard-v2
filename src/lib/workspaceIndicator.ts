import type { StatusBadgeVariant } from "@/components/StatusBadge";

export function getWorkspaceIndicatorStatus(workspace: {
  status: "active" | "paused" | "failed" | "disconnected";
  instagramConnected: boolean;
}): StatusBadgeVariant {
  if (workspace.status === "failed") return "failed";
  if (workspace.status === "paused") return "paused";
  if (!workspace.instagramConnected) return "disconnected";
  return "active";
}
