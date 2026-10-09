import type { ChatbotStep } from "@/lib/api/chatbot-api";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { cfgStr } from "./model";
import { TargetPicker, fieldCls, type ChatbotRef, type StepRef } from "./step-editors";

/** Instagram's cap on a button label, as on every other chatbot button. */
const MAX_LABEL = 20;
/** Mirrors the server's FOLLOW_GATE_MAX_REPROMPTS (types/chatbot.ts) — not worth sharing a
 *  constant across repos for one number already spelled out in this copy. */
const MAX_REPROMPTS = 3;

/**
 * "Ask to follow" (`chatbot:follow_gate`): the message goes out on a card with a Visit profile link
 * and a Following button, both with editable labels. A tap checks Instagram; following goes one
 * way, not following is asked again (up to three times) and then either loops or goes the other
 * way, depending on the loop switch. A normal step: it can sit anywhere in a flow, and either path
 * can lead on to more steps or end the chat.
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
  const loop = step.config.loopIfNotFollowing !== false;

  const path = (
    key: "followingStepId" | "notFollowingStepId",
    labelKey: "followingRowLabel" | "notFollowingRowLabel",
    defaultLabel: string,
    tone: string,
  ) => (
    <div className="flex min-w-0 items-center gap-1.5 rounded-[10px] border border-border bg-card py-1 pr-1 pl-1.5">
      <input
        className={cn(
          "w-[104px] shrink-0 rounded-md border-0 px-1.5 py-0.5 text-xs font-semibold outline-none focus:ring-1 focus:ring-primary/40",
          tone,
        )}
        value={cfgStr(step, labelKey) ?? defaultLabel}
        maxLength={40}
        aria-label={`${defaultLabel} row label`}
        onChange={(e) => onChange({ ...step.config, [labelKey]: e.target.value })}
      />
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
      <div className="flex flex-col gap-2">
        <span className="font-semibold text-muted-foreground">Buttons</span>
        {/* Two separate rows, not a pair of equal buttons — they do completely different things. */}
        <div className="flex items-center gap-2 rounded-[10px] border border-border bg-card px-2.5 py-1.5">
          <input
            className="min-w-0 flex-1 border-0 bg-transparent text-[13px] font-medium outline-none"
            value={cfgStr(step, "visitLabel") ?? ""}
            maxLength={MAX_LABEL}
            placeholder="Visit profile"
            aria-label="Visit profile button label"
            onChange={(e) => onChange({ ...step.config, visitLabel: e.target.value })}
          />
          <span className="shrink-0 text-muted-foreground">→ your Instagram profile</span>
        </div>
        <div className="flex items-center gap-2 rounded-[10px] border border-border bg-card px-2.5 py-1.5">
          <input
            className="min-w-0 flex-1 border-0 bg-transparent text-[13px] font-medium outline-none"
            value={cfgStr(step, "followingLabel") ?? ""}
            maxLength={MAX_LABEL}
            placeholder="Following ✅"
            aria-label="Following button label"
            onChange={(e) => onChange({ ...step.config, followingLabel: e.target.value })}
          />
          <span className="shrink-0 text-muted-foreground">→ checks the follow</span>
        </div>
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
        <span className="font-normal">Sent with the buttons again, up to {MAX_REPROMPTS} times.</span>
      </label>

      {/* Next to the reminder count, since it's the same decision: what happens once the count
      runs out (checklist decision, item 4). */}
      <div className="flex items-center gap-3 rounded-[10px] border border-border bg-card px-3 py-2.5">
        <div className="flex-1">
          <p className="font-semibold text-foreground">Keep reminding them to follow</p>
          <p className="font-normal text-muted-foreground">
            {loop
              ? `After ${MAX_REPROMPTS} reminders, keeps sending the same reminder instead of moving on.`
              : `After ${MAX_REPROMPTS} reminders with no follow, moves on to Not following.`}
          </p>
        </div>
        <Switch
          checked={loop}
          onCheckedChange={(next) => onChange({ ...step.config, loopIfNotFollowing: next })}
          aria-label="Keep reminding them to follow instead of moving on"
        />
      </div>

      <div className="flex flex-col gap-2">
        {path("followingStepId", "followingRowLabel", "Following", "bg-success/10 text-success")}
        {path("notFollowingStepId", "notFollowingRowLabel", "Not following", "bg-muted text-muted-foreground")}
        <span className="text-muted-foreground">
          {loop ? (
            <>
              <strong className="font-semibold text-foreground">Won't fire</strong> while the switch
              above is on — a non-follower keeps getting reminded instead of reaching this route.
            </>
          ) : (
            `Not following goes this way after ${MAX_REPROMPTS} reminders.`
          )}{" "}
          If Instagram won't say, they go the Following way: better to let one person through than
          stop someone who did follow.
        </span>
      </div>
    </div>
  );
}
