import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Copy, RefreshCw, Send, X } from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCan } from "@/hooks/use-auth";
import { chatbotApi, type ChatbotStep, type WebhookTestResult } from "@/lib/api/chatbot-api";
import { useApp } from "@/state/app-context";
import { cfgStr, newWebhookSecret } from "./model";
import { TargetPicker, fieldCls, type ChatbotRef, type StepRef } from "./step-editors";

/** What a receiver gets, shown so they can build and test their side before anything is live. */
const EXAMPLE_PAYLOAD = `{
  "event": "chatbot.webhook_step",
  "sentAt": "2026-10-01T09:30:00.000Z",
  "chatbot": { "id": "…", "name": "Pricing" },
  "step": { "id": "…", "name": "Send to CRM" },
  "contact": { "id": "…", "igUserId": "1784…", "username": "sam", "displayName": "Sam" },
  "tags": ["VIP"],
  "answers": { "email": "sam@example.com" }
}`;

function describeTest(r: WebhookTestResult): string {
  if (r.status === null) return `Not sent: ${r.error}`;
  if (r.ok) return `Your server answered ${r.status} in ${r.ms} ms.`;
  if (r.status >= 300 && r.status < 400) return `Your server answered ${r.status} (a redirect). Redirects are not followed; use the final address.`;
  return `Your server answered ${r.status}. Deliveries only count as sent on a 2xx.`;
}

/**
 * The Webhook step (`chatbot:webhook_step`): where to POST, the secret that signs each delivery, and
 * where the chat goes next — at once, whether or not the webhook succeeds.
 *
 * The secret exists from the moment the step is added (`newWebhookSecret`), one per step, so it can
 * be copied and a receiver built and tested (the Test button works on an unsaved step) before
 * anything is saved or published. Only people who can edit the chatbot receive it from the server;
 * everyone else sees that it is hidden. The last deliveries are listed so a failing endpoint is
 * visible from the step itself.
 */
export function WebhookEditor({
  step,
  chatbotId,
  onChange,
  ...pick
}: {
  step: ChatbotStep;
  chatbotId: string;
  onChange: (config: Record<string, unknown>) => void;
  steps: StepRef[];
  chatbots: ChatbotRef[];
  onNewStep: () => string;
  onJump: (id: string) => void;
}) {
  const { current } = useApp();
  const canEdit = useCan("chatbot", "update");
  const [copied, setCopied] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [regenerated, setRegenerated] = useState(false);
  const url = cfgStr(step, "url") ?? "";
  const secret = cfgStr(step, "secret");
  const deliveries = useQuery({
    queryKey: ["chatbot-webhook-deliveries", current.id, chatbotId, step.id],
    queryFn: () => chatbotApi.webhookDeliveries(current.id, chatbotId, step.id),
    refetchInterval: 30_000,
  });
  const test = useMutation({
    mutationFn: () =>
      chatbotApi.testWebhook(current.id, chatbotId, {
        url: url.trim(),
        secret: secret ?? "",
        stepId: step.id,
        stepName: step.name,
      }),
  });

  const copy = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context, permissions): the secret is selectable on screen.
    }
  };

  return (
    <div className="flex flex-col gap-3 text-xs">
      <label className="flex flex-col gap-1.5 font-semibold text-muted-foreground">
        Send to
        <input
          className={fieldCls}
          value={url}
          placeholder="https://hooks.example.com/liffio"
          aria-label="Webhook address"
          onChange={(e) => onChange({ ...step.config, url: e.target.value })}
        />
        <span className="font-normal">
          A POST with the person's details, tags and answers, as JSON. Must be https.
        </span>
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="font-semibold text-muted-foreground">Signing secret</span>
        {secret ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1 select-all">
              {secret}
            </code>
            <button type="button" className="inline-flex items-center gap-1 text-primary" onClick={() => void copy()}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy
            </button>
            {canEdit && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                onClick={() => setConfirmRegenerate(true)}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Regenerate
              </button>
            )}
          </div>
        ) : canEdit ? (
          <span className="text-muted-foreground">Created when this step is saved.</span>
        ) : (
          <span className="text-muted-foreground">
            Only people who can edit this chatbot can see the signing secret.
          </span>
        )}
        {regenerated && (
          <span className="text-warning">
            New secret. Your live chatbot keeps signing with the previous one until you publish.
          </span>
        )}
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-muted-foreground">
          <dt>Signature header</dt>
          <dd>
            <code>X-Liffio-Signature: sha256=&lt;hex&gt;</code>
          </dd>
          <dt>Timestamp header</dt>
          <dd>
            <code>X-Liffio-Timestamp: &lt;unix seconds&gt;</code>
          </dd>
          <dt>Algorithm</dt>
          <dd>
            HMAC-SHA256 with this secret over <code>&lt;timestamp&gt;.&lt;raw body&gt;</code>, hex
            encoded. Reject old timestamps to stop replays.
          </dd>
        </dl>
        <details className="text-muted-foreground">
          <summary className="cursor-pointer select-none">Example of what we send</summary>
          <pre className="mt-1.5 overflow-x-auto rounded-md bg-muted p-2 text-[11px] leading-relaxed">
            {EXAMPLE_PAYLOAD}
          </pre>
        </details>
      </div>

      {canEdit && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 font-medium disabled:opacity-50"
              disabled={!url.trim() || !secret || test.isPending}
              onClick={() => test.mutate()}
            >
              <Send className="h-3.5 w-3.5" /> {test.isPending ? "Sending…" : "Send a test"}
            </button>
            <span className="text-muted-foreground">
              A signed sample with a made-up contact. Works before you save.
            </span>
          </div>
          {test.data && (
            <span className={test.data.ok ? "text-success" : "text-destructive"}>
              {describeTest(test.data)}
            </span>
          )}
          {test.error && (
            <span className="text-destructive">
              {test.error instanceof Error ? test.error.message : "The test could not be sent."}
            </span>
          )}
        </div>
      )}

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

      <div className="flex flex-col gap-1">
        <span className="font-semibold text-muted-foreground">Recent deliveries</span>
        {!deliveries.data?.length ? (
          <span className="text-muted-foreground">
            None yet. They appear here once the chatbot is live.
          </span>
        ) : (
          deliveries.data.slice(0, 5).map((d, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {d.ok ? (
                <Check className="h-3.5 w-3.5 text-success" />
              ) : (
                <X className="h-3.5 w-3.5 text-destructive" />
              )}
              <span className="text-muted-foreground">{new Date(d.at).toLocaleString()}</span>
              <span>
                {d.ok ? `Delivered (${d.status})` : `Failed: ${d.error ?? "unknown error"}`}
              </span>
            </span>
          ))
        )}
      </div>

      <AlertDialog open={confirmRegenerate} onOpenChange={setConfirmRegenerate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate the signing secret?</AlertDialogTitle>
            <AlertDialogDescription>
              Anything already checking signatures from this step with the current secret will
              reject its requests until you give it the new one. Your live chatbot keeps signing
              with the current secret until you publish.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep the current secret</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onChange({ ...step.config, secret: newWebhookSecret() });
                setRegenerated(true);
                test.reset();
              }}
            >
              Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
