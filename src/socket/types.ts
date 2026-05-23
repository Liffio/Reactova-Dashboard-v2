import type { NotificationItem } from "@/hooks/useNotifications";

export type SocketServerEvents = {
  "notification:new": (payload: NotificationItem) => void;
  "socket:error": (payload: { message: string }) => void;
  commission_earned: (payload: { amount: number; commissionId: string }) => void;
  commission_available: (payload: { amount: number; commissionId: string }) => void;
  balance_updated: (payload: Record<string, unknown>) => void;
  payout_paid: (payload: { payoutId: string; amount: number }) => void;
};

export type SocketClientEvents = {
  "workspace:join": (workspaceId: string) => void;
  "workspace:leave": (workspaceId: string) => void;
  join_affiliate: (affiliateProfileId: string) => void;
};
