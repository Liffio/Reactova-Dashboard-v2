import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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

const SLOTS = [1, 2, 3, 4];

/** The list page's ice-breaker strip: 4 account-level slots, each starting a chatbot. */
export function IceBreakerBand({
  slots,
  chatbots,
  onEdit,
  canEdit,
}: {
  slots: IceBreakerSlot[];
  chatbots: Array<{ id: string; name: string }>;
  onEdit: () => void;
  canEdit: boolean;
}) {
  const used = slots.filter((s) => s.chatbotId && s.text.trim()).length;
  const failed = slots.find((s) => s.syncError);
  return (
    <section className="rounded-2xl border border-border bg-card px-4.5 py-4">
      <div className="mb-1 flex items-baseline gap-2">
        <h2 className="font-display text-base font-semibold">Ice breakers</h2>
        <span className="text-xs text-muted-foreground">{used} of 4 used</span>
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
        <p className="mb-2 rounded-lg bg-warning-wash px-2.5 py-1.5 text-xs">
          Instagram didn't accept the last update: {failed.syncError}
        </p>
      )}
      <ul className="grid grid-cols-2 gap-x-6 max-md:grid-cols-1">
        {SLOTS.map((n) => {
          const s = slots.find((x) => x.slot === n);
          const bot = s?.chatbotId ? chatbots.find((c) => c.id === s.chatbotId) : undefined;
          return (
            <li
              key={n}
              className="flex min-w-0 items-center gap-2.5 border-t border-border py-2.5 text-[13px]"
            >
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-secondary text-[11px] font-semibold text-muted-foreground">
                {n}
              </span>
              {s?.text.trim() && bot ? (
                <>
                  <span className="min-w-0 flex-1 truncate font-medium">{s.text}</span>
                  <span className="max-w-[45%] truncate text-xs text-muted-foreground">
                    → {bot.name}
                  </span>
                </>
              ) : (
                <span className="flex-1 text-muted-foreground">Empty slot</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
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
            <div key={r.slot} className="grid grid-cols-[26px_1fr] items-start gap-2.5">
              <span className="mt-1.5 grid h-[26px] w-[26px] place-items-center rounded-lg bg-secondary text-xs font-semibold">
                {r.slot}
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
