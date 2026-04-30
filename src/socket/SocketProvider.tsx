import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { API_BASE } from "@/lib/api";
import { useAppSelector } from "@/store/hooks";
import { useApp } from "@/state/AppContext";
import type { NotificationItem } from "@/hooks/useNotifications";
import type { SocketClientEvents, SocketServerEvents } from "./types";

const canUseBrowserNotifications = () =>
  typeof window !== "undefined" && "Notification" in window;

const showBrowserNotification = (notification: NotificationItem) => {
  if (!canUseBrowserNotifications()) {
    return;
  }
  if (Notification.permission !== "granted") {
    return;
  }

  new Notification(notification.name, {
    body: notification.details,
    tag: notification.id
  });
};

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { current } = useApp();
  const token = useAppSelector((state) => state.auth.accessToken);
  const socketRef = useRef<Socket<SocketServerEvents, SocketClientEvents> | null>(null);
  const currentWorkspaceRef = useRef<string | null>(null);

  useEffect(() => {
    if (token && canUseBrowserNotifications() && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      currentWorkspaceRef.current = null;
      return;
    }

    if (!socketRef.current) {
      const socket = io(API_BASE, {
        transports: ["websocket", "polling"],
        auth: { token },
        autoConnect: true,
        reconnection: true
      });
      socket.on("connect", () => {
        const workspaceId = currentWorkspaceRef.current;
        if (workspaceId && workspaceId !== "default") {
          socket.emit("workspace:join", workspaceId);
        }
      });
      socket.on("socket:error", (payload) => {
        toast.error(payload.message);
      });
      socket.on("notification:new", (payload) => {
        queryClient.setQueryData(
          ["notifications", payload.workspaceId],
          (existing: { notifications: NotificationItem[]; preferences: unknown[] } | undefined) => {
            if (!existing) {
              return existing;
            }
            const hasExisting = existing.notifications.some(
              (notification) => notification.id === payload.id
            );
            if (hasExisting) {
              return existing;
            }
            return {
              ...existing,
              notifications: [payload, ...existing.notifications]
            };
          }
        );
        toast(payload.name, { description: payload.details });
        showBrowserNotification(payload);
      });
      socketRef.current = socket;
    } else if (!socketRef.current.connected) {
      socketRef.current.auth = { token };
      socketRef.current.connect();
    }

    return () => undefined;
  }, [token, queryClient]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !current.id || current.id === "default") {
      return;
    }
    const previousWorkspace = currentWorkspaceRef.current;
    if (previousWorkspace && previousWorkspace !== current.id) {
      socket.emit("workspace:leave", previousWorkspace);
    }
    currentWorkspaceRef.current = current.id;
    socket.emit("workspace:join", current.id);
  }, [current.id]);

  return <>{children}</>;
}
