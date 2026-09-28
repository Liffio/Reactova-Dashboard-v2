import { X } from "lucide-react";

import type { ChatbotStep } from "@/lib/api/chatbot-api";
import { TargetPicker, fieldCls, type ChatbotRef, type StepRef } from "./step-editors";

/**
 * The A/B split step (`chatbot:ab_testing`): 2–4 paths, each taken a share of the time. The shares
 * must add up to 100%; the analytics page shows how many runs went down each path.
 */
type Path = { label?: string; percent: number; stepId: string | null };

export function SplitEditor({
  step,
  onChange,
  ...pick
}: {
  step: ChatbotStep;
  onChange: (config: Record<string, unknown>) => void;
  steps: StepRef[];
  chatbots: ChatbotRef[];
  onNewStep: () => string;
  onJump: (id: string) => void;
}) {
  const paths: Path[] = Array.isArray(step.config.paths) ? (step.config.paths as Path[]) : [];
  const total = paths.reduce((a, p) => a + (Number(p.percent) || 0), 0);
  const set = (next: Path[]) => onChange({ ...step.config, paths: next });
  const letter = (i: number) => String.fromCharCode(65 + i);

  return (
    <div className="flex flex-col gap-2 text-xs">
      {paths.map((p, i) => (
        <div
          key={i}
          className="flex items-center gap-1.5 rounded-[10px] border border-border py-1 pr-1 pl-2"
        >
          <input
            className={`${fieldCls} w-24`}
            value={p.label ?? ""}
            maxLength={40}
            placeholder={`Path ${letter(i)}`}
            aria-label={`Path ${letter(i)} name`}
            onChange={(e) =>
              set(paths.map((x, j) => (j === i ? { ...x, label: e.target.value || undefined } : x)))
            }
          />
          <input
            type="number"
            min={0}
            max={100}
            className={`${fieldCls} w-16`}
            value={p.percent}
            aria-label={`Path ${letter(i)} share`}
            onChange={(e) =>
              set(
                paths.map((x, j) =>
                  j === i
                    ? { ...x, percent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }
                    : x,
                ),
              )
            }
          />
          <span className="text-muted-foreground">%</span>
          <span className="flex-1" />
          <TargetPicker
            value={{ kind: "step", id: p.stepId }}
            onPick={(t) =>
              set(
                paths.map((x, j) =>
                  j === i ? { ...x, stepId: t.kind === "step" ? t.id : null } : x,
                ),
              )
            }
            selfId={step.id}
            allowHuman={false}
            allowEnd
            {...pick}
          />
          {paths.length > 2 && (
            <button
              type="button"
              aria-label={`Remove path ${letter(i)}`}
              onClick={() => set(paths.filter((_, j) => j !== i))}
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      ))}
      <div className="flex items-center gap-2">
        <span
          className={total === 100 ? "text-muted-foreground" : "font-semibold text-destructive"}
        >
          {total === 100
            ? "Shares add up to 100%."
            : `Shares add up to ${total}%. They need to make 100%.`}
        </span>
        {paths.length < 4 && (
          <button
            type="button"
            className="ml-auto font-medium text-primary hover:underline"
            onClick={() => set([...paths, { percent: 0, stepId: null }])}
          >
            + Add a path
          </button>
        )}
      </div>
    </div>
  );
}
