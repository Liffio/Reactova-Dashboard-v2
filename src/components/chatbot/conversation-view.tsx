import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  chatbotApi,
  type ConversationMessage,
  type ConversationSummaryItem,
  type ConversationSummaryReason,
} from "@/lib/api/chatbot-api";
import { getUserErrorMessage } from "@/lib/user-facing-error";
import { cn } from "@/lib/utils";

const time = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const WHY: Record<ConversationSummaryReason, string> = {
  account_disconnected:
    "Instagram isn't connected right now, so the messages can't be read. Reconnect it to see the full conversation.",
  instagram_unavailable: "Instagram didn't answer just now. Try again in a moment.",
  too_old:
    "Instagram only lets us read the 20 most recent messages with this person, and this conversation is older.",
  not_found:
    "Instagram has no messages for this conversation. It may have been deleted in Instagram.",
};

const WHO: Record<ConversationMessage["from"], string> = {
  contact: "",
  bot: "Chatbot",
  business: "Your team",
};

/**
 * One conversation from the contact panel. The messages are read from Instagram each time it opens
 * and are not kept (not by Liffio's server, and not here once the view closes). When Instagram
 * can't answer, the run's summary stands in, labelled as a summary: it has the steps the bot sent
 * and the buttons tapped, but nothing the person typed.
 */
export function ConversationView({
  workspaceId,
  contactId,
  sessionId,
  chatbotName,
  onBack,
}: {
  workspaceId: string;
  contactId: string;
  sessionId: string;
  chatbotName: string;
  onBack: () => void;
}) {
  const conversation = useQuery({
    queryKey: ["chatbot-conversation", workspaceId, contactId, sessionId],
    queryFn: () => chatbotApi.conversation(workspaceId, contactId, sessionId),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const t = conversation.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="-ml-2 gap-1" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <b className="min-w-0 truncate text-sm font-medium">{chatbotName}</b>
      </div>

      {conversation.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="ml-auto h-10 w-2/3" />
          <Skeleton className="h-10 w-1/2" />
        </div>
      ) : conversation.error ? (
        <p className="text-sm text-destructive">
          {getUserErrorMessage(conversation.error, "Couldn't open this conversation.")}
        </p>
      ) : !t ? null : t.mode === "transcript" ? (
        <>
          {t.partial && (
            <Notice>
              Instagram only returns the 20 most recent messages, so the start of this conversation
              is missing.
            </Notice>
          )}
          <ol className="flex flex-col gap-2" aria-label="Messages">
            {t.messages.map((m) => (
              <Bubble key={m.id} message={m} />
            ))}
          </ol>
          <p className="text-[11px] text-muted-foreground">
            Read from Instagram just now. Liffio doesn't keep a copy.
          </p>
        </>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-secondary/60 p-3">
            <p className="text-xs font-semibold">Summary, not a transcript</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {WHY[t.reason]} This shows the steps the chatbot sent and the buttons tapped, not what
              the person typed.
            </p>
          </div>
          <SummaryList items={t.summary} />
        </>
      )}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2 rounded-xl border border-border bg-secondary/60 p-3 text-xs text-muted-foreground">
      <Info className="mt-px h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function Bubble({ message: m }: { message: ConversationMessage }) {
  const mine = m.from !== "contact";
  return (
    <li
      className={cn(
        "flex max-w-[85%] flex-col gap-0.5",
        mine ? "items-end self-end" : "items-start",
      )}
    >
      <div
        className={cn(
          "rounded-2xl px-3 py-2 text-sm break-words whitespace-pre-wrap",
          m.from === "contact" && "rounded-bl-md bg-secondary text-foreground",
          m.from === "bot" && "rounded-br-md bg-primary text-primary-foreground",
          m.from === "business" &&
            "rounded-br-md border border-border bg-background text-foreground",
        )}
      >
        {m.text ?? <span className="italic opacity-80">Attachment or sticker</span>}
      </div>
      <span className="px-1 text-[11px] text-muted-foreground">
        {WHO[m.from] ? `${WHO[m.from]} · ` : ""}
        {time(m.at)}
      </span>
    </li>
  );
}

const ENDED: Record<string, string> = {
  RESTARTED: "Started again",
  SWITCHED: "Switched to another chatbot",
  COMPLETED: "Finished",
  EXPIRED: "Timed out",
};

function SummaryList({ items }: { items: ConversationSummaryItem[] }) {
  if (!items.length) {
    return (
      <p className="text-xs text-muted-foreground">Nothing was recorded for this conversation.</p>
    );
  }
  return (
    <ol className="flex flex-col gap-2.5 border-l border-border pl-3.5" aria-label="Summary">
      {items.map((it, i) => (
        <li key={i} className="text-sm">
          <SummaryLine item={it} />
          <span className="block text-[11px] text-muted-foreground">{time(it.at)}</span>
        </li>
      ))}
    </ol>
  );
}

function SummaryLine({ item: it }: { item: ConversationSummaryItem }) {
  switch (it.kind) {
    case "started":
      return <span className="text-muted-foreground">Conversation started</span>;
    case "step":
    case "follow_up":
      return (
        <span>
          <span className="text-muted-foreground">
            {it.kind === "follow_up" ? "Follow-up sent" : "Sent"} · {it.stepName}
          </span>
          {it.text && <span className="mt-0.5 block whitespace-pre-wrap">{it.text}</span>}
        </span>
      );
    case "fallback":
      return (
        <span>
          <span className="text-muted-foreground">Didn't understand, sent the fallback</span>
          {it.text && <span className="mt-0.5 block whitespace-pre-wrap">{it.text}</span>}
        </span>
      );
    case "tap":
      return <span>Tapped “{it.label}”</span>;
    case "answer":
      return <span>{it.valid ? `Answered ${it.key}` : `Answer for ${it.key} wasn't valid`}</span>;
    case "handover":
      return <span>Handed over to your team</span>;
    case "ended":
      return <span className="text-muted-foreground">{ENDED[it.reason] ?? "Ended"}</span>;
  }
}
