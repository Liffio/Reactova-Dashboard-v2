import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

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

type NotificationsResponse = {
  notifications: NotificationItem[];
  preferences: NotificationPreference[];
};

type InboxResponse = {
  notifications: NotificationItem[];
};

export function useInboxQuery() {
  return useQuery({
    queryKey: ["inbox"],
    queryFn: () => apiRequest<InboxResponse>("/api/v1/auth/inbox")
  });
}

export function useNotificationsQuery(workspaceId: string) {
  const enabled = Boolean(workspaceId) && workspaceId !== "default";
  return useQuery({
    queryKey: ["notifications", workspaceId],
    queryFn: () =>
      apiRequest<NotificationsResponse>("/api/v1/notifications", {
        workspaceId
      }),
    enabled
  });
}

export function useMarkInboxReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) =>
      apiRequest<void>("/api/v1/auth/inbox/mark-read", {
        method: "POST",
        body: { notificationId }
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["inbox"] });
    }
  });
}

export function useMarkAllInboxReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<void>("/api/v1/auth/inbox/mark-all-read", {
        method: "POST"
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["inbox"] });
    }
  });
}

export function useMarkNotificationReadMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) =>
      apiRequest<void>("/api/v1/notifications/mark-read", {
        method: "POST",
        workspaceId,
        body: { notificationId }
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications", workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ["inbox"] });
    }
  });
}

export function useMarkAllNotificationsReadMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<void>("/api/v1/notifications/mark-all-read", {
        method: "POST",
        workspaceId
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications", workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ["inbox"] });
    }
  });
}

export function useUpdateNotificationPreferenceMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { type: NotificationType; isEnabled: boolean }) =>
      apiRequest<void>("/api/v1/notifications/preferences", {
        method: "PATCH",
        workspaceId,
        body: input
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications", workspaceId] });
    }
  });
}

export function isInviteNotification(item: NotificationItem): boolean {
  return item.metadata?.action === "accept_invite" && typeof item.metadata.inviteId === "string";
}

export function inviteIdFromNotification(item: NotificationItem): string | null {
  const inviteId = item.metadata?.inviteId;
  return typeof inviteId === "string" ? inviteId : null;
}
