/**
 * The ONE presentation registry for notification categories and row actions
 * (plan/NOTIFICATIONS §0.3.2 — zero hardcoding).
 *
 * What lives here: how a category *looks* (icon, tile colours) and where an
 * action *goes* (intent → route). Nothing else in the app may map a category
 * or an action type; if a category string appears as a literal in a second
 * file, that is the failure this file exists to prevent.
 *
 * What deliberately does NOT live here: which categories exist, their labels,
 * and their counts. The catalog is open server-side (unknown keys auto-create),
 * so the inventory always arrives from `/notifications/facets` and any key this
 * map has never seen renders through DEFAULT_CATEGORY_STYLE rather than
 * crashing or disappearing.
 */
import {
  Bell,
  CreditCard,
  Handshake,
  MessageCircle,
  PlugZap,
  Send,
  Sparkles,
  Star,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { NotificationItem } from "@/lib/api/notifications-api";

export type CategoryStyle = {
  icon: LucideIcon;
  /** Tile classes; both themes declared together so neither can drift. */
  tile: string;
};

export const DEFAULT_CATEGORY_STYLE: CategoryStyle = {
  icon: Bell,
  tile: "bg-muted text-muted-foreground",
};

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  lead: {
    icon: UserPlus,
    tile: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  },
  automation: {
    icon: Zap,
    tile: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  },
  dm: {
    icon: MessageCircle,
    tile: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400",
  },
  post: {
    icon: Send,
    tile: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400",
  },
  team: {
    icon: Users,
    tile: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
  },
  billing: {
    icon: CreditCard,
    tile: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  },
  affiliate: {
    icon: Handshake,
    tile: "bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400",
  },
  ai: {
    icon: Sparkles,
    tile: "bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-500/15 dark:text-fuchsia-400",
  },
  connection: {
    icon: PlugZap,
    tile: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  },
  creator: {
    icon: Star,
    tile: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400",
  },
  system: DEFAULT_CATEGORY_STYLE,
};

export function categoryStyle(category: string): CategoryStyle {
  return CATEGORY_STYLES[category] ?? DEFAULT_CATEGORY_STYLE;
}

/**
 * Resolves a row's stored intent to a destination and a button label.
 *
 * The server stores `action_type` + `action_payload`, never a URL, so moving a
 * route is a change here and nowhere else — historical rows keep working. An
 * unrecognised intent returns null and the row simply renders without a button.
 */
export type NotificationAction = { label: string; to: string };

type ActionResolver = (payload: Record<string, unknown> | null) => NotificationAction | null;

const str = (payload: Record<string, unknown> | null, key: string): string | null => {
  const value = payload?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
};

const ACTION_RESOLVERS: Record<string, ActionResolver> = {
  open_leads_inbox: () => ({ label: "Open inbox", to: "/leads-captured" }),
  open_automations: () => ({ label: "View automations", to: "/automations" }),
  open_automation: (payload) => {
    const id = str(payload, "automationId");
    return { label: "View automation", to: id ? `/automations?id=${id}` : "/automations" };
  },
  open_scheduler: () => ({ label: "Open scheduler", to: "/scheduler" }),
  open_team: () => ({ label: "View team", to: "/team" }),
  open_billing: () => ({ label: "View billing", to: "/billings" }),
  open_affiliate: () => ({ label: "View affiliate", to: "/affiliate" }),
  open_creator_program: () => ({ label: "View program", to: "/creators-program" }),
  open_connections: () => ({ label: "Reconnect", to: "/settings" }),
  open_ai_tokens: () => ({ label: "View usage", to: "/settings" }),
};

export function resolveNotificationAction(item: NotificationItem): NotificationAction | null {
  if (!item.actionType) return null;
  const resolver = ACTION_RESOLVERS[item.actionType];
  return resolver ? resolver(item.actionPayload) : null;
}

/* ── Time windows ─────────────────────────────────────────────────────────── */

/**
 * Relative windows are resolved to an absolute timestamp at selection time
 * (§2.1): sending "7d" would let the window move under a request that straddles
 * midnight, shifting the keyset window mid-scroll.
 */
export const TIME_RANGES = [
  { id: "any", label: "Any time", ms: null },
  { id: "24h", label: "24 hours", ms: 86_400_000 },
  { id: "7d", label: "7 days", ms: 7 * 86_400_000 },
  { id: "30d", label: "30 days", ms: 30 * 86_400_000 },
] as const;

export type TimeRangeId = (typeof TIME_RANGES)[number]["id"];

export function sinceForRange(id: TimeRangeId): string | null {
  const range = TIME_RANGES.find((r) => r.id === id);
  return range?.ms ? new Date(Date.now() - range.ms).toISOString() : null;
}
