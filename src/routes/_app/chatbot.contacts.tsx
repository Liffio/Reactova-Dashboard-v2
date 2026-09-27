import { Fragment, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Info, Search } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/guards";
import { InstagramRequired } from "@/components/auth/instagram-required";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { chatbotApi, chatbotKeys, type ContactRow } from "@/lib/api/chatbot-api";
import { isWorkspaceReady } from "@/lib/api/active-workspace";
import { useDebounced } from "@/hooks/use-debounced";
import { getUserErrorMessage } from "@/lib/user-facing-error";
import { toast } from "@/lib/toast";
import { useApp } from "@/state/app-context";
import { useCan } from "@/hooks/use-auth";
import { useModuleFeatures } from "@/hooks/use-features";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/chatbot/contacts")({
  head: () => ({ meta: [{ title: "Chatbot contacts — Liffio" }] }),
  component: () => (
    <ProtectedRoute module="chatbot">
      <InstagramRequired feature="Chatbots">
        <ContactsPage />
      </InstagramRequired>
    </ProtectedRoute>
  ),
});

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
const handle = (c: ContactRow) =>
  c.igUsername ? `@${c.igUsername}` : (c.displayName ?? "Instagram user");
const pauseWhy = {
  HANDOVER: "asked for a person",
  HUMAN_REPLY: "your team replied",
  MANUAL: "paused by your team",
} as const;

/**
 * Who has talked to the chatbots and where each conversation is (spec §10.1). Kept live by the
 * `chatbot_session` / `chatbot_contact` realtime resources (`use-workspace-events.ts`), which
 * invalidate `chatbot-contacts`; no polling.
 */
function ContactsPage() {
  const { current } = useApp();
  const ws = current.id;
  const ready = isWorkspaceReady(ws);
  const [q, setQ] = useState("");
  const [pausedOnly, setPausedOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const search = useDebounced(q, 300);

  const list = useInfiniteQuery({
    queryKey: [...chatbotKeys.contacts(ws), search, pausedOnly],
    queryFn: ({ pageParam }) =>
      chatbotApi.contacts(ws, {
        q: search || undefined,
        paused: pausedOnly,
        cursor: pageParam,
        limit: 30,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: ready,
  });
  const rows = list.data?.pages.flatMap((p) => p.contacts) ?? [];

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex min-h-16 items-center gap-2.5 border-b border-border px-6 py-3 max-md:px-4">
        <Button variant="ghost" size="icon" asChild aria-label="Back to chatbots">
          <Link to="/chatbot">
            <ChevronLeft className="!size-5" />
          </Link>
        </Button>
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight">Contacts</h1>
          <p className="text-[13px] text-muted-foreground max-md:hidden">
            Everyone who has messaged your chatbots, and where each conversation is.
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-10 max-md:px-4">
        <div className="mx-auto flex max-w-[1000px] flex-col gap-4">
          <p className="flex items-start gap-2 rounded-xl bg-msg/50 px-3 py-2.5 text-xs text-msg-foreground">
            <Info className="mt-px h-3.5 w-3.5 shrink-0" />
            Instagram moves any conversation a chatbot replies to into your General inbox folder.
            That's how Instagram works for every connected tool and can't be changed.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search by username"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              variant={pausedOnly ? "default" : "outline"}
              onClick={() => setPausedOnly(!pausedOnly)}
            >
              Bot paused
            </Button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {list.isLoading && (
              <div className="flex flex-col gap-2 p-4">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            )}
            {!list.isLoading && rows.length === 0 && (
              <p className="p-8 text-center text-sm text-muted-foreground">
                {search || pausedOnly
                  ? "No one matches."
                  : "No one has messaged a chatbot yet. Once someone does, they show up here."}
              </p>
            )}
            {rows.map((c) => {
              const paused = c.botPausedUntil && new Date(c.botPausedUntil) > new Date();
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setOpenId(c.id)}
                  className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient text-xs font-bold text-white">
                    {c.profilePicUrl ? (
                      <img src={c.profilePicUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      handle(c).replace("@", "").slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{handle(c)}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {c.activeSession
                        ? `In ${c.activeSession.chatbotName}${c.activeSession.stepName ? ` · ${c.activeSession.stepName}` : ""}`
                        : "No conversation running"}
                    </div>
                  </div>
                  {paused && (
                    <span className="rounded-full bg-warning-wash px-2 py-0.5 text-xs whitespace-nowrap">
                      Bot paused · {pauseWhy[c.pausedReason ?? "MANUAL"]}
                    </span>
                  )}
                  <span className="text-xs whitespace-nowrap text-muted-foreground max-sm:hidden">
                    {when(c.lastInboundAt)}
                  </span>
                </button>
              );
            })}
          </div>
          {list.hasNextPage && (
            <Button
              variant="outline"
              className="self-center"
              disabled={list.isFetchingNextPage}
              onClick={() => void list.fetchNextPage()}
            >
              {list.isFetchingNextPage ? "Loading…" : "Load more"}
            </Button>
          )}
        </div>
      </div>

      <ContactSheet workspaceId={ws} contactId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function ContactSheet({
  workspaceId,
  contactId,
  onClose,
}: {
  workspaceId: string;
  contactId: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const canUpdate = useCan("chatbot", "update");
  const features = useModuleFeatures("chatbot");
  const canManage = canUpdate && features.contacts_manage;
  const detail = useQuery({
    queryKey: ["chatbot-contact", workspaceId, contactId],
    queryFn: () => chatbotApi.contact(workspaceId, contactId!),
    enabled: !!contactId,
  });
  const done = () =>
    void queryClient.invalidateQueries({ queryKey: chatbotKeys.contacts(workspaceId) });
  const pause = useMutation({
    mutationFn: (hours: number) => chatbotApi.pauseContact(workspaceId, contactId!, hours),
    onSuccess: (c) => {
      queryClient.setQueryData(["chatbot-contact", workspaceId, contactId], c);
      done();
      toast.success("The bot stays quiet with this person while you reply");
    },
    onError: (e) => toast.error(getUserErrorMessage(e, "Couldn't pause the bot.")),
  });
  const resume = useMutation({
    mutationFn: () => chatbotApi.resumeContact(workspaceId, contactId!),
    onSuccess: (c) => {
      queryClient.setQueryData(["chatbot-contact", workspaceId, contactId], c);
      done();
      toast.success("The bot is back on for this person");
    },
    onError: (e) => toast.error(getUserErrorMessage(e, "Couldn't resume the bot.")),
  });
  const c = detail.data;
  const paused = c?.botPausedUntil && new Date(c.botPausedUntil) > new Date();

  return (
    <Sheet open={!!contactId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-5 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{c ? handle(c) : "Contact"}</SheetTitle>
          <SheetDescription>{c ? `Last message ${when(c.lastInboundAt)}` : ""}</SheetDescription>
        </SheetHeader>
        {!c ? (
          <Skeleton className="h-40" />
        ) : (
          <>
            <section className="rounded-xl border border-border p-3 text-sm">
              {paused ? (
                <p>
                  The bot is paused until {when(c.botPausedUntil)} because{" "}
                  {pauseWhy[c.pausedReason ?? "MANUAL"]}.
                </p>
              ) : (
                <p>The bot is replying to this person.</p>
              )}
              {canManage && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {paused ? (
                    <Button size="sm" disabled={resume.isPending} onClick={() => resume.mutate()}>
                      Resume bot
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pause.isPending}
                        onClick={() => pause.mutate(24)}
                      >
                        Pause 24 hours
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pause.isPending}
                        onClick={() => pause.mutate(168)}
                      >
                        Pause 7 days
                      </Button>
                    </>
                  )}
                </div>
              )}
            </section>
            <section>
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Tags</h3>
              {c.tags.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {c.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No tags yet.</p>
              )}
            </section>
            <section>
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Saved answers</h3>
              {Object.keys(c.answers).length ? (
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  {Object.entries(c.answers).map(([k, a]) => (
                    <Fragment key={k}>
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="break-all">{a.value}</dd>
                    </Fragment>
                  ))}
                </dl>
              ) : (
                <p className="text-xs text-muted-foreground">No answers saved yet.</p>
              )}
            </section>
            <section>
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Conversations</h3>
              <ul className="flex flex-col gap-1.5">
                {c.sessions.map((s) => (
                  <li
                    key={s.id}
                    className={cn(
                      "rounded-lg border border-border px-3 py-2 text-xs",
                      s.status === "ACTIVE" && "border-primary/40",
                    )}
                  >
                    <div className="flex justify-between gap-2">
                      <b className="text-sm font-medium">{s.chatbotName}</b>
                      <span className="text-muted-foreground">
                        {s.status.toLowerCase().replace("_", " ")}
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      {when(s.startedAt)} · {s.stepCount} step{s.stepCount === 1 ? "" : "s"}
                      {s.endReason ? ` · ${s.endReason.toLowerCase().replace(/_/g, " ")}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
