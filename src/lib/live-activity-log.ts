import type { WorkspaceEventPayload } from "@/lib/socket";

/**
 * A bounded, in-memory tail of workspace events, written by `useWorkspaceEvents` and read by the
 * dashboard's live feed.
 *
 * A module singleton rather than a hook that opens its own socket listener, for the reason the
 * hook's own docs warn about: two mounts register two `workspace:event` handlers and every event
 * is processed twice. There is exactly one writer — the hook, mounted once in `AppLayout` — and
 * any number of readers.
 *
 * Nothing here is persisted. A reload starts from the server's `activityFeed`, which is the
 * authoritative history; this only holds what has arrived since the page opened.
 */

export type LiveActivityKind = "dm" | "lead" | "click" | "failure";

export type LiveActivityEntry = {
  id: string;
  kind: LiveActivityKind;
  title: string;
  subtitle: string | null;
  at: string;
  /** True for rows that arrived over the socket, so the feed can animate only those. */
  live: boolean;
};

/** Roughly two screens' worth. The feed shows ~8; the rest is headroom for a burst. */
const MAX_ENTRIES = 40;

let entries: LiveActivityEntry[] = [];
let currentWorkspaceId: string | null = null;
const listeners = new Set<() => void>();

const emit = () => {
  for (const l of listeners) l();
};

export function subscribeLiveActivity(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLiveActivitySnapshot(): LiveActivityEntry[] {
  return entries;
}

/**
 * Drop everything on a workspace switch. Without this the feed would show the previous tenant's
 * rows until the next event arrived — cosmetic, but it is exactly the kind of cross-tenant bleed
 * that is worth never letting start.
 */
export function resetLiveActivity(workspaceId: string | null): void {
  if (currentWorkspaceId === workspaceId) return;
  currentWorkspaceId = workspaceId;
  entries = [];
  emit();
}

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;

/**
 * Turn a projected row into a sentence.
 *
 * The projection is decided server-side per access level, so any given field may be absent for
 * this session. Every branch therefore degrades to something readable rather than rendering
 * `undefined` at the user.
 */
function describe(payload: WorkspaceEventPayload): LiveActivityEntry | null {
  const d = payload.data ?? {};
  const at = str(d.createdAt) ?? str(d.capturedAt) ?? str(d.clickedAt) ?? new Date().toISOString();
  const handle = str(d.igUsername) ?? str(d.recipientIgId);
  const automation = str(d.automationName) ?? str(d.name);

  switch (payload.resource) {
    case "dm": {
      const status = str(d.status);
      if (status === "FAILED") {
        return {
          id: `dm-${payload.id}`,
          kind: "failure",
          title: handle ? `Couldn't reach @${handle}` : "A DM could not be delivered",
          // Expired 24-hour reply windows are the common cause and have no surface anywhere else
          // in the product, so the reason is the point of the row, not a detail.
          subtitle: str(d.error) ?? "Delivery failed",
          at,
          live: true,
        };
      }
      return {
        id: `dm-${payload.id}`,
        kind: "dm",
        title: handle ? `DM sent to @${handle}` : "DM sent",
        subtitle: automation,
        at,
        live: true,
      };
    }
    case "lead":
      return {
        id: `lead-${payload.id}`,
        kind: "lead",
        title: handle ? `@${handle} left contact details` : "Lead captured",
        subtitle: str(d.keyword) ?? automation,
        at,
        live: true,
      };
    default:
      // Automations and scheduled posts are edits, not activity — they belong in their own lists.
      return null;
  }
}

export function recordLiveActivity(payload: WorkspaceEventPayload): void {
  if (payload.t !== "push" || !payload.data) return;
  const entry = describe(payload);
  if (!entry) return;
  // Same id twice means an update to a row already shown (a DM going QUEUED → SENT, say). Replace
  // it in place instead of stacking two rows describing one thing.
  entries = [entry, ...entries.filter((e) => e.id !== entry.id)].slice(0, MAX_ENTRIES);
  emit();
}
