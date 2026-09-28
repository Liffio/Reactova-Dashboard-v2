import { useQuery } from "@tanstack/react-query";
import { UserRound } from "lucide-react";

import { chatbotApi, type ChatbotStep } from "@/lib/api/chatbot-api";
import { useApp } from "@/state/app-context";
import { cfgStr } from "./model";
import { fieldCls } from "./step-editors";
import { LockedRow } from "./upgrade";

/**
 * Handover routing (`chatbot:handover_routing`): who a Hand-to-a-person step goes to. The whole team
 * by default; one member when assigned. If that member later leaves, the server tells the team.
 */
export function HandoverAssignee({
  step,
  enabled,
  onChange,
}: {
  step: ChatbotStep;
  enabled: boolean;
  onChange: (config: Record<string, unknown>) => void;
}) {
  const { current } = useApp();
  const recipients = useQuery({
    queryKey: ["chatbot-alert-recipients", current.id],
    queryFn: () => chatbotApi.alertRecipients(current.id),
    staleTime: 5 * 60 * 1000,
    enabled,
  });

  if (!enabled) {
    return (
      <LockedRow
        capability="chatbot:handover_routing"
        feature="Assigning handovers"
        icon={<UserRound className="h-4 w-4" />}
        label="Assign to one person"
      />
    );
  }

  return (
    <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
      Hand over to
      <select
        className={fieldCls}
        value={cfgStr(step, "assigneeUserId") ?? ""}
        onChange={(e) => onChange({ ...step.config, assigneeUserId: e.target.value || null })}
      >
        <option value="">Everyone who can see chatbots</option>
        {(recipients.data ?? []).map((r) => (
          <option key={r.id} value={r.id}>
            {r.name ?? r.email}
          </option>
        ))}
      </select>
    </label>
  );
}
