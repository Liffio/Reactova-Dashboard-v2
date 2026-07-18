import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

export type QuickAskResponse = { matched: boolean; reply?: string };

/** Token-free fast path for the Lyra drawer: the server answers recognizable
 *  workspace questions ("how many leads this week?") straight from the database
 *  with zero LLM tokens. `matched: false` means the caller should fall through
 *  to the normal creator_copilot task. */
export function quickAsk(workspaceId: string, message: string) {
  return apiRequest<QuickAskResponse>(apiUri.assistant.quick, {
    method: "POST",
    workspaceId,
    body: { message },
  });
}
