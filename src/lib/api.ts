import { store } from "@/store";

export const API_BASE = import.meta.env.VITE_API_URL || "https://2mcr6kvm-3001.inc1.devtunnels.ms";

type ApiRequestConfig = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  workspaceId?: string;
  token?: string | null;
};

type ApiUploadConfig = {
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
    const raw = payload.error;
    const message =
      typeof raw === "string" ? raw : raw != null ? JSON.stringify(raw) : "Request failed";
    throw new Error(message);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

/** Multipart upload (do not set Content-Type — browser sets boundary). */
export async function apiUploadRequest<T>(path: string, formData: FormData, config: ApiUploadConfig = {}): Promise<T> {
  const state = store.getState();
  const token = config.token ?? state.auth.accessToken;

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(config.workspaceId ? { "x-workspace-id": config.workspaceId } : {})
    },
    body: formData
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    const raw = payload.error;
    const message =
      typeof raw === "string" ? raw : raw != null ? JSON.stringify(raw) : "Upload failed";
    throw new Error(message);
  }
  return (await res.json()) as T;
}
