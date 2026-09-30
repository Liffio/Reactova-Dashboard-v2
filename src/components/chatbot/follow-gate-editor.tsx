import type { ChatbotStep } from "@/lib/api/chatbot-api";
import { cn } from "@/lib/utils";
import { cfgStr } from "./model";
import { TargetPicker, fieldCls, type ChatbotRef, type StepRef } from "./step-editors";

/** Instagram's cap on a button label, as on every other chatbot button. */
const MAX_LABEL = 20;

/**
 * "Ask to follow" (`chatbot:follow_gate`): the message goes out on a card with a Visit profile link
 * and a "Following ✅" button. A tap checks Instagram; following goes one way, not following is
 * asked again (up to three times) and then goes the other. A normal step: it can sit anywhere in a
 * flow, and either path can lead on to more steps or end the chat.
 */
export function FollowGateEditor({
  step,
  onChange,
  steps,
  chatbots,
  onNewStep,
  onJump,
}: {
  step: ChatbotStep;
  onChange: (config: Record<string, unknown>) => void;
  steps: StepRef[];
  chatbots: ChatbotRef[];
  onNewStep: () => string;
  onJump: (id: string) => void;
}) {
  const path = (key: "followingStepId" | "notFollowingStepId", label: string, tone: string) => (
    <div className="flex min-w-0 items-center gap-1.5 rounded-[10px] border border-border bg-card py-1 pr-1 pl-2.5">
      <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap", tone)}>{label}</span>
      <span className="flex-1 text-[13px] text-muted-foreground">then</span>
      <TargetPicker
        value={{ kind: "step", id: cfgStr(step, key) }}
        onPick={(t) => onChange({ ...step.config, [key]: t.kind === "step" ? t.id : null })}
        steps={steps}
        selfId={step.id}
        chatbots={chatbots}
        allowHuman={false}
        allowEnd
        onNewStep={onNewStep}
        onJump={onJump}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-3 text-xs">
      <div className="flex flex-col gap-1.5">
        <span className="font-semibold text-muted-foreground">Buttons</span>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={cn(fieldCls, "w-40")}
            value={cfgStr(step, "visitLabel") ?? ""}
            maxLength={MAX_LABEL}
            placeholder="Visit profile"
            aria-label="Visit profile button label"
            onChange={(e) => onChange({ ...step.config, visitLabel: e.target.value })}
          />
          <span className="rounded-md border border-border bg-muted px-2.5 py-1 text-[13px]">Following ✅</span>
        </div>
        <span className="text-muted-foreground">
          The first opens your Instagram profile. The second checks whether they follow you.
        </span>
      </div>

      <label className="flex flex-col gap-1.5 font-semibold text-muted-foreground">
        If they haven't followed yet
        <textarea
          className="min-h-[64px] w-full resize-y rounded-xl border border-border bg-card px-3 py-2 text-sm leading-relaxed font-normal text-foreground outline-none focus:border-muted-foreground"
          rows={2}
          value={cfgStr(step, "retryMessage") ?? ""}
          aria-label="Message when they haven't followed yet"
          onChange={(e) => onChange({ ...step.config, retryMessage: e.target.value })}
        />
        <span className="font-normal">Sent with the buttons again, up to 3 times.</span>
      </label>

      <div className="flex flex-col gap-2">
        {path("followingStepId", "Following", "bg-success/10 text-success")}
        {path("notFollowingStepId", "Not following", "bg-muted text-muted-foreground")}
        <span className="text-muted-foreground">
          Not following goes this way after 3 reminders. If Instagram won't say, they go the
          Following way: better to let one person through than stop someone who did follow.
        </span>
      </div>
    </div>
  );
}
