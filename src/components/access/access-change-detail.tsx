import { Minus, Plus, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";

/**
 * What actually changed about a user's access, opened from the notification that announced it.
 *
 * The `access:changed` socket modal is transient — a closed tab, a reload, or simply reading the
 * bell later all lose it. The server therefore stores the diff on the notification row, and this
 * renders it on demand. Without it the entry could only ever say "your access has been changed",
 * which tells someone that something they were mid-way through using might be gone but not what.
 */

export type AccessChangeItem = { key: string; label: string; module: string };

export type StoredAccessChanges = {
  added: AccessChangeItem[];
  removed: AccessChangeItem[];
  addedTotal: number;
  removedTotal: number;
  packageName?: string;
};

/**
 * Reads the diff off a notification, or `null` if it carries none.
 *
 * Defensive about shape rather than trusting it: these rows are written by whatever server version
 * was deployed when the notification was created, so an older row legitimately has no diff and must
 * render as "no detail" instead of throwing inside the bell.
 */
export function readAccessChanges(item: {
  metadata?: Record<string, unknown> | null;
}): StoredAccessChanges | null {
  const raw = item.metadata?.accessChanges as StoredAccessChanges | undefined;
  if (!raw || typeof raw !== "object") return null;
  const added = Array.isArray(raw.added) ? raw.added : [];
  const removed = Array.isArray(raw.removed) ? raw.removed : [];
  if (added.length === 0 && removed.length === 0) return null;
  return {
    added,
    removed,
    addedTotal: typeof raw.addedTotal === "number" ? raw.addedTotal : added.length,
    removedTotal: typeof raw.removedTotal === "number" ? raw.removedTotal : removed.length,
    packageName: typeof raw.packageName === "string" ? raw.packageName : undefined,
  };
}

/**
 * The diff, rendered inline.
 *
 * Not a dialog of its own: the notification bell already opens one, and nesting a second would
 * mean two stacked modals to dismiss for one piece of information. Returns nothing when there is
 * no diff, so the caller can drop it in unconditionally.
 */
export function AccessChangeList({ changes }: { changes: StoredAccessChanges | null }) {
  if (!changes) return null;

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-xs font-medium">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
        What changed
        {changes.packageName && (
          <Badge variant="outline" className="ml-1 font-normal">
            {changes.packageName}
          </Badge>
        )}
      </p>
      <div className="max-h-[40vh] space-y-3 overflow-y-auto">
        <ChangeGroup
          tone="add"
          title="Now available"
          items={changes.added}
          total={changes.addedTotal}
        />
        <ChangeGroup
          tone="remove"
          title="No longer available"
          items={changes.removed}
          total={changes.removedTotal}
        />
      </div>
    </div>
  );
}

function ChangeGroup({
  tone,
  title,
  items,
  total,
}: {
  tone: "add" | "remove";
  title: string;
  items: AccessChangeItem[];
  total: number;
}) {
  if (items.length === 0) return null;

  const Icon = tone === "add" ? Plus : Minus;
  const toneClass =
    tone === "add"
      ? "border-emerald-500/40 bg-emerald-500/5"
      : "border-destructive/40 bg-destructive/5";

  // Grouped by module so a change touching one product area reads as one thing rather than a flat
  // list of slugs the user has to mentally cluster themselves.
  const byModule = new Map<string, AccessChangeItem[]>();
  for (const item of items) {
    const list = byModule.get(item.module) ?? [];
    list.push(item);
    byModule.set(item.module, list);
  }

  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium">
        <Icon className="h-3.5 w-3.5" />
        {title}
        <span className="text-muted-foreground">({total})</span>
      </p>
      <div className="space-y-2">
        {[...byModule.entries()].map(([module, moduleItems]) => (
          <div key={module}>
            <p className="text-[11px] font-medium text-muted-foreground">{module}</p>
            <ul className="ml-3 list-disc space-y-0.5">
              {moduleItems.map((item) => (
                <li key={item.key} className="text-sm">
                  {item.label}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {total > items.length && (
        // The row caps how much it stores, so saying "and N more" is honest where silently
        // showing a truncated list would not be.
        <p className="mt-2 text-[11px] text-muted-foreground">
          and {total - items.length} more not shown
        </p>
      )}
    </div>
  );
}
