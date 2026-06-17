import { useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  forgotPassword,
  getAuthMe,
  isMfaLoginChallenge,
  login,
  logout,
  mfaLoginEmailSend,
  mfaLoginVerify,
  register,
  resendEmailVerification,
  resetPassword,
  verifyEmailCode,
  type LoginSuccess,
  type RegisterInput,
} from "@/lib/api/auth-api";
import { authStore, useAuthState } from "@/lib/auth/auth-store";
import { clearStoredActiveWorkspaceId } from "@/lib/workspace-preference";

export function useAuth() {
  const user = useAuthState((s) => s.user);
  const workspaceId = useAuthState((s) => s.workspaceId);
  const role = useAuthState((s) => s.role);
  return useMemo(
    () => ({
      user,
      workspace: workspaceId ? { id: workspaceId, role } : null,
    }),
    [role, user, workspaceId]
  );
}

async function applyLoginSuccess(payload: LoginSuccess) {
  authStore.setSession({ accessToken: payload.accessToken });
  const authMe = await getAuthMe({ token: payload.accessToken });
  authStore.setAuthMe(authMe);
}

export function useLoginMutation() {
  return useMutation({
    mutationFn: login,
    onSuccess: async (payload) => {
      if (isMfaLoginChallenge(payload)) {
        return;
      }
      await applyLoginSuccess(payload);
    },
  });
}

export function useMfaLoginVerifyMutation() {
  return useMutation({
    mutationFn: mfaLoginVerify,
    onSuccess: async (payload) => {
      authStore.setSession({ accessToken: payload.accessToken });
      authStore.setAuthorization(payload.authorization);
      const authMe = await getAuthMe({ token: payload.accessToken });
      authStore.setAuthMe(authMe);
    },
  });
}

export function useMfaLoginEmailSendMutation() {
  return useMutation({
    mutationFn: async (input: { preAuthToken: string }) => {
      const data = await mfaLoginEmailSend(input.preAuthToken);
      return {
        retryAfterSec: data.retryAfterSec ?? 60,
        expiresInSec: data.expiresInSec ?? 300,
      };
    },
  });
}

export function useRegisterMutation() {
  return useMutation({
    mutationFn: (input: RegisterInput) => register(input),
    onSuccess: async (payload) => {
      authStore.setSession({ accessToken: payload.accessToken });
      const authMe = await getAuthMe({ token: payload.accessToken });
      authStore.setAuthMe(authMe);
      if (payload.authorization) {
        authStore.setAuthorization({
          ...payload.authorization,
          emailVerified: authMe.emailVerified,
        });
      }
    },
  });
}

export function useEmailVerifyCodeMutation() {
  return useMutation({
    mutationFn: verifyEmailCode,
    onSuccess: async () => {
      const token = authStore.getState().accessToken;
      if (token) {
        const authMe = await getAuthMe({ token });
        authStore.setAuthMe(authMe);
      }
    },
  });
}

export function useResendEmailVerificationMutation() {
  return useMutation({ mutationFn: resendEmailVerification });
}

export function useLogoutMutation() {
  const userId = useAuthState((s) => s.user?.id);
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      clearStoredActiveWorkspaceId(userId);
      authStore.clear();
    },
  });
}

export function usePasswordForgotMutation() {
  return useMutation({
    mutationFn: async (input: { email: string }) => {
      const data = await forgotPassword(input.email);
      return {
        retryAfterSec: data.retryAfterSec ?? 60,
        expiresInSec: data.expiresInSec ?? 300,
      };
    },
  });
}

export function usePasswordResetMutation() {
  return useMutation({ mutationFn: resetPassword });
}

export function usePermissions() {
  return useAuthState((s) => s.permissions);
}

export function useCan(moduleKey: string, action: string): boolean {
  const permissions = usePermissions();
  return permissions.includes(`${moduleKey}:${action}`);
}
