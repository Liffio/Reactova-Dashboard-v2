import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export type NotificationType =
  | "DM_DELIVERY_FAILURE"
  | "BILLING_REMINDER"
  | "NEW_LEAD_CAPTURED"
  | "WEEKLY_PERFORMANCE_SUMMARY"
  | "AFFILIATE_COMMISSION_APPROVED"
  | "INSTAGRAM_DISCONNECTED";

export type NotificationItem = {
  id: string;
  workspaceId: string;
  userId: string;
  type: NotificationType;
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
