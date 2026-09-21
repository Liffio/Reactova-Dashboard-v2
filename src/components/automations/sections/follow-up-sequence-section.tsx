import { Plus, Repeat, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LIMITS } from "@/lib/validation";
import { cn } from "@/lib/utils";
import type { FollowUpDraft } from "../automation-form";
import { SectionTitle } from "./section-title";
import { DELAY_OPTIONS, MAX_FOLLOW_UPS } from "./follow-up-options";

/**
 * The follow-up DM sequence, on its own. (A2)
 *
 * Split out of the old "Audience growth" section, which held this and the follow gate together
 * under one heading that had to be vague enough to describe both. See `follow-before-dm-section`
 * for the rest of that reasoning.
 *
 * **No behaviour change.** Same rows, same delay list, same 10-step ceiling, same character limit.
 * The only difference is that the step list is now addressed by index rather than reaching into a
 * form object, so the post scheduler can pass its own array (A4).
 */
export function FollowUpSequenceSection({
  value,
  onChange,
  highlighted = false,
  className,
}: {
  value: FollowUpDraft[];
  onChange: (next: FollowUpDraft[]) => void;
  highlighted?: boolean;
  className?: string;
}) {
  const patch = (id: string, fields: Partial<FollowUpDraft>) =>
    onChange(value.map((x) => (x.id === id ? { ...x, ...fields } : x)));

  return (
    <section
      className={cn(
        "space-y-4 rounded-2xl border bg-card p-5 shadow-soft transition-shadow",
        highlighted && "ring-2 ring-primary/60 animate-pulse",
        className,
      )}
    >
      <SectionTitle
        icon={Repeat}
        title="Follow-up sequence"
        subtitle="Re-engage automatically after the first message."
      />
      <div>
        <p className="text-sm font-medium">Follow-up sequence</p>
        <p className="text-xs text-muted-foreground">
          Up to {MAX_FOLLOW_UPS} timed follow-up DMs after the first message.
        </p>
      </div>
      <div className="space-y-3">
        {value.map((f, i) => (
          <div key={f.id} className="rounded-xl border bg-background p-3.5">
            <div className="mb-2.5 flex items-center gap-2">
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                Step {i + 1}
              </Badge>
              <span className="text-xs text-muted-foreground">Wait</span>
              <Select
                value={String(f.delayMinutes)}
                onValueChange={(v) => patch(f.id, { delayMinutes: Number(v) })}
              >
                <SelectTrigger className="h-7 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DELAY_OPTIONS.map((d) => (
                    <SelectItem key={d.minutes} value={String(d.minutes)}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x.id !== f.id))}
                className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <Textarea
              value={f.message}
              onChange={(e) =>
                patch(f.id, { message: e.target.value.slice(0, LIMITS.followUpMessage.max) })
              }
              maxLength={LIMITS.followUpMessage.max}
              rows={2}
              placeholder="Type your follow-up message…"
            />
          </div>
        ))}
        {value.length < MAX_FOLLOW_UPS && (
          <Button
            type="button"
            variant="outline"
            className="w-full border-dashed"
            onClick={() =>
              onChange([...value, { id: `f${Date.now()}`, delayMinutes: 1440, message: "" }])
            }
          >
            <Plus className="h-4 w-4" /> Add follow-up step
          </Button>
        )}
      </div>
    </section>
  );
}
