/**
 * Lightweight auth store (no Redux). SSR-safe: token hydration from
 * localStorage only happens in the browser; the server always renders the
 * signed-out state and guards resolve after mount.
 */
import { useSyncExternalStore } from "react";

export type AuthorizationModule = {
  key: string;
  name: string;
  actions: string[];
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  country?: string | null;
};

export type AuthMePayload = {
  user: AuthUser;
  workspaceId: string;
  role: string;
  modules: AuthorizationModule[];
  permissions: string[];
  isPlatformSuperAdmin: boolean;
  isOnboarded: boolean;
  emailVerified: boolean;
  mfaEnabled: boolean;
  mfaEmailOtpEnabled: boolean;
  mfaSmsOtpEnabled: boolean;
  mfaOnboardingConsentAt: string | null;
};

export type AuthorizationPayload = Omit<AuthMePayload, "user">;

export type AuthState = {
  accessToken: string | null;
  /** Epoch ms when the access token expires, or null if unknown (e.g. legacy session). */
  accessTokenExpiresAt: number | null;
  user: AuthUser | null;
  workspaceId: string | null;
  role: string | null;
  permissions: string[];
  modules: AuthorizationModule[];
  isPlatformSuperAdmin: boolean;
  isOnboarded: boolean;
  emailVerified: boolean;
  mfaEnabled: boolean;
  mfaEmailOtpEnabled: boolean;
  mfaSmsOtpEnabled: boolean;
  mfaOnboardingConsentAt: string | null;
};

const TOKEN_STORAGE_KEY = "liffio_access_token";
const TOKEN_EXPIRES_STORAGE_KEY = "liffio_access_token_expires_at";

const isBrowser = typeof window !== "undefined";

function readStoredExpiresAt(): number | null {
  if (!isBrowser) return null;
  const raw = localStorage.getItem(TOKEN_EXPIRES_STORAGE_KEY);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

const initialState: AuthState = {
  accessToken: isBrowser ? localStorage.getItem(TOKEN_STORAGE_KEY) : null,
  accessTokenExpiresAt: readStoredExpiresAt(),
  user: null,
  workspaceId: null,
  role: null,
  permissions: [],
  modules: [],
  isPlatformSuperAdmin: false,
  isOnboarded: false,
  emailVerified: false,
  mfaEnabled: false,
  mfaEmailOtpEnabled: true,
  mfaSmsOtpEnabled: false,
  mfaOnboardingConsentAt: null,
};

let state: AuthState = initialState;
const listeners = new Set<() => void>();

function setState(next: AuthState) {
  state = next;
  listeners.forEach((listener) => listener());
}

export const authStore = {
  getState: (): AuthState => state,

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  setSession({
    accessToken,
    accessTokenExpiresAt = null,
  }: {
    accessToken: string;
    accessTokenExpiresAt?: number | null;
  }) {
    if (isBrowser) {
      localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
      if (accessTokenExpiresAt) {
        localStorage.setItem(TOKEN_EXPIRES_STORAGE_KEY, String(accessTokenExpiresAt));
      } else {
        localStorage.removeItem(TOKEN_EXPIRES_STORAGE_KEY);
      }
    }
    setState({ ...state, accessToken, accessTokenExpiresAt });
  },

  setAuthMe(payload: AuthMePayload) {
    setState({
      ...state,
      user: payload.user,
      workspaceId: payload.workspaceId,
      role: payload.role,
      permissions: payload.permissions,
      modules: payload.modules,
      isPlatformSuperAdmin: payload.isPlatformSuperAdmin,
      isOnboarded: payload.isOnboarded,
      emailVerified: payload.emailVerified,
      mfaEnabled: payload.mfaEnabled,
      mfaEmailOtpEnabled: payload.mfaEmailOtpEnabled,
      mfaSmsOtpEnabled: payload.mfaSmsOtpEnabled,
      mfaOnboardingConsentAt: payload.mfaOnboardingConsentAt,
    });
  },

  setAuthorization(payload: AuthorizationPayload | null) {
    setState({
      ...state,
      workspaceId: payload?.workspaceId ?? null,
      role: payload?.role ?? null,
      permissions: payload?.permissions ?? [],
      modules: payload?.modules ?? [],
      isPlatformSuperAdmin: payload?.isPlatformSuperAdmin ?? false,
      isOnboarded: payload?.isOnboarded ?? false,
      // Preserve the current value when the payload omits emailVerified
      // (e.g. workspace switch) instead of bouncing the user to confirm-email.
      emailVerified: payload?.emailVerified ?? state.emailVerified,
      mfaEnabled: payload?.mfaEnabled ?? state.mfaEnabled,
      mfaEmailOtpEnabled: payload?.mfaEmailOtpEnabled ?? state.mfaEmailOtpEnabled,
      mfaSmsOtpEnabled: payload?.mfaSmsOtpEnabled ?? state.mfaSmsOtpEnabled,
      mfaOnboardingConsentAt: payload?.mfaOnboardingConsentAt ?? state.mfaOnboardingConsentAt,
    });
  },

  clear() {
    if (isBrowser) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(TOKEN_EXPIRES_STORAGE_KEY);
    }
    setState({ ...initialState, accessToken: null, accessTokenExpiresAt: null });
  },
};

const getServerSnapshot = (): AuthState => initialState;

export function useAuthState(): AuthState;
export function useAuthState<T>(selector: (state: AuthState) => T): T;
export function useAuthState<T>(selector?: (state: AuthState) => T) {
  return useSyncExternalStore(
    authStore.subscribe,
    selector ? () => selector(authStore.getState()) : authStore.getState,
    selector ? () => selector(getServerSnapshot()) : getServerSnapshot
  );
}
