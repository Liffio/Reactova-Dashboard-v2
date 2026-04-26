import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AuthMePayload, AuthUser, AuthorizationPayload } from "@/types/auth";

type AuthState = {
  accessToken: string | null;
  user: AuthUser | null;
  workspaceId: string | null;
  role: string | null;
  permissions: string[];
  modules: AuthorizationPayload["modules"];
};

const initialState: AuthState = {
  accessToken: localStorage.getItem("reactova_access_token"),
  user: null,
  workspaceId: null,
  role: null,
  permissions: [],
  modules: []
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
      localStorage.setItem("reactova_access_token", action.payload.accessToken);
    },
    setAuthMe: (state, action: PayloadAction<AuthMePayload>) => {
      state.user = action.payload.user;
      state.workspaceId = action.payload.workspaceId;
      state.role = action.payload.role;
      state.permissions = action.payload.permissions;
      state.modules = action.payload.modules;
    },
    setAuthorization: (state, action: PayloadAction<AuthorizationPayload | null>) => {
      state.workspaceId = action.payload?.workspaceId ?? null;
      state.role = action.payload?.role ?? null;
      state.permissions = action.payload?.permissions ?? [];
      state.modules = action.payload?.modules ?? [];
    },
    clearAuthSession: (state) => {
      state.accessToken = null;
      state.user = null;
      state.workspaceId = null;
      state.role = null;
      state.permissions = [];
      state.modules = [];
      localStorage.removeItem("reactova_access_token");
    }
  }
});

export const { setAuthSession, setAuthMe, setAuthorization, clearAuthSession } = authSlice.actions;
export default authSlice.reducer;
