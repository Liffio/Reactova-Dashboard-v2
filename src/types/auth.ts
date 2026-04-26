export type AuthorizationModule = {
  key: string;
  name: string;
  actions: string[];
};

export type AuthMePayload = {
  user: AuthUser;
  workspaceId: string;
  role: string;
  modules: AuthorizationModule[];
  permissions: string[];
};

export type AuthorizationPayload = Omit<AuthMePayload, "user">;

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  country?: string | null;
};
