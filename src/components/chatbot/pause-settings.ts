import { useQuery } from "@tanstack/react-query";
import { chatbotApi, chatbotKeys } from "@/lib/api/chatbot-api";
import { isWorkspaceReady } from "@/lib/api/active-workspace";

/**
 * The real pause lengths, from chatbot_global_settings, for copy that explains them. Never a number
 * written into the text: the settings can change without a deploy.
 */
export function usePauseSettings(workspaceId: string) {
  return useQuery({
    queryKey: chatbotKeys.pauseSettings(workspaceId),
    queryFn: () => chatbotApi.pauseSettings(workspaceId),
    enabled: isWorkspaceReady(workspaceId),
    staleTime: 5 * 60_000,
  });
}

/** "24 hours", "2 hours", "90 minutes" → "1 hour 30 minutes". Matches the server's wording. */
export function describeMinutes(total: number): string {
  const minutes = Math.max(1, Math.round(total));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  if (!h) return plural(m, "minute");
  return m ? `${plural(h, "hour")} ${plural(m, "minute")}` : plural(h, "hour");
}
