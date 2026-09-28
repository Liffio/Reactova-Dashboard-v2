import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  chatbotApi,
  chatbotKeys,
  WEEK_DAYS,
  type BusinessHours,
  type WeekDay,
} from "@/lib/api/chatbot-api";
import { isWorkspaceReady } from "@/lib/api/active-workspace";
import { getUserErrorMessage } from "@/lib/user-facing-error";
import { toast } from "@/lib/toast";
import { fieldCls } from "./step-editors";
import { PlanChip, useUpgradeSheet } from "./upgrade";

/**
 * Business hours (`chatbot:business_hours`): the Instagram account's timezone and weekly schedule.
 * Steps can reply differently, or go elsewhere, outside these hours. No hours set means always
 * open. Setting hours is gated; switching them off never is.
 */

const DAY_LABEL: Record<WeekDay, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

const browserZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

const allZones = (): string[] => {
  const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  return intl.supportedValuesOf ? intl.supportedValuesOf("timeZone") : [browserZone(), "UTC"];
};

const summary = (h: BusinessHours): string => {
  const open = WEEK_DAYS.filter((d) => h.schedule[d]?.length);
  if (!open.length) return "Closed every day";
  const first = h.schedule[open[0]][0];
  const same = open.every(
    (d) =>
      h.schedule[d].length === 1 &&
      h.schedule[d][0][0] === first[0] &&
      h.schedule[d][0][1] === first[1],
  );
  const days =
    open.length === 5 && open.join() === "mon,tue,wed,thu,fri"
      ? "Mon–Fri"
      : open.map((d) => DAY_LABEL[d]).join(", ");
  return same ? `${days} ${first[0]}–${first[1]}` : `${days}, varying hours`;
};

export function BusinessHoursBand({
  workspaceId,
  enabled,
  canEdit,
}: {
  workspaceId: string;
  enabled: boolean;
  canEdit: boolean;
}) {
  const openUpgrade = useUpgradeSheet();
  const [editing, setEditing] = useState(false);
  const query = useQuery({
    queryKey: chatbotKeys.businessHours(workspaceId),
    queryFn: () => chatbotApi.businessHours(workspaceId),
    enabled: isWorkspaceReady(workspaceId),
  });
  const state = query.data;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-card">
      <Clock className="h-4 w-4 text-muted-foreground" />
      <span className="font-medium">Business hours</span>
      <span className="flex-1 text-xs text-muted-foreground">
        {state?.hours
          ? `${summary(state.hours)} · ${state.hours.timezone}${state.openNow === null ? "" : state.openNow ? " · Open now" : " · Closed now"}`
          : "Not set, so your chatbots treat every hour as open."}
      </span>
      {!enabled ? (
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary"
          onClick={() =>
            openUpgrade({ capability: "chatbot:business_hours", feature: "Business hours" })
          }
        >
          Set hours <PlanChip capability="chatbot:business_hours" />
        </button>
      ) : (
        canEdit && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditing(true)}
            disabled={!state?.platformAccountId}
          >
            {state?.hours ? "Edit" : "Set hours"}
          </Button>
        )
      )}
      <BusinessHoursDialog
        workspaceId={workspaceId}
        open={editing}
        onOpenChange={setEditing}
        current={state?.hours ?? null}
      />
    </div>
  );
}

type DayRow = { open: boolean; start: string; end: string };

function BusinessHoursDialog({
  workspaceId,
  open,
  onOpenChange,
  current,
}: {
  workspaceId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  current: BusinessHours | null;
}) {
  const queryClient = useQueryClient();
  const zones = useMemo(allZones, []);
  const [timezone, setTimezone] = useState(browserZone());
  const [days, setDays] = useState<Record<WeekDay, DayRow>>(() => blankDays());

  useEffect(() => {
    if (!open) return;
    setTimezone(current?.timezone ?? browserZone());
    setDays(
      current
        ? (Object.fromEntries(
            WEEK_DAYS.map((d) => {
              const first = current.schedule[d]?.[0];
              return [
                d,
                first
                  ? { open: true, start: first[0], end: first[1] }
                  : { open: false, start: "09:00", end: "18:00" },
              ];
            }),
          ) as Record<WeekDay, DayRow>)
        : blankDays(),
    );
  }, [open, current]);

  const done =
    (message: string) => (data: Awaited<ReturnType<typeof chatbotApi.businessHours>>) => {
      queryClient.setQueryData(chatbotKeys.businessHours(workspaceId), data);
      toast.success(message);
      onOpenChange(false);
    };
  const save = useMutation({
    mutationFn: () =>
      chatbotApi.saveBusinessHours(workspaceId, {
        timezone,
        schedule: Object.fromEntries(
          WEEK_DAYS.map((d) => [d, days[d].open ? [[days[d].start, days[d].end]] : []]),
        ) as BusinessHours["schedule"],
      }),
    onSuccess: done("Business hours saved"),
    onError: (e) => toast.error(getUserErrorMessage(e, "Couldn't save business hours.")),
  });
  const clear = useMutation({
    mutationFn: () => chatbotApi.clearBusinessHours(workspaceId),
    onSuccess: done("Business hours switched off"),
    onError: (e) => toast.error(getUserErrorMessage(e, "Couldn't switch business hours off.")),
  });

  const invalid = WEEK_DAYS.some((d) => days[d].open && !(days[d].start < days[d].end));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Business hours</DialogTitle>
          <DialogDescription>
            Steps can send a different reply, or go to a different step, outside these hours. Shared
            by the whole Instagram account.
          </DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
          Timezone
          <select
            className={fieldCls}
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            {(zones.includes(timezone) ? zones : [timezone, ...zones]).map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1.5">
          {WEEK_DAYS.map((d) => (
            <div key={d} className="flex items-center gap-2 text-sm">
              <label className="flex w-20 items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={days[d].open}
                  onChange={(e) =>
                    setDays((x) => ({ ...x, [d]: { ...x[d], open: e.target.checked } }))
                  }
                />
                {DAY_LABEL[d]}
              </label>
              {days[d].open ? (
                <>
                  <input
                    type="time"
                    className={fieldCls}
                    value={days[d].start}
                    aria-label={`${DAY_LABEL[d]} opens`}
                    onChange={(e) =>
                      setDays((x) => ({ ...x, [d]: { ...x[d], start: e.target.value } }))
                    }
                  />
                  <span className="text-muted-foreground">to</span>
                  <input
                    type="time"
                    className={fieldCls}
                    value={days[d].end}
                    aria-label={`${DAY_LABEL[d]} closes`}
                    onChange={(e) =>
                      setDays((x) => ({ ...x, [d]: { ...x[d], end: e.target.value } }))
                    }
                  />
                </>
              ) : (
                <span className="text-xs text-muted-foreground">Closed</span>
              )}
            </div>
          ))}
        </div>
        {invalid && (
          <p className="text-xs text-destructive">
            Each open day needs a closing time after its opening time.
          </p>
        )}
        <div className="mt-2 flex gap-2">
          {current && (
            <Button variant="ghost" disabled={clear.isPending} onClick={() => clear.mutate()}>
              Switch off
            </Button>
          )}
          <Button
            className="ml-auto"
            disabled={invalid || save.isPending}
            onClick={() => save.mutate()}
          >
            Save hours
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function blankDays(): Record<WeekDay, DayRow> {
  return Object.fromEntries(
    WEEK_DAYS.map((d) => [d, { open: !["sat", "sun"].includes(d), start: "09:00", end: "18:00" }]),
  ) as Record<WeekDay, DayRow>;
}
