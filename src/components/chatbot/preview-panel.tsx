import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImageOff, RotateCcw, SendHorizontal, X } from "lucide-react";
import {
  chatbotApi,
  type Chatbot,
  type ChatbotMedia,
  type PreviewFollowState,
  type TestAction,
  type TestResult,
  type TranscriptEntry,
} from "@/lib/api/chatbot-api";
import { cn } from "@/lib/utils";
import { conditionRules, cfgStr, formatDelay } from "./model";
import { formatDuration, previewParts, type MediaState } from "./media";

type Contact = TestResult["contact"];

/**
 * The builder's phone preview (spec §10.2), driven by `POST /chatbots/:id/test` — the real
 * interpreter over the saved draft, so what it shows is what a DM would do. The client only
 * replays the person's actions; `revision` re-runs it after each save.
 */
export function PreviewPanel({
  workspaceId,
  bot,
  revision,
  onClose,
  className,
}: {
  workspaceId: string;
  bot: Chatbot;
  revision: number;
  onClose?: () => void;
  className?: string;
}) {
  const [tab, setTab] = useState<"chat" | "contact">("chat");
  const [actions, setActions] = useState<TestAction[]>([]);
  const [contact, setContact] = useState<Contact>({ tags: [], answers: {} });
  // What an Ask-to-follow check answers in the preview; Instagram is never asked from here.
  const [followState, setFollowState] = useState<PreviewFollowState>("FOLLOWING");

  const test = useQuery({
    queryKey: ["chatbot-test", workspaceId, bot.id, revision, actions, contact, followState],
    queryFn: () => chatbotApi.test(workspaceId, bot.id, { contact, actions, followState }),
    placeholderData: (prev) => prev,
    staleTime: Infinity,
  });

  const restart = () => setActions([]);
  const contactCount =
    contact.tags.length + Object.values(contact.answers).filter((a) => a.value.trim()).length;

  return (
    <aside
      className={cn("flex min-h-0 flex-col border-l border-border bg-sidebar", className)}
      aria-label="Preview"
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        {onClose && (
          <button
            type="button"
            className="rounded-lg p-1.5 hover:bg-muted"
            aria-label="Close preview"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        )}
        <div
          role="tablist"
          aria-label="Preview mode"
          className="flex flex-1 rounded-[10px] bg-secondary p-0.5"
        >
          {(["chat", "contact"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-muted-foreground",
                tab === t && "bg-card text-foreground shadow-card",
              )}
            >
              {t === "chat" ? "Live preview" : "Test contact"}
              {t === "contact" && contactCount > 0 && (
                <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {contactCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
          title="Restart chat"
          aria-label="Restart chat"
          onClick={() => {
            setTab("chat");
            restart();
          }}
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4.5 pt-5 pb-6">
        {tab === "chat" ? (
          <Phone
            bot={bot}
            result={test.data}
            loading={test.isFetching && !test.data}
            error={test.isError}
            onAct={(a) => setActions((xs) => [...xs, a])}
            actionsCount={actions.length}
          />
        ) : (
          <TestContactPanel
            bot={bot}
            contact={contact}
            onChange={(c) => {
              setContact(c);
              restart();
            }}
            followState={followState}
            onFollowStateChange={(s) => {
              setFollowState(s);
              restart();
            }}
          />
        )}
      </div>
    </aside>
  );
}

/* ---------------------------------------------------------------- phone */

function Phone({
  bot,
  result,
  loading,
  error,
  onAct,
  actionsCount,
}: {
  bot: Chatbot;
  result: TestResult | undefined;
  loading: boolean;
  error: boolean;
  onAct: (a: TestAction) => void;
  actionsCount: number;
}) {
  const transcript = useMemo(() => result?.transcript ?? [], [result]);
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState<string | null>(null);
  const [text, setText] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);
  const firstTrigger = bot.triggers.find((t) => t.type === "KEYWORD");

  // Reveal new entries one at a time, the way they would arrive: a typing bubble for short delays,
  // "⏱ Waits 1 hr" for long ones (prototype `botSay`). Entries already seen appear instantly.
  useEffect(() => {
    if (shown > transcript.length) setShown(0);
    if (shown >= transcript.length) {
      setTyping(null);
      return;
    }
    const next = transcript[shown];
    if (next.from !== "bot") {
      const t = setTimeout(() => setShown((n) => n + 1), 120);
      return () => clearTimeout(t);
    }
    const d = next.delaySeconds ?? 0;
    if (d > 10) setTyping(`⏱ Waits ${formatDelay(d)}`);
    else setTyping("typing");
    const t = setTimeout(
      () => {
        setTyping(null);
        setShown((n) => n + 1);
      },
      d > 10 ? 900 : Math.min(Math.max(d, 0.6) * 350, 1600),
    );
    return () => clearTimeout(t);
  }, [shown, transcript]);

  useEffect(() => {
    if (actionsCount === 0) setShown(0);
  }, [actionsCount]);
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight });
  }, [shown, typing]);

  const visible = transcript.slice(0, shown);
  const settled = shown >= transcript.length && !typing;
  const lastBot = [...visible].reverse().find((e) => e.from === "bot");
  const state = result?.state;
  const canTap =
    settled &&
    state &&
    !state.ended &&
    state.awaiting !== "NONE" &&
    lastBot?.stepId === state.currentStepId;
  const step = state?.currentStepId
    ? bot.steps.find((s) => s.id === state.currentStepId)
    : undefined;
  const waitsUsed = countTrailingFollowUps(visible);
  const nextFollowUp =
    canTap && step
      ? [...step.followUps].sort((a, b) => a.afterSeconds - b.afterSeconds)[waitsUsed]
      : undefined;

  const send = () => {
    const v = text.trim();
    if (!v || !settled) return;
    setText("");
    onAct({ kind: "text", text: v });
  };

  return (
    <div className="flex h-full max-h-[720px] min-h-[520px] w-full max-w-[362px] flex-col overflow-hidden rounded-[38px] border-[9px] border-phone-frame bg-phone shadow-card max-md:max-h-none max-md:min-h-0">
      <div className="flex items-center gap-2.5 border-b border-border/40 px-3.5 pt-3.5 pb-2.5 text-bubble-in-foreground">
        <div className="grid h-[30px] w-[30px] place-items-center rounded-full bg-brand-gradient text-xs font-bold text-white">
          Y
        </div>
        <div>
          <b className="block text-[13px] leading-tight">yourbrand</b>
          <span className="text-[11px] opacity-60">Business account</span>
        </div>
      </div>
      <div ref={chatRef} className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-3 py-3.5">
        <Bubble from="person">{firstTrigger?.value ?? "hi"}</Bubble>
        {error && <Sys>Couldn't run the preview. Your latest changes may not be saved yet.</Sys>}
        {loading && <Sys>Loading…</Sys>}
        {visible.map((e, i) => (
          <Entry
            key={i}
            e={e}
            media={bot.media}
            awaitingTap={!!canTap && e === lastBot}
            onTap={(buttonId) => onAct({ kind: "tap", buttonId })}
          />
        ))}
        {typing === "typing" && (
          <div className="flex gap-1 self-start rounded-[18px] rounded-bl-md bg-bubble-in px-3.5 py-3 text-bubble-in-foreground">
            {[0, 1, 2].map((k) => (
              <i
                key={k}
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-current opacity-40"
                style={{ animationDelay: `${k * 150}ms` }}
              />
            ))}
          </div>
        )}
        {typing && typing !== "typing" && <Sys>{typing}</Sys>}
        {nextFollowUp && (
          <button
            type="button"
            className="mt-1 self-center rounded-full border border-dashed border-muted-foreground/50 px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary hover:text-primary"
            onClick={() => onAct({ kind: "wait" })}
          >
            ⏩ Test: no tap for {formatDelay(nextFollowUp.afterSeconds)}
          </button>
        )}
        {settled && state?.ended && state.endReason !== "HANDED_OVER" && (
          <Sys>{endText(state.endReason)}</Sys>
        )}
      </div>
      <form
        className="flex gap-2 px-3 pt-2.5 pb-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          className="flex-1 rounded-full border border-muted-foreground/30 bg-transparent px-3.5 py-2 text-xs text-bubble-in-foreground outline-none placeholder:text-muted-foreground"
          placeholder="Message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Type as the person"
        />
        <button
          type="submit"
          className="rounded-full p-2 text-muted-foreground hover:text-primary"
          aria-label="Send"
        >
          <SendHorizontal className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

function countTrailingFollowUps(entries: TranscriptEntry[]): number {
  let n = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.from === "person") break;
    if (e.from === "bot" && e.kind === "FOLLOW_UP") n++;
    if (e.from === "bot" && e.kind === "STEP") break;
  }
  return n;
}

const endText = (reason: string | null) =>
  reason === "BROKEN_LINK" || reason === "TARGET_MISSING"
    ? "This path doesn't go anywhere yet. Pick a next step for it."
    : reason === "LOOP_GUARD"
      ? "Stopped: these steps loop into each other."
      : "End of the chat.";

/** A bot entry in Instagram's order: the file, the text, its quick replies, then the link card. */
function Entry({
  e,
  media,
  awaitingTap,
  onTap,
}: {
  e: TranscriptEntry;
  media: Record<string, ChatbotMedia> | undefined;
  awaitingTap: boolean;
  onTap: (buttonId: string) => void;
}) {
  if (e.from === "system") return <Sys>{e.text}</Sys>;
  if (e.from === "person") return <Bubble from="person">{e.text}</Bubble>;
  return (
    <>
      {e.kind === "FOLLOW_UP" && <Sys>Follow-up · no reply yet</Sys>}
      {previewParts(e, media, awaitingTap).map((p, i) =>
        p.part === "media" ? (
          <MediaBubble key={i} state={p.state} />
        ) : p.part === "text" ? (
          <Bubble key={i} from="bot">
            {p.text}
          </Bubble>
        ) : p.part === "quickReplies" ? (
          // As Instagram shows them: filled, tinted chips on the bot's side, under its message.
          <div
            key={i}
            className="mt-0.5 flex max-w-[85%] flex-wrap justify-start gap-1.5 self-start"
          >
            {p.buttons.map((b) => (
              <button
                key={b.id}
                type="button"
                className="rounded-full border border-primary-edge bg-primary-wash px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 disabled:cursor-default disabled:hover:bg-primary-wash"
                // On a handover only the real thread can take the tap: it starts a new run there.
                disabled={!awaitingTap}
                title={
                  awaitingTap
                    ? undefined
                    : "In Instagram, tapping this ends the pause and goes where the button points"
                }
                onClick={() => onTap(b.id)}
              >
                {b.label}
              </button>
            ))}
          </div>
        ) : (
          <div
            key={i}
            className="w-[80%] self-start overflow-hidden rounded-[18px] rounded-bl-md bg-bubble-in text-bubble-in-foreground"
          >
            <div className="px-3 py-2 text-[13px] leading-snug">{p.text}</div>
            {p.buttons.map((b) => (
              <div
                key={b.id}
                className="border-t border-muted-foreground/20 px-3 py-1.5 text-center text-xs font-medium"
                title={`Opens ${b.url ?? "the link"} — the chat stays where it is`}
              >
                🔗 {b.label}
              </div>
            ))}
          </div>
        ),
      )}
    </>
  );
}

function MediaBubble({ state }: { state: Exclude<MediaState, { kind: "none" }> }) {
  if (state.kind === "missing")
    return (
      <div className="flex max-w-[80%] items-center gap-2 self-start rounded-[18px] rounded-bl-md border border-dashed border-muted-foreground/40 px-3 py-2 text-[12px] text-muted-foreground">
        <ImageOff className="h-4 w-4 shrink-0" aria-hidden />
        File missing — only the text is sent
      </div>
    );
  const m = state.media;
  const duration = formatDuration(m.durationSeconds);
  if (m.kind === "audio")
    return (
      <div className="flex max-w-[80%] items-center gap-2 self-start rounded-[18px] rounded-bl-md bg-bubble-in px-2 py-1.5 text-bubble-in-foreground">
        <audio controls preload="none" src={m.url ?? undefined} className="h-8 max-w-[200px]" />
        {duration && <span className="text-[11px] opacity-70">{duration}</span>}
      </div>
    );
  return (
    <div className="relative max-w-[70%] self-start overflow-hidden rounded-[18px] rounded-bl-md bg-bubble-in">
      {m.kind === "image" ? (
        <img src={m.url ?? undefined} alt="" className="block max-h-56 w-full object-cover" />
      ) : (
        <video
          src={m.url ?? undefined}
          poster={m.thumbnailUrl ?? undefined}
          controls
          preload="none"
          className="block max-h-56 w-full"
        />
      )}
      {m.kind === "video" && duration && (
        <span className="pointer-events-none absolute top-1.5 right-1.5 rounded bg-black/70 px-1 text-[10px] text-white">
          {duration}
        </span>
      )}
    </div>
  );
}

function Bubble({ from, children }: { from: "bot" | "person"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "max-w-[80%] rounded-[18px] px-3 py-2 text-[13px] leading-snug break-words whitespace-pre-wrap",
        from === "bot"
          ? "self-start rounded-bl-md bg-bubble-in text-bubble-in-foreground"
          : "self-end rounded-br-md bg-bubble-out text-white",
      )}
    >
      {children}
    </div>
  );
}

const Sys = ({ children }: { children: React.ReactNode }) => (
  <div className="self-center px-2 py-1 text-center text-[11px] text-muted-foreground">
    {children}
  </div>
);

/* ---------------------------------------------------------------- test contact */

function TestContactPanel({
  bot,
  contact,
  onChange,
  followState,
  onFollowStateChange,
}: {
  bot: Chatbot;
  contact: Contact;
  onChange: (c: Contact) => void;
  followState: PreviewFollowState;
  onFollowStateChange: (s: PreviewFollowState) => void;
}) {
  const asksToFollow = bot.steps.some((s) => s.type === "FOLLOW_GATE");
  const { tags, answers } = useMemo(() => {
    const t = new Map<string, string>();
    const a = new Map<string, string>();
    for (const s of bot.steps) {
      if (s.tagToAdd?.trim()) t.set(s.tagToAdd.trim().toLowerCase(), s.tagToAdd.trim());
      for (const b of s.buttons)
        if (b.tagToAdd?.trim()) t.set(b.tagToAdd.trim().toLowerCase(), b.tagToAdd.trim());
      if (s.type === "QUESTION") {
        const k = cfgStr(s, "answerKey");
        if (k) a.set(k, k);
      }
      for (const r of conditionRules(s)) {
        const n = r.name?.trim();
        if (!n) continue;
        if (r.kind === "answer") a.set(n.toLowerCase().replace(/\s+/g, "_"), n);
        else t.set(n.toLowerCase(), n);
      }
    }
    for (const x of contact.tags) t.set(x.toLowerCase(), x);
    return { tags: [...t.values()], answers: [...a.entries()] };
  }, [bot.steps, contact.tags]);

  const has = (n: string) => contact.tags.some((x) => x.toLowerCase() === n.toLowerCase());
  return (
    <div className="w-full max-w-[340px] self-center">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-[15px] font-semibold">Test contact</h3>
        <button
          type="button"
          className="text-xs font-medium text-primary hover:underline"
          onClick={() => onChange({ tags: [], answers: {} })}
        >
          Reset
        </button>
      </div>
      <p className="mt-1 mb-3.5 text-xs text-muted-foreground">
        Pretend to be a contact with these tags and answers. The chat restarts so you can see which
        path each condition takes.
      </p>
      {asksToFollow && (
        <label className="mb-4 flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
          When they tap Following ✅
          <select
            className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm font-normal text-foreground"
            value={followState}
            onChange={(e) => onFollowStateChange(e.target.value as PreviewFollowState)}
          >
            <option value="FOLLOWING">They follow you</option>
            <option value="NOT_FOLLOWING">They don't follow you yet</option>
            <option value="UNKNOWN">Instagram won't say</option>
          </select>
        </label>
      )}
      <div className="mb-2 text-xs font-semibold text-muted-foreground">Tags</div>
      {tags.length ? (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={has(t)}
              onClick={() =>
                onChange({
                  ...contact,
                  tags: has(t)
                    ? contact.tags.filter((x) => x.toLowerCase() !== t.toLowerCase())
                    : [...contact.tags, t],
                })
              }
              className={cn(
                "rounded-full border border-border bg-card px-3 py-1.5 text-xs",
                has(t) && "border-transparent bg-accent text-accent-foreground",
              )}
            >
              {has(t) ? "✓ " : ""}
              {t}
            </button>
          ))}
        </div>
      ) : (
        <div className="mb-4 rounded-xl border border-dashed border-border p-3.5 text-center text-xs text-muted-foreground">
          No tags used in this chatbot yet.
        </div>
      )}
      {answers.length > 0 && (
        <>
          <div className="mb-2 text-xs font-semibold text-muted-foreground">Saved answers</div>
          {answers.map(([key, label]) => (
            <div key={key} className="mb-2 flex items-center gap-2 text-xs">
              <span className="w-[90px] shrink-0 truncate text-muted-foreground" title={label}>
                {label}
              </span>
              <input
                className="min-w-0 flex-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[13px] outline-none focus:border-primary"
                placeholder="Their answer"
                defaultValue={contact.answers[key]?.value ?? ""}
                onBlur={(e) =>
                  onChange({
                    ...contact,
                    answers: {
                      ...contact.answers,
                      [key]: { value: e.target.value, type: "TEXT", at: "" },
                    },
                  })
                }
              />
            </div>
          ))}
        </>
      )}
    </div>
  );
}
