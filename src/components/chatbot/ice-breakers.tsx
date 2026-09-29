import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { chatbotApi, chatbotKeys, type IceBreakerSlot } from "@/lib/api/chatbot-api";
import { getUserErrorMessage } from "@/lib/user-facing-error";
import { toast } from "@/lib/toast";
import { fieldCls } from "./step-editors";
import { iceBreakerSlotViews } from "@/lib/chatbot/ice-breaker-slots";
import { cn } from "@/lib/utils";

const SLOTS = [1, 2, 3, 4];

/**
 * The list page's ice-breaker panel: 4 account-level slots, each starting a chatbot. Used slots
 * wear the builder's first-step gradient badge and name their chatbot as a chip (the keyword-chip
 * style) that opens it; empty ones are a dashed "Add an ice breaker" that opens the editor.
 */
export function IceBreakerBand({
  slots,
  chatbots,
  onEdit,
  canEdit,
}: {
  slots: IceBreakerSlot[];
  chatbots: Array<{ id: string; name: string; icon?: string | null }>;
  onEdit: () => void;
  canEdit: boolean;
}) {
  const { views, used, full } = iceBreakerSlotViews(slots, chatbots);
  const failed = slots.find((s) => s.syncError);
  return (
    <section className="rounded-2xl border border-border bg-card px-4.5 py-4 shadow-card">
      <div className="mb-1 flex items-center gap-2.5">
        <h2 className="font-display text-base font-semibold">Ice breakers</h2>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums",
            full
              ? "border border-warning-edge bg-warning-wash text-warning-foreground"
              : "bg-secondary text-foreground",
          )}
        >
          {used} of 4 used
        </span>
        {canEdit && (
          <Button size="sm" variant="outline" className="ml-auto" onClick={onEdit}>
            Edit
          </Button>
        )}
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Shown when someone opens a chat with you for the first time. Each one starts a chatbot.
      </p>
      {failed && (
        <p className="mb-3 rounded-lg bg-warning-wash px-2.5 py-1.5 text-xs">
          Instagram didn't accept the last update: {failed.syncError}
        </p>
      )}
      <ul className="grid grid-cols-2 gap-2 max-md:grid-cols-1">
        {views.map((v) => (
          <li key={v.slot} className="min-w-0">
            {v.state === "empty" ? (
              <EmptySlot slot={v.slot} canEdit={canEdit} onEdit={onEdit} />
            ) : (
              <div className="flex min-h-[52px] min-w-0 items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2">
                <SlotBadge n={v.slot} used={v.state === "used"} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium" title={v.text}>
                  {v.text}
                </span>
                {v.state === "used" ? (
                  <Link
                    to="/chatbot/$chatbotId"
                    params={{ chatbotId: v.chatbot.id }}
                    className="inline-flex min-w-0 max-w-[50%] items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium transition-colors hover:text-primary"
                    title={`Open ${v.chatbot.name}`}
                  >
                    {v.chatbot.icon && <span aria-hidden>{v.chatbot.icon}</span>}
                    <span className="truncate">{v.chatbot.name}</span>
                  </Link>
                ) : (
                  <span className="shrink-0 rounded-full border border-warning-edge bg-warning-wash px-2.5 py-1 text-xs font-medium text-warning-foreground">
                    Pick a chatbot
                  </span>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The builder's step marker: the brand gradient when the slot is in use, muted grey when not. */
function SlotBadge({ n, used }: { n: number; used: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid h-7 w-7 shrink-0 place-items-center rounded-[11px] text-xs font-semibold",
        used ? "bg-brand-gradient text-white" : "bg-secondary text-muted-foreground",
      )}
    >
      {n}
    </span>
  );
}

function EmptySlot({
  slot,
  canEdit,
  onEdit,
}: {
  slot: number;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const inner = (
    <>
      <SlotBadge n={slot} used={false} />
      <span className="flex-1 text-[13px] font-medium">Add an ice breaker</span>
      <Plus className="h-4 w-4" aria-hidden />
    </>
  );
  const cls =
    "flex min-h-[52px] w-full min-w-0 items-center gap-2.5 rounded-xl border border-dashed border-border px-3 py-2 text-left text-muted-foreground";
  return canEdit ? (
    <button
      type="button"
      onClick={onEdit}
      className={cn(cls, "transition-colors hover:border-primary hover:text-primary")}
      aria-label={`Add an ice breaker in slot ${slot}`}
    >
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function IceBreakerSheet({
  workspaceId,
  open,
  onOpenChange,
  slots,
  chatbots,
}: {
  workspaceId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  slots: IceBreakerSlot[];
  chatbots: Array<{ id: string; name: string }>;
}) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState(SLOTS.map((n) => ({ slot: n, text: "", chatbotId: "" })));
  useEffect(() => {
    if (open)
      setRows(
        SLOTS.map((n) => {
          const s = slots.find((x) => x.slot === n);
          return { slot: n, text: s?.text ?? "", chatbotId: s?.chatbotId ?? "" };
        }),
      );
  }, [open, slots]);

  const save = useMutation({
    mutationFn: () =>
      chatbotApi.saveIceBreakers(
        workspaceId,
        rows
          .filter((r) => r.text.trim())
          .map((r) => ({ slot: r.slot, text: r.text.trim(), chatbotId: r.chatbotId || null })),
      ),
    onSuccess: (res) => {
      queryClient.setQueryData(chatbotKeys.ice(workspaceId), {
        platformAccountId: res.platformAccountId,
        slots: res.slots,
      });
      if (res.sync.ok) toast.success("Ice breakers updated on Instagram");
      else
        toast.warning(
          `Saved, but Instagram didn't accept them: ${res.sync.error ?? "unknown error"}`,
        );
      onOpenChange(false);
    },
    onError: (e) => toast.error(getUserErrorMessage(e, "Couldn't save the ice breakers.")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ice breakers</DialogTitle>
          <DialogDescription>
            Up to 4 questions people see when they open a chat with you for the first time. Each one
            starts a chatbot. Shared by the whole Instagram account.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {rows.map((r, i) => (
            <div key={r.slot} className="grid grid-cols-[28px_1fr] items-start gap-2.5">
              <span className="mt-1">
                <SlotBadge n={r.slot} used={!!(r.text.trim() && r.chatbotId)} />
              </span>
              <div className="grid min-w-0 grid-cols-2 gap-1.5 max-md:grid-cols-1">
                <input
                  className={fieldCls}
                  maxLength={80}
                  value={r.text}
                  placeholder="Question, e.g. What are your prices?"
                  aria-label={`Ice breaker ${r.slot} question`}
                  onChange={(e) =>
                    setRows(rows.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))
                  }
                />
                <select
                  className={fieldCls}
                  value={r.chatbotId}
                  aria-label="Chatbot it starts"
                  onChange={(e) =>
                    setRows(rows.map((x, j) => (j === i ? { ...x, chatbotId: e.target.value } : x)))
                  }
                >
                  <option value="">Starts which chatbot?</option>
                  {chatbots.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
        <Button className="w-full" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : "Done"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
