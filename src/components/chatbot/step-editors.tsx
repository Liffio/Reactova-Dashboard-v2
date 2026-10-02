import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Clock, Link2, Repeat, Tag, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MAX_BUTTON_LABEL,
  MAX_CONDITION_RULES,
  MAX_DELAY_SECONDS,
  MAX_FOLLOW_UP_BUTTONS,
  MAX_QUICK_REPLIES,
  type AnswerType,
  type ChatbotButton,
  type ChatbotFollowUp,
  type ChatbotStep,
  type Rule,
} from "@/lib/api/chatbot-api";
import { cn } from "@/lib/utils";
import { useModuleFeatures } from "@/hooks/use-features";
import { PlanChip, useUpgradeSheet } from "./upgrade";
import {
  DELAY_PRESETS,
  FOLLOW_UP_PRESETS,
  cfgStr,
  conditionRules,
  followUpCap,
  formatDelay,
  newButton,
  uid,
} from "./model";

/** Native controls, styled once: the builder is dense and these read closest to the prototype. */
export const fieldCls =
  "min-w-0 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[13px] font-medium shadow-[0_1px_1px_oklch(0.15_0.02_30/0.04)] outline-none focus:border-primary";

export interface StepRef {
  id: string;
  name: string;
  index: number;
}

export interface ChatbotRef {
  id: string;
  name: string;
}

/* ---------------------------------------------------------------- target picker */

export type Target =
  | { kind: "step"; id: string | null }
  | { kind: "human" }
  | { kind: "link" }
  | { kind: "chatbot"; id: string | null }
  | { kind: "skip" };

export function targetOfButton(b: ChatbotButton): Target {
  switch (b.action) {
    case "HANDOVER":
      return { kind: "human" };
    case "LINK":
      return { kind: "link" };
    case "START_CHATBOT":
      return { kind: "chatbot", id: b.targetChatbotId };
    case "SKIP":
      return { kind: "skip" };
    default:
      return { kind: "step", id: b.targetStepId };
  }
}

export function applyTarget(b: ChatbotButton, t: Target): ChatbotButton {
  switch (t.kind) {
    case "human":
      return { ...b, action: "HANDOVER", targetStepId: null, targetChatbotId: null, url: null };
    case "link":
      return {
        ...b,
        action: "LINK",
        targetStepId: null,
        targetChatbotId: null,
        url: b.url || "https://",
      };
    case "chatbot":
      return {
        ...b,
        action: "START_CHATBOT",
        targetStepId: null,
        targetChatbotId: t.id,
        url: null,
      };
    case "skip":
      return { ...b, action: "SKIP", targetStepId: null, targetChatbotId: null, url: null };
    default:
      return { ...b, action: "NEXT_STEP", targetStepId: t.id, targetChatbotId: null, url: null };
  }
}

export function targetLabel(
  t: Target,
  steps: StepRef[],
  chatbots: ChatbotRef[],
): { text: string; tone: "step" | "empty" | "human" | "link" } {
  if (t.kind === "human") return { text: "Hand to a person", tone: "human" };
  if (t.kind === "link") return { text: "Opens a link", tone: "link" };
  if (t.kind === "skip") return { text: "Skips the question", tone: "step" };
  if (t.kind === "chatbot") {
    const c = chatbots.find((x) => x.id === t.id);
    return c
      ? { text: `Starts ${c.name}`, tone: "step" }
      : { text: "Pick a chatbot", tone: "empty" };
  }
  const s = steps.find((x) => x.id === t.id);
  return s
    ? { text: `Goes to ${s.index + 1}. ${s.name}`, tone: "step" }
    : { text: "Pick next step", tone: "empty" };
}

const toneCls = {
  step: "bg-secondary hover:bg-accent hover:text-accent-foreground",
  empty: "border border-dashed border-border bg-transparent text-primary",
  human: "bg-warning-wash text-foreground",
  link: "bg-msg text-msg-foreground",
};

export function TargetPicker({
  value,
  onPick,
  steps,
  selfId,
  chatbots,
  allowLink,
  allowChatbot,
  allowHuman = true,
  allowEnd,
  onNewStep,
  onJump,
}: {
  value: Target;
  onPick: (t: Target) => void;
  steps: StepRef[];
  selfId: string;
  chatbots: ChatbotRef[];
  allowLink?: boolean;
  allowChatbot?: boolean;
  allowHuman?: boolean;
  /** Paths (condition branches, question "then") may simply end the chat. */
  allowEnd?: boolean;
  onNewStep: () => string;
  onJump: (stepId: string) => void;
}) {
  const label = targetLabel(value, steps, chatbots);
  const current = value.kind === "step" ? value.id : null;
  // Locked destinations stay in the menu with the plan that unlocks them.
  const features = useModuleFeatures("chatbot");
  const openUpgrade = useUpgradeSheet();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex min-w-0 max-w-[55%] items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs",
            toneCls[label.tone],
          )}
        >
          <span className="truncate">{label.text}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Next step</DropdownMenuLabel>
        {current && (
          <>
            <DropdownMenuItem onSelect={() => onJump(current)}>Jump to this step</DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <div className="max-h-64 overflow-auto">
          {steps
            .filter((s) => s.id !== selfId)
            .map((s) => (
              <DropdownMenuItem
                key={s.id}
                onSelect={() => onPick({ kind: "step", id: s.id })}
                className={cn(current === s.id && "font-semibold")}
              >
                {s.index + 1}. {s.name}
              </DropdownMenuItem>
            ))}
        </div>
        <DropdownMenuSeparator />
        {allowHuman && (
          <DropdownMenuItem onSelect={() => onPick({ kind: "human" })}>
            Hand to a person
          </DropdownMenuItem>
        )}
        {allowChatbot && chatbots.length > 0 && !features.chain_bots && (
          <DropdownMenuItem
            onSelect={() =>
              openUpgrade({ capability: "chatbot:chain_bots", feature: "Start another chatbot" })
            }
          >
            <span className="flex-1 opacity-60">Start another chatbot</span>
            <PlanChip capability="chatbot:chain_bots" />
          </DropdownMenuItem>
        )}
        {allowChatbot && chatbots.length > 0 && features.chain_bots && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Start another chatbot</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {chatbots.map((c) => (
                <DropdownMenuItem key={c.id} onSelect={() => onPick({ kind: "chatbot", id: c.id })}>
                  {c.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        <DropdownMenuItem onSelect={() => onPick({ kind: "step", id: onNewStep() })}>
          + New step
        </DropdownMenuItem>
        {allowLink && (
          <DropdownMenuItem
            onSelect={() =>
              features.link_buttons
                ? onPick({ kind: "link" })
                : openUpgrade({ capability: "chatbot:link_buttons", feature: "Link buttons" })
            }
          >
            <Link2 className="h-3.5 w-3.5" />
            <span className={cn("flex-1", !features.link_buttons && "opacity-60")}>
              Open a link instead
            </span>
            {!features.link_buttons && <PlanChip capability="chatbot:link_buttons" />}
          </DropdownMenuItem>
        )}
        {allowEnd && (
          <DropdownMenuItem onSelect={() => onPick({ kind: "step", id: null })}>
            End the chat here
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ---------------------------------------------------------------- buttons */

interface ButtonListProps {
  buttons: ChatbotButton[];
  onChange: (buttons: ChatbotButton[]) => void;
  max: number;
  steps: StepRef[];
  selfId: string;
  chatbots: ChatbotRef[];
  onNewStep: () => string;
  onJump: (id: string) => void;
  addLabel?: string;
  /** False on a Handover step: handing to a person again means nothing there. */
  allowHuman?: boolean;
  /**
   * Offers "+ Talk to a person": a button to the chatbot's Handover step, created if there is none.
   * Returns that step's id. Hidden once a button already goes there.
   */
  onAddHandover?: () => string;
  /** Ids of the chatbot's Handover steps, to tell whether a button already goes to one. */
  handoverStepIds?: string[];
}

/** The quick-add's label: what a person taps to ask for a human. */
const TALK_TO_PERSON_LABEL = "Talk to a person";

export function ButtonList({
  buttons,
  onChange,
  max,
  steps,
  selfId,
  chatbots,
  onNewStep,
  onJump,
  addLabel = "+ Add button",
  allowHuman = true,
  onAddHandover,
  handoverStepIds = [],
}: ButtonListProps) {
  const set = (i: number, b: ChatbotButton) => onChange(buttons.map((x, j) => (j === i ? b : x)));
  const links = buttons.filter((b) => b.action === "LINK").length;
  return (
    <div className="flex flex-col gap-1.5">
      {buttons.map((b, i) => (
        <div
          key={b.id}
          className={cn(
            "flex min-w-0 items-center gap-1.5 rounded-[10px] border border-border bg-card py-1 pr-1 pl-2.5",
            b.action === "LINK" && "flex-wrap",
          )}
        >
          <input
            className="min-w-0 flex-1 basis-2/5 border-0 bg-transparent py-1.5 text-[13px] font-medium outline-none"
            value={b.label}
            maxLength={MAX_BUTTON_LABEL}
            aria-label="Button text"
            onChange={(e) => set(i, { ...b, label: e.target.value })}
          />
          <TargetPicker
            value={targetOfButton(b)}
            onPick={(t) => {
              // Instagram allows at most 3 link buttons on one card.
              if (t.kind === "link" && b.action !== "LINK" && links >= 3) return;
              set(i, applyTarget(b, t));
            }}
            steps={steps}
            selfId={selfId}
            chatbots={chatbots}
            allowLink
            allowChatbot
            allowHuman={allowHuman}
            onNewStep={onNewStep}
            onJump={onJump}
          />
          <button
            type="button"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Remove button"
            onClick={() => onChange(buttons.filter((_, j) => j !== i))}
          >
            <X className="h-3.5 w-3.5" />
          </button>
          {b.action === "LINK" && (
            <input
              className="mb-1 w-full basis-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium outline-none focus:border-primary"
              value={b.url ?? ""}
              placeholder="https://yoursite.com/pricing"
              aria-label="Link address"
              onChange={(e) => set(i, { ...b, url: e.target.value })}
            />
          )}
        </div>
      ))}
      {buttons.length < max && (
        <div className="flex gap-1.5">
          <button
            type="button"
            className="flex-1 rounded-[10px] border border-dashed border-border p-2 text-[13px] text-muted-foreground hover:border-primary hover:text-primary"
            onClick={() => onChange([...buttons, newButton()])}
          >
            {addLabel}
          </button>
          {onAddHandover &&
            !buttons.some(
              (b) =>
                b.action === "NEXT_STEP" &&
                b.targetStepId &&
                handoverStepIds.includes(b.targetStepId),
            ) && (
              <button
                type="button"
                className="rounded-[10px] border border-dashed border-border px-3 py-2 text-[13px] text-muted-foreground hover:border-primary hover:text-primary"
                onClick={() =>
                  onChange([
                    ...buttons,
                    {
                      ...newButton("NEXT_STEP", TALK_TO_PERSON_LABEL),
                      targetStepId: onAddHandover(),
                    },
                  ])
                }
              >
                + {TALK_TO_PERSON_LABEL}
              </button>
            )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- settings rows */

const rowTone = {
  delay: { icon: "text-msg-foreground", open: "bg-msg/30" },
  tag: { icon: "text-accent-foreground", open: "bg-accent/25" },
  fu: { icon: "text-warning", open: "bg-warning-wash" },
};

/**
 * Collapsed by default, current value on the right ("2 sec", "None", "2 set") — opening is only
 * needed to change something (prototype `setRow`).
 */
export function SettingsRow({
  tone,
  icon,
  label,
  value,
  isSet,
  badge,
  children,
}: {
  tone: keyof typeof rowTone;
  icon: ReactNode;
  label: string;
  value: string;
  isSet: boolean;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card",
        open && cn("border-primary/30 shadow-card", rowTone[tone].open),
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left text-[13px] font-medium hover:bg-muted"
      >
        <ChevronRight
          className={cn("h-3 w-3 text-muted-foreground transition-transform", open && "rotate-90")}
        />
        <span className={rowTone[tone].icon}>{icon}</span>
        <span>{label}</span>
        {badge}
        <em
          className={cn(
            "ml-auto max-w-[50%] truncate text-xs not-italic text-muted-foreground",
            isSet && "font-semibold text-primary",
          )}
        >
          {value}
        </em>
      </button>
      {open && (
        <div className="flex flex-col gap-2 px-3 pt-0.5 pb-3.5 pl-9 text-xs text-muted-foreground max-sm:pl-3">
          {children}
        </div>
      )}
    </div>
  );
}

export const DelayIcon = <Clock className="h-3.5 w-3.5" />;
export const TagIcon = <Tag className="h-3.5 w-3.5" />;
export const RepeatIcon = <Repeat className="h-3.5 w-3.5" />;

/** Presets + custom number/unit, capped at 23h so a send can never fall outside Meta's window. */
export function DelayControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const preset = (DELAY_PRESETS as readonly number[]).includes(value);
  const [custom, setCustom] = useState(!preset);
  const unit =
    value >= 3600 && value % 3600 === 0 ? 3600 : value >= 60 && value % 60 === 0 ? 60 : 1;
  const [u, setU] = useState(unit);
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        <select
          className={fieldCls}
          aria-label="Delay"
          value={custom ? "custom" : String(value)}
          onChange={(e) => {
            if (e.target.value === "custom") {
              setCustom(true);
              if (!value) onChange(15);
            } else {
              setCustom(false);
              onChange(Number(e.target.value));
            }
          }}
        >
          {DELAY_PRESETS.map((v) => (
            <option key={v} value={v}>
              {formatDelay(v)}
            </option>
          ))}
          <option value="custom">Custom…</option>
        </select>
        {custom && (
          <>
            <input
              type="number"
              min={1}
              className={cn(fieldCls, "w-20")}
              aria-label="Delay amount"
              value={Math.max(1, Math.round(value / u))}
              onChange={(e) =>
                onChange(Math.min(MAX_DELAY_SECONDS, Math.max(1, Number(e.target.value) || 1) * u))
              }
            />
            <select
              className={fieldCls}
              aria-label="Unit"
              value={u}
              onChange={(e) => {
                const next = Number(e.target.value);
                setU(next);
                onChange(Math.min(MAX_DELAY_SECONDS, Math.max(1, Math.round(value / u)) * next));
              }}
            >
              <option value={1}>sec</option>
              <option value={60}>min</option>
              <option value={3600}>hr</option>
            </select>
          </>
        )}
      </div>
      <span>Shows a typing bubble first. Max 23 hours.</span>
    </>
  );
}

/* ---------------------------------------------------------------- follow-ups */

/** Only rendered when the workspace has `chatbot:follow_ups`; the step card shows a locked row otherwise. */
export function FollowUpEditor({
  step,
  limit,
  onChange,
  ...pick
}: {
  step: ChatbotStep;
  /** The plan's `followUpsPerStep`; `null` is unlimited, `undefined` while it loads. */
  limit: number | null | undefined;
  onChange: (fus: ChatbotFollowUp[]) => void;
} & Omit<ButtonListProps, "buttons" | "onChange" | "max" | "selfId" | "addLabel">) {
  const fus = step.followUps;
  const set = (k: number, f: ChatbotFollowUp) => onChange(fus.map((x, j) => (j === k ? f : x)));
  const cap = followUpCap(limit);
  return (
    <>
      <span>
        Sent if they don't reply.
        {cap === 0
          ? " Follow-ups aren't included in your plan."
          : cap !== undefined && ` Up to ${cap} on your plan.`}
      </span>
      {cap !== undefined && fus.length > cap && (
        <span className="text-amber-600">
          Your plan sends only the first {cap}. Remove {fus.length - cap} to publish.
        </span>
      )}
      {fus.map((f, k) => (
        <div
          key={f.id}
          className="flex flex-col gap-2 rounded-[11px] border border-border bg-card p-2.5"
        >
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5">
            After
            <select
              className={fieldCls}
              aria-label="Follow-up time"
              value={f.afterSeconds}
              onChange={(e) => set(k, { ...f, afterSeconds: Number(e.target.value) })}
            >
              {FOLLOW_UP_PRESETS.map((v) => (
                <option key={v} value={v}>
                  {formatDelay(v)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="rounded-md p-1.5 hover:bg-muted"
              aria-label="Remove follow-up"
              onClick={() =>
                onChange(fus.filter((_, j) => j !== k).map((x, i) => ({ ...x, order: i })))
              }
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <input
              className={cn(fieldCls, "col-span-3 w-full")}
              value={f.message}
              placeholder="Follow-up message"
              aria-label="Follow-up message"
              onChange={(e) => set(k, { ...f, message: e.target.value })}
            />
          </div>
          {f.buttons.length === 0 ? (
            <div className="flex flex-col gap-1.5">
              <span>Re-sends this step's reply buttons.</span>
              <button
                type="button"
                className="w-full rounded-[10px] border border-dashed border-border p-1.5 text-xs hover:border-primary hover:text-primary"
                onClick={() => set(k, { ...f, buttons: [newButton("NEXT_STEP", "Tap here")] })}
              >
                + Use different buttons
              </button>
            </div>
          ) : (
            <>
              <ButtonList
                {...pick}
                selfId={step.id}
                buttons={f.buttons}
                max={MAX_FOLLOW_UP_BUTTONS}
                addLabel="+ Add another button"
                onChange={(buttons) => set(k, { ...f, buttons })}
              />
              <button
                type="button"
                className="self-start text-xs font-medium text-primary hover:underline"
                onClick={() => set(k, { ...f, buttons: [] })}
              >
                Back to this step's buttons
              </button>
            </>
          )}
        </div>
      ))}
      {cap !== undefined && fus.length < cap && (
        <button
          type="button"
          className="w-full rounded-[10px] border border-dashed border-border p-2 text-[13px] hover:border-primary hover:text-primary"
          onClick={() => {
            const last = fus[fus.length - 1];
            const idx = last
              ? FOLLOW_UP_PRESETS.indexOf(last.afterSeconds as (typeof FOLLOW_UP_PRESETS)[number])
              : -1;
            const after = last
              ? FOLLOW_UP_PRESETS[Math.min(Math.max(idx, 0) + 2, FOLLOW_UP_PRESETS.length - 1)]
              : 1800;
            onChange([
              ...fus,
              {
                id: uid(),
                afterSeconds: after,
                message: "Still there? 👋",
                order: fus.length,
                buttons: [],
              },
            ]);
          }}
        >
          + Add follow-up
        </button>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- condition */

export function ConditionEditor({
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
  const match = step.config.match === "any" ? "any" : "all";
  const rules = conditionRules(step);
  const setRules = (r: Rule[]) => onChange({ ...step.config, rules: r });
  const setRule = (k: number, r: Rule) => setRules(rules.map((x, j) => (j === k ? r : x)));
  const path = (key: "yesStepId" | "elseStepId", label: string, tone: string) => (
    <div className="flex min-w-0 items-center gap-1.5 rounded-[10px] border border-border bg-card py-1 pr-1 pl-2.5">
      <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", tone)}>{label}</span>
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium">
        If
        <div
          role="group"
          aria-label="Match"
          className="inline-flex rounded-[10px] bg-secondary p-0.5"
        >
          {(["all", "any"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChange({ ...step.config, match: m })}
              className={cn(
                "rounded-lg px-3.5 py-1 text-xs font-semibold text-muted-foreground",
                match === m && "bg-card text-foreground shadow-card",
              )}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>
        of these are true
      </div>
      <div className="flex flex-col gap-1">
        {rules.map((r, k) => (
          <div key={k}>
            {k > 0 && (
              <div className="py-0.5 pl-3 text-[11px] font-semibold text-muted-foreground">
                {match === "all" ? "AND" : "OR"}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5 rounded-[10px] border border-border bg-background p-2">
              <select
                className={fieldCls}
                aria-label="Rule type"
                value={r.kind}
                onChange={(e) => {
                  const kind = e.target.value as Rule["kind"];
                  setRule(
                    k,
                    kind === "answer"
                      ? { kind, name: r.name, op: "is", value: "" }
                      : { kind, name: r.name },
                  );
                }}
              >
                <option value="has_tag">Has tag</option>
                <option value="not_tag">Doesn't have tag</option>
                <option value="answer">Saved answer</option>
              </select>
              <input
                className={cn(fieldCls, "flex-[1_1_120px]")}
                value={r.name}
                aria-label="Name"
                placeholder={r.kind === "answer" ? "Answer name, e.g. followers" : "Tag name"}
                onChange={(e) => setRule(k, { ...r, name: e.target.value })}
              />
              {r.kind === "answer" && (
                <>
                  <select
                    className={fieldCls}
                    aria-label="Compare"
                    value={r.op}
                    onChange={(e) => setRule(k, { ...r, op: e.target.value as typeof r.op })}
                  >
                    <option value="is">is</option>
                    <option value="contains">contains</option>
                    <option value="gt">more than</option>
                    <option value="lt">less than</option>
                    <option value="is_set">is saved</option>
                  </select>
                  {r.op !== "is_set" && (
                    <input
                      className={cn(fieldCls, "flex-[0_1_100px]")}
                      value={r.value ?? ""}
                      placeholder="Value"
                      aria-label="Value"
                      onChange={(e) => setRule(k, { ...r, value: e.target.value })}
                    />
                  )}
                </>
              )}
              {rules.length > 1 && (
                <button
                  type="button"
                  className="rounded-md p-1.5 hover:bg-muted"
                  aria-label="Remove rule"
                  onClick={() => setRules(rules.filter((_, j) => j !== k))}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {rules.length < MAX_CONDITION_RULES && (
        <button
          type="button"
          className="w-full rounded-[10px] border border-dashed border-border p-2 text-[13px] text-muted-foreground hover:border-primary hover:text-primary"
          onClick={() => setRules([...rules, { kind: "has_tag", name: "" }])}
        >
          + Add rule
        </button>
      )}
      <div className="flex flex-col gap-1.5">
        {path("yesStepId", "Yes", "bg-accent text-accent-foreground")}
        {path("elseStepId", "Else", "bg-secondary")}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- question */

export function QuestionEditor({
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
  const set = (k: string, v: unknown) => onChange({ ...step.config, [k]: v });
  const skip = cfgStr(step, "skipButtonLabel");
  return (
    <div className="flex flex-col gap-2.5 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center gap-1.5">
        Save the answer as
        <input
          className={cn(fieldCls, "w-36")}
          aria-label="Answer name"
          value={cfgStr(step, "answerKey") ?? ""}
          onChange={(e) =>
            set(
              "answerKey",
              e.target.value
                .toLowerCase()
                .replace(/[^a-z0-9_]/g, "_")
                .slice(0, 40),
            )
          }
        />
        <select
          className={fieldCls}
          aria-label="Answer type"
          value={cfgStr(step, "answerType") ?? "TEXT"}
          onChange={(e) => set("answerType", e.target.value as AnswerType)}
        >
          <option value="TEXT">Text</option>
          <option value="EMAIL">Email</option>
          <option value="PHONE">Phone</option>
          <option value="NUMBER">Number</option>
        </select>
      </div>
      <label className="flex flex-col gap-1">
        If the answer doesn't look right, ask once more with
        <input
          className={fieldCls}
          value={cfgStr(step, "retryMessage") ?? ""}
          onChange={(e) => set("retryMessage", e.target.value)}
        />
      </label>
      <div className="flex min-w-0 items-center gap-1.5 rounded-[10px] border border-border bg-card py-1 pr-1 pl-2.5 text-[13px]">
        <span className="flex-1">Then</span>
        <TargetPicker
          value={{ kind: "step", id: cfgStr(step, "nextStepId") }}
          onPick={(t) => set("nextStepId", t.kind === "step" ? t.id : null)}
          steps={steps}
          selfId={step.id}
          chatbots={chatbots}
          allowHuman={false}
          allowEnd
          onNewStep={onNewStep}
          onJump={onJump}
        />
      </div>
      <label className="flex flex-wrap items-center gap-1.5">
        <input
          type="checkbox"
          checked={!!skip}
          onChange={(e) => set("skipButtonLabel", e.target.checked ? "Skip" : undefined)}
        />
        Offer a skip button
        {skip && (
          <input
            className={cn(fieldCls, "w-28")}
            maxLength={MAX_BUTTON_LABEL}
            value={skip}
            aria-label="Skip button text"
            onChange={(e) => set("skipButtonLabel", e.target.value || "Skip")}
          />
        )}
      </label>
      {skip && (
        <div className="flex min-w-0 items-center gap-1.5 rounded-[10px] border border-border bg-card py-1 pr-1 pl-2.5 text-[13px]">
          <span className="flex-1">Skipping goes to</span>
          <TargetPicker
            value={{ kind: "step", id: cfgStr(step, "skipStepId") ?? cfgStr(step, "nextStepId") }}
            onPick={(t) => set("skipStepId", t.kind === "step" ? t.id : null)}
            steps={steps}
            selfId={step.id}
            chatbots={chatbots}
            allowHuman={false}
            allowEnd
            onNewStep={onNewStep}
            onJump={onJump}
          />
        </div>
      )}
    </div>
  );
}

export const QUICK_REPLY_MAX = MAX_QUICK_REPLIES;
