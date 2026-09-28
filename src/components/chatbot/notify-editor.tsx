import { useQuery } from "@tanstack/react-query";

import { chatbotApi, type ChatbotStep } from "@/lib/api/chatbot-api";
import { useApp } from "@/state/app-context";
import { cfgStr } from "./model";
import { TargetPicker, fieldCls, type ChatbotRef, type StepRef } from "./step-editors";

/**
 * The Notify step (`chatbot:notify_step`): alert chosen team members in-app and by email, then carry
 * on at once. The bot keeps talking; this is not a handover.
 */
export function NotifyEditor({
  step,
  onChange,
  ...pick
}: {
  step: ChatbotStep;
  onChange: (config: Record<string, unknown>) => void;
  steps: StepRef[];
  chatbots: ChatbotRef[];
  onNewStep: () => string;
  onJump: (id: string) => void;
}) {
  const { current } = useApp();
  const recipients = useQuery({
    queryKey: ["chatbot-alert-recipients", current.id],
    queryFn: () => chatbotApi.alertRecipients(current.id),
    staleTime: 5 * 60 * 1000,
  });
  const chosen = new Set(
    Array.isArray(step.config.memberIds) ? (step.config.memberIds as string[]) : [],
  );
  const toggle = (id: string) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ ...step.config, memberIds: [...next] });
  };

  return (
    <div className="flex flex-col gap-3 text-xs">
      <label className="flex flex-col gap-1.5 font-semibold text-muted-foreground">
        Alert
        <textarea
          className={fieldCls}
          rows={2}
          maxLength={500}
          value={cfgStr(step, "message") ?? ""}
          aria-label="Alert message"
          placeholder="{{username|Someone}} asked for a quote"
          onChange={(e) => onChange({ ...step.config, message: e.target.value })}
        />
        <span className="font-normal">
          Shown in-app and emailed. Merge fields like {"{{username}}"} and {"{{answer.email}}"} are
          filled in.
        </span>
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="font-semibold text-muted-foreground">Who hears about it</span>
        {(recipients.data ?? []).map((r) => (
          <label key={r.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={chosen.has(r.id)} onChange={() => toggle(r.id)} />
            <span className="truncate">{r.name ?? r.email}</span>
            {r.name && <span className="truncate text-xs text-muted-foreground">{r.email}</span>}
          </label>
        ))}
        <span className="text-muted-foreground">
          {chosen.size
            ? `${chosen.size} chosen.`
            : "Nobody chosen, so everyone who can see chatbots is alerted."}
        </span>
      </div>

      <div className="flex items-center gap-1.5 rounded-[10px] border border-dashed border-border py-1 pr-1 pl-2.5 text-[13px] text-muted-foreground">
        <span className="flex-1">Then, straight away, go to</span>
        <TargetPicker
          value={{ kind: "step", id: cfgStr(step, "nextStepId") }}
          onPick={(t) => onChange({ ...step.config, nextStepId: t.kind === "step" ? t.id : null })}
          selfId={step.id}
          allowHuman={false}
          allowEnd
          {...pick}
        />
      </div>
    </div>
  );
}
