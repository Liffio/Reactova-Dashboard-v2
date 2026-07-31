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

export type AssistantConversationSummary = { id: string; title: string; updatedAt: string };
export type AssistantStoredMessage = {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
};

export function listConversations(workspaceId: string) {
  return apiRequest<{ conversations: AssistantConversationSummary[] }>(
    apiUri.assistant.conversations,
    { workspaceId },
  );
}

export function createConversation(workspaceId: string, title: string) {
  return apiRequest<{ id: string }>(apiUri.assistant.conversations, {
    method: "POST",
    workspaceId,
    body: { title },
  });
}

export function listConversationMessages(workspaceId: string, conversationId: string) {
  return apiRequest<{ messages: AssistantStoredMessage[] }>(
    apiUri.assistant.conversationMessages(conversationId),
    { workspaceId },
  );
}

export function appendConversationMessages(
  workspaceId: string,
  conversationId: string,
  messages: AssistantStoredMessage[],
) {
  return apiRequest<{ ok: boolean }>(apiUri.assistant.conversationMessages(conversationId), {
    method: "POST",
    workspaceId,
    body: { messages },
  });
}

export function deleteConversation(workspaceId: string, conversationId: string) {
  return apiRequest<{ ok: boolean }>(apiUri.assistant.conversation(conversationId), {
    method: "DELETE",
    workspaceId,
  });
}
