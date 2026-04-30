import type { NotificationItem } from "@/hooks/useNotifications";

export type SocketServerEvents = {
  "notification:new": (payload: NotificationItem) => void;
  "socket:error": (payload: { message: string }) => void;
};

export type SocketClientEvents = {
  "workspace:join": (workspaceId: string) => void;
  "workspace:leave": (workspaceId: string) => void;
};
