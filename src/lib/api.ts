import { store } from "@/store";

export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

type ApiRequestConfig = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  workspaceId?: string;
  token?: string | null;
};

export async function apiRequest<T>(path: string, config: ApiRequestConfig = {}): Promise<T> {
  const state = store.getState();
  const token = config.token ?? state.auth.accessToken;

  const res = await fetch(`${API_BASE}${path}`, {
    method: config.method ?? "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(config.workspaceId ? { "x-workspace-id": config.workspaceId } : {})
    },
    ...(config.body ? { body: JSON.stringify(config.body) } : {})
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error ?? "Request failed");
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}
