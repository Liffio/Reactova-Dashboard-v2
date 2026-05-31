import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AuthMePayload, AuthUser, AuthorizationPayload } from "@/types/auth";

type AuthState = {
  accessToken: string | null;
  user: AuthUser | null;
  workspaceId: string | null;
  role: string | null;
  permissions: string[];
  modules: AuthorizationPayload["modules"];
  isPlatformSuperAdmin: boolean;
  isOnboarded: boolean;
  mfaEnabled: boolean;
  mfaEmailOtpEnabled: boolean;
  mfaSmsOtpEnabled: boolean;
  mfaOnboardingConsentAt: string | null;
};

const initialState: AuthState = {
  accessToken: localStorage.getItem("liffio_access_token"),
  user: null,
  workspaceId: null,
  role: null,
  permissions: [],
  modules: [],
  isPlatformSuperAdmin: false,
  isOnboarded: false,
  mfaEnabled: false,
  mfaEmailOtpEnabled: true,
  mfaSmsOtpEnabled: false,
  mfaOnboardingConsentAt: null
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuthSession: (
      state,
      action: PayloadAction<{
        accessToken: string;
      }>
    ) => {
      state.accessToken = action.payload.accessToken;
      localStorage.setItem("liffio_access_token", action.payload.accessToken);
    },
    setAuthMe: (state, action: PayloadAction<AuthMePayload>) => {
      state.user = action.payload.user;
      state.workspaceId = action.payload.workspaceId;
      state.role = action.payload.role;
      state.permissions = action.payload.permissions;
      state.modules = action.payload.modules;
      state.isPlatformSuperAdmin = action.payload.isPlatformSuperAdmin;
      state.isOnboarded = action.payload.isOnboarded;
      state.mfaEnabled = action.payload.mfaEnabled;
      state.mfaEmailOtpEnabled = action.payload.mfaEmailOtpEnabled;
      state.mfaSmsOtpEnabled = action.payload.mfaSmsOtpEnabled;
      state.mfaOnboardingConsentAt = action.payload.mfaOnboardingConsentAt;
    },
    setAuthorization: (state, action: PayloadAction<AuthorizationPayload | null>) => {
      state.workspaceId = action.payload?.workspaceId ?? null;
      state.role = action.payload?.role ?? null;
      state.permissions = action.payload?.permissions ?? [];
      state.modules = action.payload?.modules ?? [];
      state.isPlatformSuperAdmin = action.payload?.isPlatformSuperAdmin ?? false;
      state.isOnboarded = action.payload?.isOnboarded ?? false;
      state.mfaEnabled = action.payload?.mfaEnabled ?? state.mfaEnabled;
      state.mfaEmailOtpEnabled = action.payload?.mfaEmailOtpEnabled ?? state.mfaEmailOtpEnabled;
      state.mfaSmsOtpEnabled = action.payload?.mfaSmsOtpEnabled ?? state.mfaSmsOtpEnabled;
      state.mfaOnboardingConsentAt =
        action.payload?.mfaOnboardingConsentAt ?? state.mfaOnboardingConsentAt;
    },
    clearAuthSession: (state) => {
      state.accessToken = null;
      state.user = null;
      state.workspaceId = null;
      state.role = null;
      state.permissions = [];
      state.modules = [];
      state.isPlatformSuperAdmin = false;
      state.isOnboarded = false;
      state.mfaEnabled = false;
      state.mfaEmailOtpEnabled = true;
      state.mfaSmsOtpEnabled = false;
      state.mfaOnboardingConsentAt = null;
      localStorage.removeItem("liffio_access_token");
    }
  }
});

export const { setAuthSession, setAuthMe, setAuthorization, clearAuthSession } = authSlice.actions;
export default authSlice.reducer;
