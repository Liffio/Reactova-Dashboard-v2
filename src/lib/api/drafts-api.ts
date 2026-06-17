import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

/**
 * Autosave drafts — DB-backed, per-user, per-workspace JSON documents.
 * `module` scopes a draft to a feature ("automation", "scheduler-post", …);
 * `draftKey` scopes it within the module ("new" for create flows, or an
 * entity id when editing).
 */

export type DraftModule = "automation" | "scheduler-post" | "biolink" | (string & {});

export type DraftDto<TPayload = Record<string, unknown>> = {
  id: string;
  module: string;
  draftKey: string;
  payload: TPayload;
  createdAt: string;
  updatedAt: string;
};

export function listDrafts(workspaceId: string, module?: DraftModule) {
  const qs = module ? `?module=${encodeURIComponent(module)}` : "";
  return apiRequest<{ drafts: DraftDto[] }>(`${apiUri.drafts.list}${qs}`, { workspaceId });
}

export async function getDraft<TPayload = Record<string, unknown>>(
  workspaceId: string,
  module: DraftModule,
  key: string
): Promise<DraftDto<TPayload> | null> {
  try {
    const result = await apiRequest<{ draft: DraftDto<TPayload> }>(
      apiUri.drafts.item(module, key),
      { workspaceId }
    );
    return result.draft;
  } catch {
    // 404 — no draft saved yet
    return null;
  }
}

export function saveDraft<TPayload extends Record<string, unknown>>(
  workspaceId: string,
  module: DraftModule,
  key: string,
  payload: TPayload
) {
  return apiRequest<{ draft: DraftDto<TPayload> }>(apiUri.drafts.item(module, key), {
    method: "PUT",
    workspaceId,
    body: { payload },
  });
}

export function deleteDraft(workspaceId: string, module: DraftModule, key: string) {
  return apiRequest<void>(apiUri.drafts.item(module, key), { method: "DELETE", workspaceId });
}
