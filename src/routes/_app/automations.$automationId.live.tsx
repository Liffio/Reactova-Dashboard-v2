import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Loader2, Share2 } from "lucide-react";

import { ProtectedRoute } from "@/components/auth/guards";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getAutomation } from "@/lib/api/automations-api";
import { useApp } from "@/state/app-context";
import { toast } from "@/lib/toast";

/**
 * "You're live" — the screen after Go live. (`plan/onboarding-revamp.md`, create flow)
 *
 * ## Why a screen and not a toast
 *
 * Publishing used to drop the user back on the automations list with a toast. That answers "did it
 * save" and nothing else, and the question people actually have at that moment is *"is this
 * real?"* — a row in a list does not prove a DM will arrive. This screen turns the next five
 * minutes into one instruction: get someone to comment, and watch the DM appear.
 *
 * ## The status is real, not theatre
 *
 * It polls `GET /automations/:id` for `_count.dmJobsSent` — the count of DMs this automation has
 * actually **delivered**, not attempted. `_count.dmJobs` counts queued, retrying and failed jobs
 * too, and showing a failed send as "DM sent" on the screen whose entire job is to establish trust
 * would be the worst possible place to be loose about it.
 *
 * Per-automation rather than the workspace-wide `firstDmSentAt` from the usage endpoint: a
 * workspace's second automation would inherit the first one's activation timestamp and claim
 * success before anything had happened.
 *
 * ## Polling, and when it stops
 *
 * Every 5 seconds, and **only until the first delivery lands**. An indefinite 5-second poll on a
 * screen someone leaves open is a request every 5 seconds for as long as the tab lives; once the
 * DM has arrived there is nothing left to learn, so the interval returns `false` and the query
 * goes quiet. React Query also pauses it when the tab is hidden.
 */
export const Route = createFileRoute("/_app/automations/$automationId/live")({
  head: () => ({ meta: [{ title: "Automation live — Liffio" }] }),
  component: AutomationLiveRoute,
});

const POLL_MS = 5_000;

function AutomationLiveRoute() {
  return (
    <ProtectedRoute module="automation" action="read">
      <AutomationLive />
    </ProtectedRoute>
  );
}

function AutomationLive() {
  const { automationId } = Route.useParams();
  const { current } = useApp();
  const workspaceId = current.id;
  const [copied, setCopied] = useState(false);

  const { data: automation, isLoading } = useQuery({
    queryKey: ["automation", workspaceId, automationId],
    queryFn: () => getAutomation(workspaceId, automationId),
    enabled: Boolean(workspaceId && automationId),
    refetchInterval: (query) => ((query.state.data?._count?.dmJobsSent ?? 0) > 0 ? false : POLL_MS),
  });

  const keyword = automation?.keywords?.[0] ?? "";
  const delivered = automation?._count?.dmJobsSent ?? 0;
  const attempted = automation?._count?.dmJobs ?? 0;

  // Read once rather than at each render: `navigator` is absent during SSR, and a value that
  // flips between server and client render is a hydration mismatch on the icon below.
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const shareText = keyword
    ? `Can you comment ${keyword} on my latest post? Testing something 🙏`
    : "Can you comment on my latest post? Testing something 🙏";

  const share = async () => {
    // The native share sheet on a phone, clipboard everywhere else. Both can be refused — an
    // insecure origin, a dismissed sheet, a denied permission — and a dismissed share sheet is a
    // *choice*, not an error, so a refusal falls through to the clipboard rather than to a toast.
    // Only when neither works does the user get the text to copy by hand.
    if (canShare) {
      try {
        await navigator.share({ text: shareText });
        return;
      } catch {
        // fall through to the clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(`Copy this message manually: ${shareText}`);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 sm:p-6 md:p-10">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Live"
        title={keyword ? `Your ${keyword} automation is live` : "Your automation is live"}
        description="It's running now. Here's how to see it work."
      />

      <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6 md:p-10">
        <section className="grid gap-3 rounded-2xl border bg-card p-5 shadow-soft sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Trigger</p>
            <p className="mt-1 text-sm">
              {automation?.anyComment
                ? "Any comment on your post"
                : `Someone comments ${keyword} on your post`}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Action</p>
            <p className="mt-1 text-sm">
              {automation?.autoReply ? "Reply to their comment, then DM them" : "DM them"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="mt-1 text-sm font-medium text-success">Live</p>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-soft">
          <h2 className="font-display text-base font-semibold">Test it now</h2>

          <ol className="mt-4 space-y-4">
            <li className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-medium">
                1
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  Ask a friend to comment {keyword || "your keyword"} on this post, from a different
                  account than yours.
                </p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => void share()}>
                  {copied ? (
                    <>
                      <Check className="mr-1.5 h-3.5 w-3.5" /> Copied
                    </>
                  ) : (
                    <>
                      {canShare ? (
                        <Share2 className="mr-1.5 h-3.5 w-3.5" />
                      ) : (
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Copy message
                    </>
                  )}
                </Button>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-medium">
                2
              </span>
              <p className="min-w-0 flex-1 text-sm">Their DM shows up below as soon as it sends.</p>
            </li>
          </ol>

          <div className="mt-4 flex items-center gap-2.5 rounded-xl border bg-muted/30 p-3 text-sm">
            {delivered > 0 ? (
              <>
                <Check className="h-4 w-4 shrink-0 text-success" />
                <span>
                  DM sent — {delivered} {delivered === 1 ? "message" : "messages"} delivered
                </span>
              </>
            ) : attempted > 0 ? (
              <>
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                {/* Attempted but not yet delivered. Said plainly rather than as "sending", which
                    would be a promise we cannot keep if the job ends up failing. */}
                <span className="text-muted-foreground">A comment came in. Sending your DM…</span>
              </>
            ) : (
              <>
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">Waiting for their comment…</span>
              </>
            )}
          </div>
        </section>

        <p className="text-sm text-muted-foreground">
          Each comment gets one DM. Testing again? Use a new comment and wait a minute.
        </p>

        <Button asChild className="w-full sm:w-auto">
          <Link to="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
