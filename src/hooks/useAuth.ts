import { useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { API_BASE, apiRequest, formatApiErrorBody } from "@/lib/api";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearStoredActiveWorkspaceId } from "@/lib/workspacePreference";
import { clearAuthSession, setAuthMe, setAuthSession, setAuthorization } from "@/store/authSlice";
import type { AuthMePayload, AuthorizationPayload } from "@/types/auth";

export type LoginSuccess = {
  accessToken: string;
  user: { id: string; email: string; name: string };
  authorization: AuthorizationPayload;
};

export type LoginApiResponse =
  | { mfaRequired: true; preAuthToken: string; methods: Array<"authenticator" | "email"> }
  | LoginSuccess;

function isMfaLoginChallenge(response: LoginApiResponse): response is {
  mfaRequired: true;
  preAuthToken: string;
  methods: Array<"authenticator" | "email">;
} {
  return "mfaRequired" in response && response.mfaRequired === true;
}

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
    mutationFn: async (input: { email: string; password: string }) => {
      const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      const data = (await res.json().catch(() => ({}))) as LoginApiResponse & { error?: unknown };
      if (!res.ok) {
        const raw = data.error;
        throw new Error(typeof raw === "string" ? raw : "Request failed");
      }
      return data;
    },
    onSuccess: async (payload) => {
      if (isMfaLoginChallenge(payload)) {
        return;
      }
      dispatch(setAuthSession({ accessToken: payload.accessToken }));
      const authMe = await apiRequest<AuthMePayload>("/api/v1/auth/me", {
        token: payload.accessToken
      });
      dispatch(setAuthMe(authMe));
    }
  });
}

export function useMfaLoginVerifyMutation() {
  const dispatch = useAppDispatch();

  return useMutation({
    mutationFn: async (input: { preAuthToken: string; code: string; method?: "authenticator" | "email" }) => {
      const res = await fetch(`${API_BASE}/api/v1/auth/mfa/login-verify`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      const data = (await res.json().catch(() => ({}))) as LoginSuccess & { error?: unknown };
      if (!res.ok) {
        const raw = data.error;
        throw new Error(typeof raw === "string" ? raw : "Request failed");
      }
      return data as LoginSuccess;
    },
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

export function useMfaLoginEmailSendMutation() {
  return useMutation({
    mutationFn: async (input: { preAuthToken: string }) => {
      const res = await fetch(`${API_BASE}/api/v1/auth/mfa/login-email/send`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        retryAfterSec?: number;
        expiresInSec?: number;
        error?: unknown;
      };
      if (!res.ok) {
        const raw = data.error;
        throw new Error(typeof raw === "string" ? raw : "Request failed");
      }
      return {
        retryAfterSec: data.retryAfterSec ?? 60,
        expiresInSec: data.expiresInSec ?? 300
      };
    }
  });
}

export function useRegisterMutation() {
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: (
      input: {
        email: string;
        name: string;
        password: string;
        country?: string;
        referralCode?: string;
        clientRef?: string;
        sessionRef?: string;
        localRef?: string;
        deviceFingerprint?: string;
      }
    ) =>
      apiRequest<LoginSuccess>("/api/v1/auth/register", {
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
      if (payload.authorization) {
        dispatch(
          setAuthorization({
            ...payload.authorization,
            emailVerified: authMe.emailVerified
          })
        );
      }
    }
  });
}

export function useEmailVerifyCodeMutation() {
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: async (code: string) => {
      const res = await fetch(`${API_BASE}/api/v1/auth/email-verification/verify-code`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Verification failed");
      return data;
    },
    onSuccess: async () => {
      const state = (await import("@/store")).store.getState();
      const token = state.auth.accessToken;
      if (token) {
        const authMe = await apiRequest<AuthMePayload>("/api/v1/auth/me", { token });
        dispatch(setAuthMe(authMe));
      }
    }
  });
}

export function useLogoutMutation() {
  const dispatch = useAppDispatch();
  const userId = useAppSelector((state) => state.auth.user?.id);
  return useMutation({
    mutationFn: () =>
      apiRequest<void>("/api/v1/auth/logout", {
        method: "POST"
      }),
    onSuccess: () => {
      clearStoredActiveWorkspaceId(userId);
      dispatch(clearAuthSession());
    }
  });
}

export function usePasswordForgotMutation() {
  return useMutation({
    mutationFn: async (input: { email: string }) => {
      const res = await fetch(`${API_BASE}/api/v1/auth/password/forgot`, {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        retryAfterSec?: number;
        expiresInSec?: number;
        error?: unknown;
      };
      if (!res.ok) {
        if (res.status === 429 && typeof data.retryAfterSec === "number") {
          throw new Error(`Please wait ${data.retryAfterSec}s before requesting another code`);
        }
        throw new Error(formatApiErrorBody(data));
      }
      return {
        retryAfterSec: data.retryAfterSec ?? 60,
        expiresInSec: data.expiresInSec ?? 300
      };
    }
  });
}

export function usePasswordResetMutation() {
  return useMutation({
    mutationFn: async (input: { email: string; code: string; newPassword: string }) => {
      const res = await fetch(`${API_BASE}/api/v1/auth/password/reset`, {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      if (res.status === 204) {
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: unknown };
      throw new Error(formatApiErrorBody(data));
    }
  });
}
