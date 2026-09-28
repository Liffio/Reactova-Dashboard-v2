import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getNotificationPreferences,
  updateNotificationPreference,
  type NotificationChannel,
  type NotificationPreference,
} from "@/lib/api/notifications-api";
import { useApp } from "@/state/app-context";
import { getUserErrorMessage } from "@/lib/user-facing-error";
import { toast } from "@/lib/toast";
import { SettingsCard } from "../components";

/** Column order and labels for the channel toggles; which ones a row shows comes from the API. */
const CHANNEL_COLUMNS: { id: NotificationChannel; label: string }[] = [
  { id: "in_app", label: "In app" },
  { id: "email", label: "Email" },
];

/**
 * Settings → Notifications (plan/settings-revamp.md). Preferences are per workspace AND per user,
 * so there is a workspace picker. Rows and their grouping come from the server's catalog
 * (`category` / `categoryLabel`); nothing about which types exist lives here. Saves are
 * optimistic and roll back on error. A member with only `workspace:read` can change their own.
 */
export function NotificationsTab() {
  const { workspaces, current } = useApp();
  const [workspaceId, setWorkspaceId] = useState(current.id);
  const queryClient = useQueryClient();
  const queryKey = ["notification-preferences", workspaceId];

  const prefs = useQuery({
    queryKey,
    queryFn: () => getNotificationPreferences(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const update = useMutation({
    mutationFn: (p: { type: string; channels: NotificationChannel[] }) =>
      updateNotificationPreference(workspaceId, {
        type: p.type,
        isEnabled: p.channels.length > 0,
        channels: p.channels,
      }),
    onMutate: async (p) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<{ preferences: NotificationPreference[] }>(
        queryKey,
      );
      queryClient.setQueryData<{ preferences: NotificationPreference[] }>(queryKey, (old) =>
        old
          ? {
              preferences: old.preferences.map((row) =>
                row.type === p.type
                  ? { ...row, channels: p.channels, isEnabled: p.channels.length > 0 }
                  : row,
              ),
            }
          : old,
      );
      return { previous };
    },
    onError: (e, _p, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
      toast.error(getUserErrorMessage(e));
    },
  });

  const groups = useMemo(() => {
    const map = new Map<string, NotificationPreference[]>();
    for (const row of prefs.data?.preferences ?? []) {
      const key = row.categoryLabel ?? row.category ?? "Other";
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    return Array.from(map.entries());
  }, [prefs.data]);

  const workspaceName = workspaces.find((w) => w.id === workspaceId)?.name ?? current.name;

  const toggle = (row: NotificationPreference, channel: NotificationChannel, on: boolean) => {
    const available = row.availableChannels ?? CHANNEL_COLUMNS.map((c) => c.id);
    const currentOn = row.isEnabled ? (row.channels ?? available) : [];
    const next = on
      ? Array.from(new Set([...currentOn, channel]))
      : currentOn.filter((c) => c !== channel);
    update.mutate({ type: row.type, channels: available.filter((c) => next.includes(c)) });
  };

  return (
    <SettingsCard
      title="What you hear about"
      description={`Per workspace. You're editing ${workspaceName}.`}
      actions={
        workspaces.length > 1 ? (
          <Select value={workspaceId} onValueChange={setWorkspaceId}>
            <SelectTrigger className="w-56" aria-label="Workspace">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {workspaces.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : undefined
      }
    >
      <div className="hidden grid-cols-[1fr_repeat(2,5rem)] px-5 py-2 text-xs font-medium text-muted-foreground sm:grid">
        <span>Notification</span>
        {CHANNEL_COLUMNS.map((c) => (
          <span key={c.id} className="text-center">
            {c.label}
          </span>
        ))}
      </div>
      {prefs.isLoading && (
        <div className="space-y-2 px-5 py-4">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-2/3" />
        </div>
      )}
      {prefs.error && (
        <p className="px-5 py-4 text-sm text-destructive">{getUserErrorMessage(prefs.error)}</p>
      )}
      {groups.map(([group, rows]) => (
        <div key={group}>
          <p className="bg-muted/40 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {group}
          </p>
          {rows.map((row) => {
            const available = row.availableChannels ?? CHANNEL_COLUMNS.map((c) => c.id);
            const on = row.isEnabled ? (row.channels ?? available) : [];
            return (
              <div
                key={row.type}
                className="grid grid-cols-[1fr_repeat(2,5rem)] items-center px-5 py-3"
              >
                <span className="text-sm">{row.label}</span>
                {CHANNEL_COLUMNS.map((c) => (
                  <div key={c.id} className="flex justify-center">
                    {available.includes(c.id) ? (
                      <Switch
                        aria-label={`${row.label} — ${c.label}`}
                        checked={on.includes(c.id)}
                        onCheckedChange={(v) => toggle(row, c.id, v)}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </SettingsCard>
  );
}
