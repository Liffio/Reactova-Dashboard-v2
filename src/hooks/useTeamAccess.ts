import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useAppSelector } from "@/store/hooks";

export type TeamMember = {
  user: { id: string; email: string; name: string };
  role: { key: string; name: string };
  immutableSuperAdmin: boolean;
  permissions: string[];
  modules: Array<{ key: string; name: string; actions: string[] }>;
};

export type WorkspaceInvite = {
  id: string;
  email: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  acceptedUserId: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  accessConfig: {
    permissionKeys?: string[];
    policyKeys?: string[];
    moduleAccess?: Array<{ moduleKey: string; actions: string[] }>;
  };
  baseRole: { key: string; name: string };
  inviterUser: { id: string; email: string; name: string };
  createdAt: string;
};

export type TeamOptions = {
  roles: Array<{ key: string; name: string }>;
  permissions: Array<{ key: string; action: string; moduleKey: string; moduleName: string }>;
  policies: Array<{
    key: string;
    moduleKey: string;
    action: string;
    effect: "ALLOW" | "DENY";
    description: string | null;
  }>;
};

export type InvitePreview = {
  id: string;
  email: string;
  inviterName: string;
  workspaceName: string;
  roleName: string;
  expiresAt: string;
};

export type PendingInvite = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  inviterName: string;
  roleName: string;
  expiresAt: string;
  createdAt: string;
};

type InvitePayload = {
  email: string;
  roleKey: string;
  moduleAccess: Array<{ moduleKey: string; actions: string[] }>;
  permissionKeys: string[];
  policyKeys: string[];
  expiresInDays?: number;
};

type UpdateMemberPayload = {
  roleKey?: string;
  permissionKeys: string[];
  policyKeys: string[];
};

export function useTeamMembersQuery(workspaceId: string) {
  return useQuery({
    queryKey: ["team-members", workspaceId],
    queryFn: () => apiRequest<TeamMember[]>("/api/v1/team/members", { workspaceId }),
    enabled: Boolean(workspaceId)
  });
}

export function useTeamInvitesQuery(workspaceId: string) {
  return useQuery({
    queryKey: ["team-invites", workspaceId],
    queryFn: () => apiRequest<WorkspaceInvite[]>("/api/v1/team/invites", { workspaceId }),
    enabled: Boolean(workspaceId)
  });
}

export function useTeamOptionsQuery(workspaceId: string) {
  return useQuery({
    queryKey: ["team-options", workspaceId],
    queryFn: () => apiRequest<TeamOptions>("/api/v1/team/options", { workspaceId }),
    enabled: Boolean(workspaceId)
  });
}

export function useCreateInviteMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: InvitePayload) =>
      apiRequest<{ id: string; status: string; expiresAt: string }>("/api/v1/team/invites", {
        method: "POST",
        workspaceId,
        body: payload
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["team-members", workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ["team-invites", workspaceId] });
    }
  });
}

export function useRevokeInviteMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      apiRequest<void>(`/api/v1/team/invites/${inviteId}`, { method: "DELETE", workspaceId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["team-invites", workspaceId] });
    }
  });
}

export function useInvitePreviewQuery(token: string | null) {
  return useQuery({
    queryKey: ["invite-preview", token],
    queryFn: () => apiRequest<InvitePreview>(`/api/v1/auth/invites/preview?token=${encodeURIComponent(token!)}`),
    enabled: Boolean(token),
    retry: false
  });
}

export function usePendingInvitesQuery() {
  const isAuthenticated = useAppSelector((s) => Boolean(s.auth.accessToken));
  return useQuery({
    queryKey: ["pending-invites"],
    queryFn: () => apiRequest<PendingInvite[]>("/api/v1/auth/invites/mine"),
    enabled: isAuthenticated,
    staleTime: 60_000
  });
}

export function useAcceptInviteMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      apiRequest<void>("/api/v1/auth/invites/accept", { method: "POST", body: { token } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pending-invites"] });
    }
  });
}

export function useUpdateMemberMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; payload: UpdateMemberPayload }) =>
      apiRequest<void>(`/api/v1/team/members/${input.userId}`, {
        method: "PATCH",
        workspaceId,
        body: input.payload
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["team-members", workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ["team-invites", workspaceId] });
    }
  });
}

export function useRemoveMemberMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiRequest<void>(`/api/v1/team/members/${userId}`, {
        method: "DELETE",
        workspaceId
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["team-members", workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ["team-invites", workspaceId] });
    }
  });
}
