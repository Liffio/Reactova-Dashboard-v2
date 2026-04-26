import { useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearAuthSession, setAuthMe, setAuthSession, setAuthorization } from "@/store/authSlice";
import type { AuthMePayload, AuthorizationPayload } from "@/types/auth";

type LoginResponse = {
  accessToken: string;
};

type RegisterResponse = {
  accessToken: string;
  user: { id: string; email: string; name: string };
  authorization: AuthorizationPayload;
};

export function useAuth() {
  const user = useAppSelector((state) => state.auth.user);
  const workspaceId = useAppSelector((state) => state.auth.workspaceId);
  const role = useAppSelector((state) => state.auth.role);
  return useMemo(
    () => ({
      user,
      workspace: workspaceId ? { id: workspaceId, role } : null
    }),
    [role, user, workspaceId]
  );
}

export function useLoginMutation() {
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      apiRequest<LoginResponse>("/api/v1/auth/login", {
        method: "POST",
        body: input,
        token: null
      }),
    onSuccess: async (payload) => {
      dispatch(setAuthSession({ accessToken: payload.accessToken }));
      const authMe = await apiRequest<AuthMePayload>("/api/v1/auth/me", {
        token: payload.accessToken
      });
      dispatch(setAuthMe(authMe));
    }
  });
}

export function useRegisterMutation() {
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: (input: { email: string; name: string; password: string; country?: string }) =>
      apiRequest<RegisterResponse>("/api/v1/auth/register", {
        method: "POST",
        body: input,
        token: null
      }),
    onSuccess: async (payload) => {
      dispatch(setAuthSession({ accessToken: payload.accessToken }));
      dispatch(setAuthorization(payload.authorization));
      const authMe = await apiRequest<AuthMePayload>("/api/v1/auth/me", {
        token: payload.accessToken
      });
      dispatch(setAuthMe(authMe));
    }
  });
}

export function useLogoutMutation() {
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: () =>
      apiRequest<void>("/api/v1/auth/logout", {
        method: "POST"
      }),
    onSuccess: () => {
      dispatch(clearAuthSession());
    }
  });
}
