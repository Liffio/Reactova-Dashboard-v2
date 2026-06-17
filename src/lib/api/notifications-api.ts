import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

export type NotificationType =
  | "WORKSPACE_INVITE_RECEIVED"
  | "DM_DELIVERY_FAILURE"
  | "BILLING_REMINDER"
  | "NEW_LEAD_CAPTURED"
  | "WEEKLY_PERFORMANCE_SUMMARY"
  | "AFFILIATE_COMMISSION_APPROVED"
  | "INSTAGRAM_DISCONNECTED"
  | "AUTOMATION_CREATED"
  | "AUTOMATION_ACTIVATED"
  | "AUTOMATION_PAUSED"
  | "AUTOMATION_DELETED"
  | "POST_PUBLISHED"
  | "POST_FAILED";

export type NotificationItem = {
  id: string;
  workspaceId: string;
  userId: string;
  type: NotificationType | string;
  name: string;
  origin: string;
  details: string;
  metadata: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
};

export type NotificationPreference = {
  type: NotificationType;
  label: string;
  isEnabled: boolean;
};

export type NotificationsResponse = {
  notifications: NotificationItem[];
  preferences: NotificationPreference[];
};

export function listNotifications(workspaceId: string) {
  return apiRequest<NotificationsResponse>(apiUri.notifications.list, { workspaceId });
}

export function markNotificationRead(workspaceId: string, notificationId: string) {
  return apiRequest<void>(apiUri.notifications.markRead, {
    method: "POST",
    workspaceId,
    body: { notificationId },
  });
}

export function markAllNotificationsRead(workspaceId: string) {
  return apiRequest<void>(apiUri.notifications.markAllRead, { method: "POST", workspaceId });
}

export function updateNotificationPreference(
  workspaceId: string,
  body: { type: NotificationType; isEnabled: boolean }
) {
  return apiRequest<void>(apiUri.notifications.preferences, {
    method: "PATCH",
    workspaceId,
    body,
  });
}

export function isInviteNotification(item: NotificationItem): boolean {
  return item.metadata?.action === "accept_invite" && typeof item.metadata.inviteId === "string";
}

export function inviteIdFromNotification(item: NotificationItem): string | null {
  const inviteId = item.metadata?.inviteId;
  return typeof inviteId === "string" ? inviteId : null;
}
