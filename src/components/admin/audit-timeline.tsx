import { useMemo, useState, type ComponentType } from "react";
import { format, formatDistanceToNowStrict, isToday, isYesterday } from "date-fns";
import {
  Activity as ActivityIcon,
  Archive,
  Ban,
  Boxes,
  Building2,
  ChevronDown,
  Coins,
  Gift,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  MailCheck,
  Package as PackageIcon,
  Pencil,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  ShieldCheck,
  ShieldMinus,
  ShieldOff,
  ShieldPlus,
  SlidersHorizontal,
  Unlink,
  UserCog,
  UserMinus,
  X,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/admin/form-page";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { ApiError } from "@/lib/api/http";
import type { AdminUserAuditActorType, AdminUserAuditEntry } from "@/lib/api/admin-users-api";

/** Shared audit row shape — the per-user and per-package trails return the same thing. */
export type AuditTimelineEntry = AdminUserAuditEntry;

type Tone =
  | "create"
  | "update"
  | "delete"
  | "access"
  | "billing"
  | "ai"
  | "module"
  | "impersonation"
  | "admin"
  | "security"
  | "neutral";

/** Full static class strings (never concatenated) so Tailwind keeps them. Colours map to the app's
 *  semantic + chart tokens, so the timeline is correct in both light and dark themes. */
const TONE: Record<Tone, { text: string; bg: string }> = {
  create: { text: "text-success", bg: "bg-success/10" },
  update: { text: "text-primary", bg: "bg-primary/10" },
  delete: { text: "text-destructive", bg: "bg-destructive/10" },
  access: { text: "text-chart-3", bg: "bg-chart-3/10" },
  billing: { text: "text-success", bg: "bg-success/10" },
  ai: { text: "text-chart-4", bg: "bg-chart-4/10" },
  module: { text: "text-chart-1", bg: "bg-chart-1/10" },
  impersonation: { text: "text-warning", bg: "bg-warning/10" },
  admin: { text: "text-chart-5", bg: "bg-chart-5/10" },
  security: { text: "text-warning", bg: "bg-warning/10" },
  neutral: { text: "text-muted-foreground", bg: "bg-muted" },
};

type Descriptor = { label: string; icon: ComponentType<{ className?: string }>; tone: Tone };

/** Known actions → a human verb + icon + tone. Unknown actions fall back to a humanised form of the
 *  raw `verb_object` string, tone-picked from the resource type. Keep the keys in sync with
 *  `auditService` writers. */
const ACTION_MAP: Record<string, Descriptor> = {
  // Packages
  package_create: { label: "Created package", icon: Plus, tone: "create" },
  package_update: { label: "Updated package details", icon: Pencil, tone: "update" },
  package_features_set: {
    label: "Updated package features",
    icon: SlidersHorizontal,
    tone: "update",
  },
  package_limits_set: { label: "Updated package limits", icon: SlidersHorizontal, tone: "update" },
  package_publish: { label: "Published package", icon: Rocket, tone: "billing" },
  package_apply_live: { label: "Applied package live", icon: Rocket, tone: "billing" },
  package_archive: { label: "Archived package", icon: Archive, tone: "delete" },
  // Workspace ↔ package
  workspace_package_assign: {
    label: "Assigned workspace package",
    icon: PackageIcon,
    tone: "access",
  },
  workspace_package_change: {
    label: "Changed workspace package",
    icon: PackageIcon,
    tone: "access",
  },
  workspace_package_clear: {
    label: "Removed workspace package",
    icon: PackageIcon,
    tone: "delete",
  },
  // Access / capabilities
  admin_access_matrix_apply: {
    label: "Updated capability access",
    icon: ShieldCheck,
    tone: "access",
  },
  user_module_overrides_bulk_apply: {
    label: "Updated capability access",
    icon: SlidersHorizontal,
    tone: "access",
  },
  role_permissions_set: { label: "Updated role permissions", icon: ShieldCheck, tone: "access" },
  user_workspace_access_set: {
    label: "Updated workspace access",
    icon: ShieldCheck,
    tone: "access",
  },
  user_workspace_role_change: { label: "Changed workspace role", icon: UserCog, tone: "access" },
  user_membership_remove: { label: "Removed from workspace", icon: UserMinus, tone: "delete" },
  user_module_override_create: {
    label: "Granted module override",
    icon: ShieldPlus,
    tone: "access",
  },
  user_module_override_update: {
    label: "Updated module override",
    icon: ShieldCheck,
    tone: "access",
  },
  user_module_override_remove: {
    label: "Removed module override",
    icon: ShieldMinus,
    tone: "access",
  },
  user_permission_override_create: {
    label: "Granted permission override",
    icon: ShieldPlus,
    tone: "access",
  },
  user_permission_override_update: {
    label: "Updated permission override",
    icon: ShieldCheck,
    tone: "access",
  },
  user_permission_override_remove: {
    label: "Removed permission override",
    icon: ShieldMinus,
    tone: "access",
  },
  user_policy_assign: { label: "Assigned policy", icon: ShieldCheck, tone: "access" },
  user_policy_unassign: { label: "Unassigned policy", icon: ShieldMinus, tone: "access" },
  // AI tokens
  admin_ai_tokens_grant: { label: "Granted AI tokens", icon: Coins, tone: "ai" },
  admin_ai_tokens_adjust: { label: "Adjusted AI tokens", icon: Coins, tone: "ai" },
  admin_ai_tokens_period_reset: { label: "Reset AI token period", icon: RefreshCw, tone: "ai" },
  update_ai_token_plan_config: { label: "Updated AI token plan", icon: Coins, tone: "ai" },
  update_ai_token_global_settings: { label: "Updated AI token settings", icon: Coins, tone: "ai" },
  update_ai_feature_registry: { label: "Updated AI feature metering", icon: Coins, tone: "ai" },
  // Module registry
  module_parent_create: { label: "Created module", icon: Boxes, tone: "module" },
  module_parent_update: { label: "Updated module", icon: Boxes, tone: "module" },
  module_child_create: { label: "Created capability", icon: Boxes, tone: "module" },
  module_child_update: { label: "Updated capability", icon: Boxes, tone: "module" },
  module_child_map: { label: "Linked capability to module", icon: Boxes, tone: "module" },
  module_child_unmap: { label: "Unlinked capability", icon: Boxes, tone: "module" },
  // Billing
  admin_billing_sync: { label: "Synced billing", icon: RefreshCw, tone: "billing" },
  admin_billing_comp: { label: "Comped subscription", icon: Gift, tone: "billing" },
  admin_billing_cancel_at_period_end: {
    label: "Set cancel at period end",
    icon: RefreshCw,
    tone: "billing",
  },
  // API credentials
  admin_api_credential_revoke: {
    label: "Revoked API credential",
    icon: KeyRound,
    tone: "security",
  },
  admin_api_credential_update: { label: "Updated API credential", icon: KeyRound, tone: "update" },
  // Impersonation
  impersonation_start: { label: "Started impersonation", icon: UserCog, tone: "impersonation" },
  impersonation_escalate: {
    label: "Escalated impersonation to write",
    icon: UserCog,
    tone: "impersonation",
  },
  impersonation_end: { label: "Ended impersonation", icon: UserCog, tone: "impersonation" },
  // Platform admin
  platform_admin_grant: { label: "Granted platform admin", icon: ShieldPlus, tone: "admin" },
  platform_admin_regrant: { label: "Re-granted platform admin", icon: ShieldPlus, tone: "admin" },
  platform_admin_scope_update: {
    label: "Updated platform admin scope",
    icon: ShieldCheck,
    tone: "admin",
  },
  platform_admin_revoke: { label: "Revoked platform admin", icon: ShieldMinus, tone: "admin" },
  // User identity / security
  user_profile_update: { label: "Updated profile", icon: Pencil, tone: "update" },
  admin_user_notes_update: { label: "Updated admin notes", icon: Pencil, tone: "neutral" },
  admin_user_ban: { label: "Banned user", icon: Ban, tone: "security" },
  admin_user_unban: { label: "Unbanned user", icon: ShieldCheck, tone: "security" },
  user_deactivate: { label: "Deactivated account", icon: ShieldOff, tone: "security" },
  user_activate: { label: "Activated account", icon: ShieldCheck, tone: "create" },
  user_force_password_reset: { label: "Forced password reset", icon: KeyRound, tone: "security" },
  user_set_password: { label: "Set password", icon: KeyRound, tone: "security" },
  user_sessions_revoke: { label: "Revoked sessions", icon: LogOut, tone: "security" },
  user_mfa_reset: { label: "Reset MFA", icon: ShieldOff, tone: "security" },
  user_verify_email: { label: "Verified email", icon: MailCheck, tone: "update" },
  user_change_email: { label: "Changed email", icon: Mail, tone: "update" },
  user_google_unlink: { label: "Unlinked Google", icon: Unlink, tone: "security" },
  user_resend_verification: { label: "Resent verification email", icon: Mail, tone: "update" },
};

const TONE_BY_RESOURCE: Record<string, Tone> = {
  package: "update",
  workspace_package: "access",
  user_permission_overrides: "access",
  ai_token_plan_config: "ai",
  workspace_token_balance: "ai",
  parent_module: "module",
  child_module: "module",
  impersonation_session: "impersonation",
  platform_admin: "admin",
  workspace_subscription: "billing",
  user_config: "security",
};

function humanize(raw: string): string {
  const spaced = raw
    .replace(/^admin_/, "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function describeAction(action: string, resourceType: string | null): Descriptor {
  const known = ACTION_MAP[action];
  if (known) return known;
  const tone = (resourceType && TONE_BY_RESOURCE[resourceType]) || "neutral";
  return { label: humanize(action), icon: Pencil, tone };
}

const ACTOR_LABEL: Record<AdminUserAuditActorType, string> = {
  user: "User",
  platform_admin: "Admin",
  super_admin: "Super admin",
  impersonation: "Impersonation",
  api_key: "API key",
  system: "System",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const chars = parts.slice(0, 2).map((p) => p[0]);
  return (chars.join("") || name[0] || "?").toUpperCase();
}

function shortId(id: string | null): string {
  return id ? id.slice(0, 8) : "—";
}

/** Best display name for the person who acted. */
function actorLabel(entry: AuditTimelineEntry): string {
  return (
    entry.actorName ||
    entry.actorEmail ||
    (entry.actorUserId ? shortId(entry.actorUserId) : ACTOR_LABEL[entry.actorType])
  );
}

function onBehalfLabel(entry: AuditTimelineEntry): string {
  return entry.onBehalfOfName || entry.onBehalfOfEmail || shortId(entry.onBehalfOfUserId);
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (ISO_RE.test(value)) {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) return format(d, "d MMM yyyy");
    }
    return value.length > 60 ? `${value.slice(0, 60)}…` : value;
  }
  const json = JSON.stringify(value);
  return json.length > 60 ? `${json.slice(0, 60)}…` : json;
}

function isFromTo(v: unknown): v is { from: unknown; to: unknown } {
  return typeof v === "object" && v !== null && ("from" in v || "to" in v);
}

/** Renders `changes` as Toggl-style "field: from → to" pills, falling back to "field: value" for
 *  non-diff shapes. */
function ChangePills({ changes }: { changes: Record<string, unknown> }) {
  const entries = Object.entries(changes);
  if (entries.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {entries.map(([key, value]) => (
        <span
          key={key}
          className="inline-flex flex-wrap items-center gap-1 rounded-md border bg-muted/40 px-1.5 py-0.5 text-[11px]"
        >
          <span className="font-medium text-muted-foreground">{humanize(key)}</span>
          {isFromTo(value) ? (
            <>
              <code className="rounded bg-destructive/10 px-1 text-destructive line-through decoration-destructive/40">
                {formatValue(value.from)}
              </code>
              <span className="text-muted-foreground">→</span>
              <code className="rounded bg-success/10 px-1 text-success">
                {formatValue(value.to)}
              </code>
            </>
          ) : (
            <code className="rounded bg-background px-1 font-mono text-foreground">
              {formatValue(value)}
            </code>
          )}
        </span>
      ))}
    </div>
  );
}

/** Keys we don't surface as loose metadata chips — either already shown elsewhere or internal. */
const METADATA_HIDDEN = new Set(["reason"]);

function MetadataDetails({ entry }: { entry: AuditTimelineEntry }) {
  const [open, setOpen] = useState(false);
  const meta = entry.metadata ?? {};
  const metaEntries = Object.entries(meta).filter(([k]) => !METADATA_HIDDEN.has(k));
  const hasExtra = metaEntries.length > 0 || entry.ipAddress || entry.userAgent || entry.resourceId;
  if (!hasExtra) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        {open ? "Hide details" : "Details"}
      </button>
      {open && (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-muted/30 p-2.5 text-[11px]">
          {entry.resourceId && <DetailRow label="Resource id" value={entry.resourceId} mono />}
          {metaEntries.map(([k, v]) => (
            <DetailRow key={k} label={humanize(k)} value={formatValue(v)} />
          ))}
          {entry.ipAddress && <DetailRow label="IP address" value={entry.ipAddress} mono />}
          {entry.userAgent && <DetailRow label="User agent" value={entry.userAgent} />}
        </dl>
      )}
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("min-w-0 break-words text-foreground", mono && "font-mono")}>{value}</dd>
    </>
  );
}

function ActorAvatar({ entry }: { entry: AuditTimelineEntry }) {
  const label = actorLabel(entry);
  return (
    <Avatar className="h-5 w-5">
      <AvatarFallback className="bg-brand-gradient text-[9px] font-semibold text-primary-foreground">
        {initials(label)}
      </AvatarFallback>
    </Avatar>
  );
}

function TimelineRow({
  entry,
  isLast,
  pageUserId,
}: {
  entry: AuditTimelineEntry;
  isLast: boolean;
  pageUserId?: string;
}) {
  const { label, icon: Icon, tone } = describeAction(entry.action, entry.resourceType);
  const toneCls = TONE[tone];
  const created = new Date(entry.createdAt);
  const isImpersonation = entry.actorType === "impersonation" || Boolean(entry.onBehalfOfUserId);
  // On a USER page, an impersonation row can appear from either side — clarify the direction.
  const pageUserIsActor = pageUserId != null && entry.actorUserId === pageUserId;
  const reason =
    entry.metadata && typeof entry.metadata.reason === "string" ? entry.metadata.reason : null;

  return (
    <li className="relative flex gap-3">
      {!isLast && (
        <span className="absolute left-[15px] top-8 -bottom-1 w-px bg-border" aria-hidden="true" />
      )}
      <div
        className={cn(
          "relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-background",
          toneCls.bg,
        )}
      >
        <Icon className={cn("h-4 w-4", toneCls.text)} />
      </div>

      <div className="min-w-0 flex-1 rounded-xl border bg-card p-3 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="min-w-0">
            <p className="text-sm font-medium leading-snug">{label}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ActorAvatar entry={entry} />
                <span className="font-medium text-foreground">{actorLabel(entry)}</span>
              </span>
              {isImpersonation ? (
                <Badge
                  variant="outline"
                  className="gap-1 border-warning/30 bg-warning/10 text-[10px] text-warning"
                >
                  <UserCog className="h-3 w-3" />
                  {pageUserId != null
                    ? pageUserIsActor
                      ? `impersonating ${onBehalfLabel(entry)}`
                      : "on their account"
                    : `as ${onBehalfLabel(entry)}`}
                </Badge>
              ) : (
                entry.actorType !== "user" && (
                  <Badge
                    variant="outline"
                    className="border-muted-foreground/30 text-[10px] text-muted-foreground"
                  >
                    {ACTOR_LABEL[entry.actorType]}
                  </Badge>
                )
              )}
              {entry.workspaceName && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Building2 className="h-3 w-3 shrink-0" />
                  {entry.workspaceName}
                </span>
              )}
              {entry.resourceType && (
                <span className="font-mono text-[10px] text-muted-foreground/80">
                  {entry.resourceType}
                </span>
              )}
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <time className="shrink-0 cursor-default whitespace-nowrap text-[11px] text-muted-foreground">
                {formatDistanceToNowStrict(created, { addSuffix: true })}
              </time>
            </TooltipTrigger>
            <TooltipContent>{formatDateTime(entry.createdAt)}</TooltipContent>
          </Tooltip>
        </div>

        {reason && (
          <p className="mt-2 border-l-2 border-border pl-2 text-xs italic text-muted-foreground">
            “{reason}”
          </p>
        )}
        {entry.changes && Object.keys(entry.changes).length > 0 && (
          <ChangePills changes={entry.changes} />
        )}
        <MetadataDetails entry={entry} />
      </div>
    </li>
  );
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEE, d MMM yyyy");
}

/** actor-type filter buckets */
const FILTERS: { key: string; label: string; match: (t: AdminUserAuditActorType) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "admin", label: "Admins", match: (t) => t === "platform_admin" || t === "super_admin" },
  { key: "impersonation", label: "Impersonation", match: (t) => t === "impersonation" },
  { key: "user", label: "User", match: (t) => t === "user" },
  { key: "system", label: "System", match: (t) => t === "system" || t === "api_key" },
];

export type AuditTimelineProps = {
  entries: AuditTimelineEntry[];
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => void;
  onRetry?: () => void;
  /** Pass on a USER page so impersonation rows read directionally. Omit for resource-scoped trails. */
  pageUserId?: string;
  emptyTitle?: string;
  emptyHint?: string;
};

export function AuditTimeline({
  entries,
  isLoading,
  isError,
  error,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  onRetry,
  pageUserId,
  emptyTitle = "No activity recorded",
  emptyHint = "Nothing in the audit trail yet.",
}: AuditTimelineProps) {
  const [search, setSearch] = useState("");
  const [actorFilter, setActorFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const bucket = FILTERS.find((f) => f.key === actorFilter) ?? FILTERS[0];
    return entries.filter((e) => {
      if (!bucket.match(e.actorType)) return false;
      if (!q) return true;
      const hay = [
        describeAction(e.action, e.resourceType).label,
        e.action,
        e.actorName,
        e.actorEmail,
        e.resourceType,
        e.resourceId,
        JSON.stringify(e.changes ?? {}),
        JSON.stringify(e.metadata ?? {}),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [entries, search, actorFilter]);

  const groups = useMemo(() => {
    const out: { label: string; items: AuditTimelineEntry[] }[] = [];
    for (const entry of filtered) {
      const label = dayLabel(entry.createdAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(entry);
      else out.push({ label, items: [entry] });
    }
    return out;
  }, [filtered]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <Skeleton className="h-16 flex-1 rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    const requestId = error instanceof ApiError ? error.requestId : undefined;
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-8 text-center">
        <ActivityIcon className="mx-auto mb-2 h-6 w-6 text-destructive" />
        <p className="text-sm font-medium text-destructive">Couldn't load the audit trail.</p>
        {requestId && (
          <p className="mt-1 text-xs text-muted-foreground">
            Request ID: <span className="font-mono">{requestId}</span>
          </p>
        )}
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState icon={ActivityIcon} title={emptyTitle}>
        {emptyHint}
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search actions, people, changes…"
            className="h-8 pl-8 text-sm"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              type="button"
              size="sm"
              variant={actorFilter === f.key ? "secondary" : "ghost"}
              className="h-7 px-2.5 text-xs"
              onClick={() => setActorFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Search} title="No matching activity">
          Nothing in the loaded history matches your filters.
        </EmptyState>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.label}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </h3>
              <ol className="space-y-3">
                {group.items.map((entry, i) => (
                  <TimelineRow
                    key={entry.id}
                    entry={entry}
                    isLast={i === group.items.length - 1}
                    pageUserId={pageUserId}
                  />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}

      {hasNextPage && fetchNextPage && (
        <div className="flex justify-center pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
