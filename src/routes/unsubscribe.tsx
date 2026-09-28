import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle, Loader2, MailX, XCircle } from "lucide-react";
import { toast } from "@/lib/toast";

import { AuthShell } from "@/components/auth/auth-shell";
import { useMounted } from "@/components/auth/guards";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  UNSUBSCRIBE_REASONS,
  describeUnsubscribe,
  resubscribe,
  submitUnsubscribe,
  submitUnsubscribeReason,
  type UnsubscribeReason,
  type UnsubscribeScope,
} from "@/lib/api/email-unsubscribe-api";

type UnsubscribeSearch = { token?: string };

/**
 * Public page behind the footer link in notification emails (plan/email-unsubscribe.md).
 * No login: the signed token in the URL is the only credential, and it can only switch email
 * off/on for the one user and workspace it was minted for.
 */
export const Route = createFileRoute("/unsubscribe")({
  validateSearch: (search: Record<string, unknown>): UnsubscribeSearch => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  head: () => ({
    meta: [{ title: "Email preferences — Liffio" }, { name: "robots", content: "noindex" }],
  }),
  component: UnsubscribePage,
});

const REASON_TEXT_MAX = 500;

function UnsubscribePage() {
  const { token } = Route.useSearch();
  const mounted = useMounted();

  const describeQuery = useQuery({
    queryKey: ["email-unsubscribe", token],
    queryFn: () => describeUnsubscribe(token!),
    enabled: mounted && !!token,
    retry: false,
  });

  const [scope, setScope] = useState<UnsubscribeScope>("type");
  const [reason, setReason] = useState<UnsubscribeReason | "">("");
  const [reasonText, setReasonText] = useState("");
  const [done, setDone] = useState<{
    eventId: string;
    scope: UnsubscribeScope;
    gaveReason: boolean;
  } | null>(null);
  const [resubscribed, setResubscribed] = useState(false);
  const [reasonSent, setReasonSent] = useState(false);

  const unsubscribeMutation = useMutation({
    mutationFn: () =>
      submitUnsubscribe({
        token: token!,
        scope,
        reason: reason || null,
        reasonText: reason ? reasonText.trim() || null : null,
      }),
    onSuccess: (result) => {
      setDone({ eventId: result.eventId, scope, gaveReason: !!reason });
      setResubscribed(false);
    },
    onError: (err) =>
      toast.error((err as Error).message || "Couldn't unsubscribe. Please try again."),
  });

  const reasonMutation = useMutation({
    mutationFn: () =>
      submitUnsubscribeReason({
        token: token!,
        eventId: done!.eventId,
        reason: reason as UnsubscribeReason,
        reasonText: reasonText.trim() || null,
      }),
    onSuccess: () => setReasonSent(true),
    onError: (err) => toast.error((err as Error).message || "Couldn't send your feedback."),
  });

  const resubscribeMutation = useMutation({
    mutationFn: () => resubscribe({ token: token!, scope: done?.scope ?? "type" }),
    onSuccess: () => setResubscribed(true),
    onError: (err) =>
      toast.error((err as Error).message || "Couldn't resubscribe. Please try again."),
  });

  if (!mounted) return null;

  if (!token || describeQuery.isError) {
    return (
      <AuthShell maxWidth="sm" aside={null}>
        <div className="flex flex-col items-center gap-3 text-center">
          <XCircle className="h-12 w-12 text-destructive" />
          <h1 className="font-display text-xl font-semibold">This link isn't valid</h1>
          <p className="text-sm text-muted-foreground">
            The unsubscribe link is incomplete or no longer valid. You can still manage every email
            from Settings → Notifications after signing in.
          </p>
          <Button asChild variant="outline" className="mt-2 w-full">
            <Link to="/settings/notifications">Open notification settings</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  if (describeQuery.isLoading || !describeQuery.data) {
    return (
      <AuthShell maxWidth="sm" aside={null}>
        <div className="flex flex-col items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AuthShell>
    );
  }

  const info = describeQuery.data;
  const whatLabel = (s: UnsubscribeScope) =>
    s === "type" ? `“${info.typeLabel}” emails` : `all optional emails from ${info.workspaceName}`;

  if (done && resubscribed) {
    return (
      <AuthShell maxWidth="sm" aside={null}>
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle className="h-12 w-12 text-primary" />
          <h1 className="font-display text-xl font-semibold">You're subscribed again</h1>
          <p className="text-sm text-muted-foreground">
            {info.email} will receive {whatLabel(done.scope)} again.
          </p>
        </div>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell maxWidth="sm" aside={null}>
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <CheckCircle className="h-12 w-12 text-primary" />
            <h1 className="font-display text-xl font-semibold">You're unsubscribed</h1>
            <p className="text-sm text-muted-foreground">
              {info.email} will no longer receive {whatLabel(done.scope)}. In-app notifications are
              unchanged. Security and billing receipts are still sent.
            </p>
          </div>

          {!done.gaveReason && !reasonSent && (
            <div className="space-y-3 rounded-xl border p-4">
              <p className="text-sm font-medium">Mind telling us why? (optional)</p>
              <ReasonFields
                reason={reason}
                reasonText={reasonText}
                onReason={setReason}
                onReasonText={setReasonText}
              />
              <Button
                className="w-full"
                variant="secondary"
                disabled={!reason || reasonMutation.isPending}
                onClick={() => reasonMutation.mutate()}
              >
                {reasonMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send feedback
              </Button>
            </div>
          )}
          {(done.gaveReason || reasonSent) && (
            <p className="text-center text-sm text-muted-foreground">Thanks for the feedback.</p>
          )}

          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              className="w-full"
              disabled={resubscribeMutation.isPending}
              onClick={() => resubscribeMutation.mutate()}
            >
              {resubscribeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Unsubscribed by mistake? Resubscribe
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link to="/settings/notifications">Manage all notification settings</Link>
            </Button>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell maxWidth="sm" aside={null}>
      <div className="space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-accent">
            <MailX className="h-7 w-7 text-accent-foreground" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold">Unsubscribe</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              For <span className="font-medium text-foreground">{info.email}</span> in{" "}
              <span className="font-medium text-foreground">{info.workspaceName}</span>
            </p>
          </div>
          {!info.subscribed && (
            <p className="text-sm text-muted-foreground">
              You're already unsubscribed from “{info.typeLabel}” emails.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Stop sending me</p>
          <RadioGroup value={scope} onValueChange={(v) => setScope(v as UnsubscribeScope)}>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="type" id="scope-type" />
              <Label htmlFor="scope-type" className="font-normal">
                “{info.typeLabel}” emails only
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="all" id="scope-all" />
              <Label htmlFor="scope-all" className="font-normal">
                All optional emails from {info.workspaceName}
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Why are you unsubscribing? (optional)</p>
          <ReasonFields
            reason={reason}
            reasonText={reasonText}
            onReason={setReason}
            onReasonText={setReasonText}
          />
        </div>

        <Button
          className="w-full"
          disabled={unsubscribeMutation.isPending}
          onClick={() => unsubscribeMutation.mutate()}
        >
          {unsubscribeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Unsubscribe
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          In-app notifications are not affected. Security and billing receipts are always sent.
        </p>
      </div>
    </AuthShell>
  );
}

function ReasonFields(props: {
  reason: UnsubscribeReason | "";
  reasonText: string;
  onReason: (r: UnsubscribeReason) => void;
  onReasonText: (t: string) => void;
}) {
  return (
    <div className="space-y-3">
      <RadioGroup
        value={props.reason}
        onValueChange={(v) => props.onReason(v as UnsubscribeReason)}
      >
        {UNSUBSCRIBE_REASONS.map((r) => (
          <div key={r.value} className="flex items-center gap-2">
            <RadioGroupItem value={r.value} id={`reason-${r.value}`} />
            <Label htmlFor={`reason-${r.value}`} className="font-normal">
              {r.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
      {props.reason && (
        <div className="space-y-1">
          <Textarea
            value={props.reasonText}
            onChange={(e) => props.onReasonText(e.target.value.slice(0, REASON_TEXT_MAX))}
            placeholder={
              props.reason === "other" ? "Tell us a bit more" : "Anything else? (optional)"
            }
            rows={3}
            maxLength={REASON_TEXT_MAX}
          />
          <p className="text-right text-xs text-muted-foreground">
            {props.reasonText.length}/{REASON_TEXT_MAX}
          </p>
        </div>
      )}
    </div>
  );
}
