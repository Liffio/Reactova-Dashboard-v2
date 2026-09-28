import { ChevronDown, Clock, MoonStar, MoreHorizontal, Repeat, Tag, UserPlus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MAX_QUICK_REPLIES, type ChatbotButton, type ChatbotStep } from "@/lib/api/chatbot-api";
import { cn } from "@/lib/utils";
import { STEP_LABEL, cfgStr, formatDelay, stepSummary } from "./model";
import { LockedRow } from "./upgrade";
import { MergeFieldPicker } from "./merge-fields";
import {
  ButtonList,
  ConditionEditor,
  DelayControl,
  DelayIcon,
  FollowUpEditor,
  QuestionEditor,
  RepeatIcon,
  SettingsRow,
  TagIcon,
  TargetPicker,
  fieldCls,
  targetLabel,
  targetOfButton,
  type ChatbotRef,
  type StepRef,
} from "./step-editors";

export type StepAction = "up" | "down" | "first" | "dup" | "del";

interface Props {
  step: ChatbotStep;
  index: number;
  total: number;
  open: boolean;
  flash: boolean;
  steps: StepRef[];
  chatbots: ChatbotRef[];
  /** `useModuleFeatures("chatbot")`: a missing capability locks its row, never hides it. */
  features: Record<string, boolean>;
  /** Answer keys saved by this chatbot's Question steps, for merge fields. */
  answerKeys: string[];
  onToggle: () => void;
  onChange: (step: ChatbotStep) => void;
  onAction: (a: StepAction) => void;
  onNewStep: () => string;
  onJump: (id: string) => void;
}

const typePill = (s: ChatbotStep) =>
  s.type === "CONDITION"
    ? "bg-cond text-cond-foreground"
    : s.type === "HANDOVER"
      ? "bg-warning-wash text-foreground"
      : "bg-msg text-msg-foreground";

/** "See plans → Step 2" (prototype `routeChip`). */
function RouteChip({
  label,
  to,
  steps,
  chatbots,
}: {
  label: string;
  to: ReturnType<typeof targetOfButton>;
  steps: StepRef[];
  chatbots: ChatbotRef[];
}) {
  const t = targetLabel(to, steps, chatbots);
  const idx = to.kind === "step" ? steps.findIndex((s) => s.id === to.id) : -1;
  const short =
    to.kind === "human"
      ? "Person"
      : to.kind === "link"
        ? "Link"
        : to.kind === "chatbot"
          ? "Chatbot"
          : to.kind === "skip"
            ? "Skip"
            : idx >= 0
              ? `Step ${idx + 1}`
              : "Not set";
  return (
    <span
      className={cn(
        "inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-[9px] border border-border bg-msg/40 px-2.5 py-1 text-xs",
        t.tone === "empty" && "border-dashed",
      )}
    >
      <span className="truncate">{label}</span>
      <b
        className={cn(
          "whitespace-nowrap font-semibold text-muted-foreground",
          to.kind === "human" && "text-warning",
          t.tone === "empty" && "text-primary",
        )}
      >
        → {short}
      </b>
    </span>
  );
}

function Summary({
  step,
  steps,
  chatbots,
}: {
  step: ChatbotStep;
  steps: StepRef[];
  chatbots: ChatbotRef[];
}) {
  if (step.type === "CONDITION") {
    return (
      <>
        <p className="truncate text-[13px] text-muted-foreground">{stepSummary(step)}</p>
        <div className="flex flex-wrap gap-1.5">
          <RouteChip
            label="Yes"
            to={{ kind: "step", id: cfgStr(step, "yesStepId") }}
            steps={steps}
            chatbots={chatbots}
          />
          <RouteChip
            label="Else"
            to={{ kind: "step", id: cfgStr(step, "elseStepId") }}
            steps={steps}
            chatbots={chatbots}
          />
        </div>
      </>
    );
  }
  const meta: Array<{ icon: typeof Clock; text: string }> = [];
  if (step.delaySeconds) meta.push({ icon: Clock, text: formatDelay(step.delaySeconds) });
  if (step.tagToAdd?.trim()) meta.push({ icon: Tag, text: step.tagToAdd.trim() });
  if (step.followUps.length)
    meta.push({
      icon: Repeat,
      text: `${step.followUps.length} follow-up${step.followUps.length > 1 ? "s" : ""}`,
    });
  return (
    <>
      <p className="truncate text-[13px] text-muted-foreground">{stepSummary(step)}</p>
      {step.buttons.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {step.buttons.map((b) => (
            <RouteChip
              key={b.id}
              label={b.label}
              to={targetOfButton(b)}
              steps={steps}
              chatbots={chatbots}
            />
          ))}
        </div>
      )}
      {meta.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {meta.map(({ icon: Icon, text }) => (
            <span key={text} className="inline-flex items-center gap-1">
              <Icon className="h-3.5 w-3.5" />
              {text}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

export function StepCard({
  step,
  index,
  total,
  open,
  flash,
  steps,
  chatbots,
  features,
  answerKeys,
  onToggle,
  onChange,
  onAction,
  onNewStep,
  onJump,
}: Props) {
  const first = index === 0;
  const isCond = step.type === "CONDITION";
  const setButtons = (buttons: ChatbotButton[]) => onChange({ ...step, buttons });
  const waits =
    (step.type === "MESSAGE" && step.buttons.some((b) => b.action !== "LINK")) ||
    step.type === "QUESTION";
  const pick = { steps, chatbots, onNewStep, onJump };
  // D4: what this step does outside the account's business hours.
  const outside = (step.config.outsideHours ?? {}) as {
    body?: string | null;
    stepId?: string | null;
  };
  const setOutside = (next: { body?: string | null; stepId?: string | null }) => {
    const merged = { ...outside, ...next };
    const empty = !merged.body?.trim() && !merged.stepId;
    onChange({ ...step, config: { ...step.config, outsideHours: empty ? undefined : merged } });
  };

  return (
    <article
      data-step-id={step.id}
      className={cn(
        "relative mb-3.5 rounded-2xl border border-border bg-card shadow-card transition-[border-color,box-shadow] hover:border-primary/35",
        open && "border-primary/55 shadow-glow",
        flash && "border-primary shadow-glow",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-3.5 -left-11 z-[1] grid h-[31px] w-[31px] place-items-center rounded-[11px] border border-border bg-card text-xs font-semibold text-muted-foreground shadow-card max-md:-left-[38px] max-md:h-7 max-md:w-7",
          isCond && "border-transparent bg-cond text-cond-foreground",
          first && "border-transparent bg-brand-gradient text-white",
          open && !first && "border-primary text-primary",
        )}
      >
        {index + 1}
      </span>

      <div
        className="flex min-h-[58px] cursor-pointer items-center gap-2 py-3 pr-2.5 pl-4.5"
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest("input,button,[role=menu]")) onToggle();
        }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {open ? (
            <input
              className="-ml-2 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 font-display text-[15px] font-semibold hover:bg-muted focus:border-border focus:bg-background focus:outline-none"
              value={step.name}
              aria-label="Step name"
              onChange={(e) => onChange({ ...step, name: e.target.value })}
            />
          ) : (
            <span className="truncate font-display text-[15px] font-semibold">{step.name}</span>
          )}
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap max-sm:hidden",
              typePill(step),
            )}
          >
            {STEP_LABEL[step.type]}
          </span>
          {first && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-accent-foreground">
              Starts here
            </span>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Step options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={index <= 1} onSelect={() => onAction("up")}>
              Move up
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={first || index === total - 1}
              onSelect={() => onAction("down")}
            >
              Move down
            </DropdownMenuItem>
            <DropdownMenuItem disabled={first} onSelect={() => onAction("first")}>
              Set as first step
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAction("dup")}>Duplicate</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={total < 2}
              className="text-primary"
              onSelect={() => onAction("del")}
            >
              Delete step
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={open ? "Collapse step" : "Expand step"}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
        >
          <ChevronDown
            className={cn("h-[18px] w-[18px] transition-transform", open && "rotate-180")}
          />
        </button>
      </div>

      {!open ? (
        <div className="flex cursor-pointer flex-col gap-2.5 px-4.5 pb-4" onClick={onToggle}>
          <Summary step={step} steps={steps} chatbots={chatbots} />
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-4.5 pt-1 pb-4.5">
          {isCond && (
            <ConditionEditor
              step={step}
              onChange={(config) => onChange({ ...step, config })}
              {...pick}
            />
          )}

          {step.type === "START_CHATBOT" && (
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
              Continue in
              <select
                className={fieldCls}
                value={cfgStr(step, "targetChatbotId") ?? ""}
                onChange={(e) => onChange({ ...step, config: { targetChatbotId: e.target.value } })}
              >
                <option value="">Pick a chatbot…</option>
                {chatbots.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {(step.type === "MESSAGE" || step.type === "QUESTION" || step.type === "HANDOVER") && (
            <div>
              <div className="mb-1.5 text-xs font-semibold text-muted-foreground">
                {step.type === "QUESTION"
                  ? "Question"
                  : step.type === "HANDOVER"
                    ? "Closing message"
                    : "Message"}
              </div>
              <textarea
                className="min-h-[84px] w-full resize-y rounded-xl border border-border bg-card px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-muted-foreground"
                rows={3}
                value={step.body ?? ""}
                aria-label="Message"
                onChange={(e) => onChange({ ...step, body: e.target.value })}
              />
              <div className="mt-1">
                <MergeFieldPicker
                  enabled={features.personalization}
                  answerKeys={answerKeys}
                  onInsert={(token) => {
                    const body = step.body ?? "";
                    onChange({
                      ...step,
                      body: body && !body.endsWith(" ") ? `${body} ${token}` : `${body}${token}`,
                    });
                  }}
                />
              </div>
              {step.type === "HANDOVER" && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Then the bot goes quiet for 24 hours and your team is notified.
                </p>
              )}
            </div>
          )}

          {step.type === "QUESTION" && (
            <QuestionEditor
              step={step}
              onChange={(config) => onChange({ ...step, config })}
              {...pick}
            />
          )}

          {step.type === "QUESTION" &&
            (features.lead_capture ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <UserPlus className="h-3.5 w-3.5" /> Answers are saved to Leads, with this chatbot
                and step as the source.
              </p>
            ) : (
              <LockedRow
                capability="chatbot:lead_capture"
                feature="Answers to Leads"
                icon={<UserPlus className="h-4 w-4" />}
                label="Save answers to Leads"
              />
            ))}

          {step.type === "MESSAGE" && (
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span>Reply buttons</span>
                <small className="font-normal">
                  {step.buttons.length} of {MAX_QUICK_REPLIES}
                </small>
              </div>
              <ButtonList
                {...pick}
                selfId={step.id}
                buttons={step.buttons}
                max={MAX_QUICK_REPLIES}
                onChange={setButtons}
              />
              {!step.buttons.some((b) => b.action !== "LINK") && (
                <div className="mt-2 flex min-w-0 items-center gap-1.5 rounded-[10px] border border-dashed border-border py-1 pr-1 pl-2.5 text-[13px] text-muted-foreground">
                  <span className="flex-1">With no buttons, continue to</span>
                  <TargetPicker
                    value={{ kind: "step", id: cfgStr(step, "nextStepId") }}
                    onPick={(t) =>
                      onChange({
                        ...step,
                        config: { ...step.config, nextStepId: t.kind === "step" ? t.id : null },
                      })
                    }
                    selfId={step.id}
                    allowHuman={false}
                    allowEnd
                    {...pick}
                  />
                </div>
              )}
            </div>
          )}

          {!isCond && step.type !== "START_CHATBOT" && (
            <div className="flex flex-col gap-2">
              <SettingsRow
                tone="delay"
                icon={DelayIcon}
                label="Delay before sending"
                value={formatDelay(step.delaySeconds)}
                isSet={step.delaySeconds > 0}
              >
                <DelayControl
                  value={step.delaySeconds}
                  onChange={(delaySeconds) => onChange({ ...step, delaySeconds })}
                />
              </SettingsRow>
              {!features.tags ? (
                <LockedRow
                  capability="chatbot:tags"
                  feature="Tags"
                  icon={<Tag className="h-4 w-4" />}
                  label="Add tag when sent"
                />
              ) : (
                <SettingsRow
                  tone="tag"
                  icon={TagIcon}
                  label="Add tag when sent"
                  value={step.tagToAdd?.trim() || "None"}
                  isSet={!!step.tagToAdd?.trim()}
                >
                  <input
                    className={fieldCls}
                    value={step.tagToAdd ?? ""}
                    maxLength={64}
                    placeholder="e.g. Got discount code"
                    aria-label="Tag to add"
                    onChange={(e) => onChange({ ...step, tagToAdd: e.target.value || null })}
                  />
                  <span>Conditions can check this tag later.</span>
                </SettingsRow>
              )}
              {(waits || step.followUps.length > 0) &&
                (!features.follow_ups ? (
                  <LockedRow
                    capability="chatbot:follow_ups"
                    feature="Follow-ups"
                    icon={<Repeat className="h-4 w-4" />}
                    label="Follow-ups"
                  />
                ) : (
                  <SettingsRow
                    tone="fu"
                    icon={RepeatIcon}
                    label="Follow-ups"
                    value={step.followUps.length ? `${step.followUps.length} set` : "Off"}
                    isSet={step.followUps.length > 0}
                  >
                    <FollowUpEditor
                      step={step}
                      onChange={(followUps) => onChange({ ...step, followUps })}
                      {...pick}
                    />
                  </SettingsRow>
                ))}
              {!features.business_hours ? (
                <LockedRow
                  capability="chatbot:business_hours"
                  feature="Business hours"
                  icon={<MoonStar className="h-4 w-4" />}
                  label="Outside business hours"
                />
              ) : (
                <SettingsRow
                  tone="delay"
                  icon={<MoonStar className="h-4 w-4" />}
                  label="Outside business hours"
                  value={
                    outside.stepId
                      ? "Go to another step"
                      : outside.body?.trim()
                        ? "Different reply"
                        : "Same reply"
                  }
                  isSet={!!outside.stepId || !!outside.body?.trim()}
                >
                  <textarea
                    className={fieldCls}
                    rows={2}
                    maxLength={1000}
                    placeholder="Reply instead, e.g. We're closed right now, we'll reply at 9am"
                    aria-label="Reply outside business hours"
                    value={outside.body ?? ""}
                    onChange={(e) => setOutside({ body: e.target.value || null })}
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="flex-1">Or go to</span>
                    <TargetPicker
                      value={{ kind: "step", id: outside.stepId ?? null }}
                      onPick={(t) => setOutside({ stepId: t.kind === "step" ? t.id : null })}
                      selfId={step.id}
                      allowHuman={false}
                      allowEnd
                      {...pick}
                    />
                  </div>
                  <span>
                    Uses the hours set on your chatbots page. Inside those hours nothing changes.
                  </span>
                </SettingsRow>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
