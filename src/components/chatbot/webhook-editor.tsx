import { useQuery } from "@tanstack/react-query";
import { Check, Copy, X } from "lucide-react";
import { useState } from "react";

import { chatbotApi, type ChatbotStep } from "@/lib/api/chatbot-api";
import { useApp } from "@/state/app-context";
import { cfgStr } from "./model";
import { TargetPicker, fieldCls, type ChatbotRef, type StepRef } from "./step-editors";

/**
 * The Webhook step (`chatbot:webhook_step`): where to POST, the secret that signs each delivery, and
 * where the chat goes next — at once, whether or not the webhook succeeds. The last deliveries are
 * listed so a failing endpoint is visible from the step itself.
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
  const [copied, setCopied] = useState(false);
  const url = cfgStr(step, "url") ?? "";
  const secret = cfgStr(step, "secret");
  const deliveries = useQuery({
    queryKey: ["chatbot-webhook-deliveries", current.id, chatbotId, step.id],
    queryFn: () => chatbotApi.webhookDeliveries(current.id, chatbotId, step.id),
    refetchInterval: 30_000,
  });

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
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1">{secret}</code>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-primary"
              onClick={() => {
                void navigator.clipboard.writeText(secret);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy
            </button>
          </div>
        ) : (
          <span className="text-muted-foreground">Created when this step is saved.</span>
        )}
        <span className="text-muted-foreground">
          Each request carries <code>X-Liffio-Signature: sha256=…</code>, an HMAC of{" "}
          <code>&lt;X-Liffio-Timestamp&gt;.&lt;body&gt;</code> with this secret.
        </span>
      </div>

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
    </div>
  );
}
