import { io, type Socket } from "socket.io-client";
import { authStore } from "@/lib/auth/auth-store";
import { API_BASE } from "@/lib/api/http";

/**
 * Single shared Socket.io connection.
 *
 * The server authenticates the handshake token and puts the socket in `user:{userId}` itself —
 * the client never asks to join that room, which is what stops anyone subscribing to another
 * user's events. Workspace rooms are requested explicitly and re-checked server-side.
 */

export type AccessChangedPayload = {
  workspaceId: string | null;
  message: string;
  changedAt: string;
};

type ServerToClientEvents = {
  "socket:error": (payload: { message: string }) => void;
  "notification:new": (payload: Record<string, unknown>) => void;
  "token-balance-updated": (payload: Record<string, unknown>) => void;
  "access:changed": (payload: AccessChangedPayload) => void;
};

type ClientToServerEvents = {
  "workspace:join": (workspaceId: string) => void;
  "workspace:leave": (workspaceId: string) => void;
  "access:ack": () => void;
};

export type LiffioSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: LiffioSocket | null = null;
let connectedWithToken: string | null = null;

/**
 * Connect (or reuse) the shared socket. Reconnects when the token changes, because the handshake
 * carries the token — a stale one would keep a socket authenticated as the previous session.
 */
export function getSocket(): LiffioSocket | null {
  if (typeof window === "undefined") return null;

  const token = authStore.getState().accessToken;
  if (!token) {
    disconnectSocket();
    return null;
  }

  if (socket && connectedWithToken === token) return socket;
  if (socket) disconnectSocket();

  socket = io(API_BASE, {
    auth: { token },
    transports: ["websocket", "polling"],
    withCredentials: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });
  connectedWithToken = token;

  return socket;
}

export function disconnectSocket(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  connectedWithToken = null;
}
