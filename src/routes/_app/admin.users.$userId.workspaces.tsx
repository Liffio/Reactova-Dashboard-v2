import type { ReactNode } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Check,
  ChevronRight,
  ExternalLink,
  Instagram,
  Link2,
  Minus,
  X,
} from "lucide-react";

import { CopyableKey, EmptyState } from "@/components/admin/form-page";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { bareHandle, formatDate, formatNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/http";
import {
  getAdminUserWorkspaces,
  type AdminUserWorkspaceMembership,
  type AdminWorkspaceInstagram,
} from "@/lib/api/admin-users-api";

/**
 * Workspaces tab — one card per membership: the workspace (status, role, package, plan, billing)
 * beside the Instagram account it has connected. No pagination (memberships are small; the server
 * caps at `ADMIN_USER_WORKSPACES_MAX`). Each card opens the Task 10 access drill-down
 * (`/admin/users/$userId/workspaces/$wsId`) — read-only there too, no mutation reachable from
 * either page.
 *
 * Laid out after the connected-accounts screens of HubSpot, Buffer and Klaviyo (Mobbin): the
 * account is identified by picture + handle with an Instagram mark, a single authorization pill
 * says whether it works, and the reasons sit underneath — what support needs to answer "why are
 * this customer's DMs not sending?" without opening another tool.
 */
export const Route = createFileRoute("/_app/admin/users/$userId/workspaces")({
  head: () => ({ meta: [{ title: "Workspaces — User — Admin" }] }),
  component: WorkspacesTab,
});

/** Same vocabulary/styling as `agency.tsx`'s workspace `statusStyles` and `admin.users.tsx`'s
 *  `WORKSPACE_STATUS_VALUES` filter — duplicated locally per this codebase's existing convention
 *  of small per-file status maps rather than a shared export (see also `billings.tsx`). */
const WORKSPACE_STATUS_STYLES: Record<string, string> = {
  ACTIVE: "border-success/30 bg-success/10 text-success",
  PAUSED: "border-warning/30 bg-warning/10 text-warning",
  SUSPENDED: "border-destructive/30 bg-destructive/10 text-destructive",
  PAYMENT_FAILED: "border-destructive/30 bg-destructive/10 text-destructive",
  INSTAGRAM_DISCONNECTED: "border-warning/30 bg-warning/10 text-warning",
};

/** Same vocabulary/styling as `billings.tsx`'s subscription `statusStyles`. */
const BILLING_STATUS_STYLES: Record<string, string> = {
  ACTIVE: "border-success/30 bg-success/10 text-success",
  PAID: "border-success/30 bg-success/10 text-success",
  PAST_DUE: "border-warning/30 bg-warning/10 text-warning",
  PAYMENT_FAILED: "border-destructive/30 bg-destructive/10 text-destructive",
  CANCELED: "border-border bg-muted text-muted-foreground",
};

/** Same threshold as the tenant topbar's Instagram pill (`instagram-account-pill.tsx`). */
const EXPIRY_WARNING_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** `"INSTAGRAM_DISCONNECTED"` → `"Instagram Disconnected"`. */
function humanizeEnum(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

function WorkspacesTab() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();

  const workspacesQuery = useQuery({
    queryKey: ["admin-user", userId, "workspaces"],
    queryFn: () => getAdminUserWorkspaces(userId),
  });

  if (workspacesQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 rounded-2xl" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (workspacesQuery.isError) {
    const requestId =
      workspacesQuery.error instanceof ApiError ? workspacesQuery.error.requestId : undefined;
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-8 text-center">
        <AlertCircle className="mx-auto mb-2 h-6 w-6 text-destructive" />
        <p className="text-sm font-medium text-destructive">Couldn't load workspaces.</p>
        {requestId && (
          <p className="mt-2 text-xs text-muted-foreground">
            Request ID: <span className="font-mono">{requestId}</span>
          </p>
        )}
      </div>
    );
  }

  const items = workspacesQuery.data?.items ?? [];

  if (items.length === 0) {
    return (
      <EmptyState icon={Building2} title="No workspace memberships">
        This user doesn't belong to any workspace.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <SummaryStrip items={items} />
      <div className="space-y-3">
        {items.map((row) => (
          <WorkspaceCard
            key={row.workspaceId}
            row={row}
            onOpen={() =>
              void navigate({
                to: "/admin/users/$userId/workspaces/$wsId",
                params: { userId, wsId: row.workspaceId },
              })
            }
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Instagram state ─────────────────────────────────────────────────────────────────────── */

type Tone = "success" | "warning" | "danger" | "muted";

const TONE_PILL: Record<Tone, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

/**
 * One verdict for the pill plus the reasons behind it.
 *
 * Only a definite `false` counts as a missing permission: `null` means Instagram never told us
 * (see `lib/instagramConnectionHealth.ts` on the server), and flagging that as broken would send
 * support chasing a reconnect for nothing.
 */
function instagramVerdict(ig: AdminWorkspaceInstagram): {
  label: string;
  tone: Tone;
  issues: string[];
} {
  if (ig.status === "disconnected") return { label: "Disconnected", tone: "muted", issues: [] };

  const issues: string[] = [];
  const msLeft = ig.tokenExpiresAt ? new Date(ig.tokenExpiresAt).getTime() - Date.now() : null;
  const expired = msLeft !== null && msLeft <= 0;
  if (expired) issues.push("Access token expired");
  else if (msLeft !== null && msLeft < EXPIRY_WARNING_DAYS * DAY_MS) {
    issues.push(`Token expires in ${Math.ceil(msLeft / DAY_MS)} day(s)`);
  }
  if (ig.health.hasMessagingPermission === false) issues.push("Missing messaging permission");
  if (ig.health.hasCommentPermission === false) issues.push("Missing comment permission");
  if (ig.health.webhookSubscribed === false) issues.push("Webhook not subscribed");
  if (ig.restriction?.safetyCapUntil) issues.push("Send rate reduced by safety cap");
  if (ig.restriction && ig.restriction.abuseWarnings > 0) {
    issues.push(`${ig.restriction.abuseWarnings} Meta abuse warning(s)`);
  }

  if (ig.restriction?.restrictedUntil) {
    return { label: "Restricted", tone: "danger", issues: ["Meta is blocking sends", ...issues] };
  }
  if (expired) return { label: "Token expired", tone: "danger", issues };
  if (issues.length > 0) return { label: "Needs attention", tone: "warning", issues };
  return { label: "Connected", tone: "success", issues };
}

/* ─── Summary ─────────────────────────────────────────────────────────────────────────────── */

function SummaryStrip({ items }: { items: AdminUserWorkspaceMembership[] }) {
  const connected = items.filter((w) => w.instagram?.status === "connected");
  const attention = connected.filter((w) => instagramVerdict(w.instagram!).tone !== "success");
  const accounts = new Set(connected.map((w) => w.instagram!.igUserId)).size;
  const none = items.length - connected.length;

  const stats: Array<{ label: string; value: number; tone?: Tone; hint?: string }> = [
    { label: "Workspaces", value: items.length },
    {
      label: "Instagram connected",
      value: connected.length,
      hint: accounts < connected.length ? `${accounts} distinct account(s) across them` : undefined,
    },
    {
      label: "Needs attention",
      value: attention.length,
      tone: attention.length ? "warning" : undefined,
    },
    { label: "No Instagram", value: none },
  ];

  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-2xl border bg-card shadow-soft md:grid-cols-4">
      {stats.map((s, i) => (
        <div
          key={s.label}
          title={s.hint}
          className={cn(
            "p-4",
            i % 2 === 1 && "border-l",
            i >= 2 && "border-t md:border-t-0",
            i === 2 && "md:border-l",
          )}
        >
          <p className="text-xs text-muted-foreground">{s.label}</p>
          <p
            className={cn(
              "mt-1 text-2xl font-semibold tabular-nums",
              s.tone === "warning" && "text-warning",
            )}
          >
            {s.value}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ─── Workspace card ──────────────────────────────────────────────────────────────────────── */

function WorkspaceCard({ row, onOpen }: { row: AdminUserWorkspaceMembership; onOpen: () => void }) {
  const billingStatus = row.subscription?.billingStatus;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group grid cursor-pointer gap-4 rounded-2xl border bg-card p-4 shadow-soft transition-colors hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_auto] md:items-center"
    >
      {/* Workspace */}
      <div className="min-w-0 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <Building2 className="h-4 w-4" />
          </span>
          <span className="truncate font-medium">{row.workspaceName}</span>
          <Badge
            variant="outline"
            className={cn("text-[10px]", WORKSPACE_STATUS_STYLES[row.workspaceStatus] ?? "")}
          >
            {humanizeEnum(row.workspaceStatus)}
          </Badge>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4 md:grid-cols-2 xl:grid-cols-4">
          <Meta label="Role">{row.role?.name ?? "—"}</Meta>
          <Meta label="Package">
            {row.unrestricted ? (
              <span className="text-chart-3">Unrestricted</span>
            ) : (
              (row.package?.name ?? "—")
            )}
          </Meta>
          <Meta label="Plan">{row.subscription?.plan ?? "—"}</Meta>
          <Meta label="Billing">
            {billingStatus ? (
              <Badge
                variant="outline"
                className={cn(
                  "px-1.5 py-0 text-[10px]",
                  BILLING_STATUS_STYLES[billingStatus.toUpperCase()] ?? "",
                )}
              >
                {humanizeEnum(billingStatus)}
              </Badge>
            ) : (
              "—"
            )}
          </Meta>
        </dl>
        <p className="text-[11px] text-muted-foreground">Joined {formatDate(row.joinedAt)}</p>
      </div>

      {/* Instagram */}
      <InstagramPanel ig={row.instagram} />

      <ChevronRight className="hidden h-4 w-4 text-muted-foreground/50 transition-colors group-hover:text-foreground md:block" />
    </div>
  );
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{children}</dd>
    </div>
  );
}

/* ─── Instagram panel ─────────────────────────────────────────────────────────────────────── */

function InstagramPanel({ ig }: { ig: AdminWorkspaceInstagram | null }) {
  if (!ig) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed px-3 py-3 text-xs text-muted-foreground">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted">
          <Instagram className="h-4 w-4" />
        </span>
        No Instagram account connected
      </div>
    );
  }

  const verdict = instagramVerdict(ig);
  const handle = bareHandle(ig.username) ?? ig.username;
  const live = ig.status === "connected";

  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border bg-muted/30 p-3",
        verdict.tone === "danger" && "border-destructive/30",
        verdict.tone === "warning" && "border-warning/40",
      )}
    >
      <div className="flex items-center gap-3">
        <IgAvatar src={ig.profilePictureUrl} dimmed={!live} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <a
              href={`https://www.instagram.com/${encodeURIComponent(handle)}/`}
              target="_blank"
              rel="noreferrer noopener"
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "inline-flex min-w-0 items-center gap-1 truncate text-sm font-semibold hover:underline",
                !live && "text-muted-foreground",
              )}
            >
              <span className="truncate">@{handle}</span>
              <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
            </a>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {[
              ig.followerCount != null ? `${formatNum(ig.followerCount)} followers` : null,
              `${live ? "Connected" : "Was connected"} ${formatDate(ig.connectedAt)}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium",
            TONE_PILL[verdict.tone],
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {verdict.label}
        </span>
      </div>

      {live && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <HealthChip
            label="DMs"
            value={ig.health.hasMessagingPermission}
            verified={ig.health.permissionsVerified}
          />
          <HealthChip
            label="Comments"
            value={ig.health.hasCommentPermission}
            verified={ig.health.permissionsVerified}
          />
          <HealthChip label="Webhook" value={ig.health.webhookSubscribed} verified />
          <TokenChip expiresAt={ig.tokenExpiresAt} />
        </div>
      )}

      {verdict.issues.length > 0 && (
        <ul className="mt-2.5 space-y-1">
          {verdict.issues.map((issue) => (
            <li
              key={issue}
              className={cn(
                "flex items-start gap-1.5 text-[11px]",
                verdict.tone === "danger" ? "text-destructive" : "text-warning",
              )}
            >
              <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
              {issue}
              {issue === "Meta is blocking sends" && ig.restriction?.restrictedUntil
                ? ` until ${formatDate(ig.restriction.restrictedUntil)}`
                : ""}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t pt-2">
        <span onClick={(e) => e.stopPropagation()} className="min-w-0">
          <CopyableKey value={ig.igUserId} className="max-w-full text-[10px]" />
        </span>
        {ig.sharedWithWorkspaces > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Link2 className="h-3 w-3" />
            Also in {ig.sharedWithWorkspaces} other workspace
            {ig.sharedWithWorkspaces === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </div>
  );
}

/** Profile picture with the Instagram mark in the corner — the Buffer/HubSpot channel avatar. */
function IgAvatar({ src, dimmed }: { src: string | null; dimmed: boolean }) {
  return (
    <span className={cn("relative shrink-0", dimmed && "opacity-60 grayscale")}>
      {src ? (
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          className="h-10 w-10 rounded-full object-cover ring-1 ring-border"
        />
      ) : (
        <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-gradient text-primary-foreground">
          <Instagram className="h-4 w-4" />
        </span>
      )}
      <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full border-2 border-card bg-brand-gradient text-primary-foreground">
        <Instagram className="h-2 w-2" />
      </span>
    </span>
  );
}

/** A yes / no / unknown capability. Unknown is shown as unknown — never as a failure. */
function HealthChip({
  label,
  value,
  verified,
}: {
  label: string;
  value: boolean | null;
  verified: boolean;
}) {
  const state = value === true ? "ok" : value === false ? "missing" : "unknown";
  const tip =
    state === "ok"
      ? `${label}: granted`
      : state === "missing"
        ? `${label}: not granted — the account must reconnect`
        : verified
          ? `${label}: no record yet`
          : `${label}: Instagram didn't report permissions for this connection`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
            state === "ok" && "border-success/30 text-success",
            state === "missing" && "border-destructive/30 bg-destructive/5 text-destructive",
            state === "unknown" && "text-muted-foreground",
          )}
        >
          {state === "ok" ? (
            <Check className="h-3 w-3" />
          ) : state === "missing" ? (
            <X className="h-3 w-3" />
          ) : (
            <Minus className="h-3 w-3" />
          )}
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}

function TokenChip({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        <Minus className="h-3 w-3" /> Token
      </span>
    );
  }
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / DAY_MS);
  const tone = days <= 0 ? "danger" : days < EXPIRY_WARNING_DAYS ? "warning" : "ok";
  return (
    <span
      title={`Access token expires ${formatDate(expiresAt)}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
        tone === "ok" && "border-success/30 text-success",
        tone === "warning" && "border-warning/40 bg-warning/5 text-warning",
        tone === "danger" && "border-destructive/30 bg-destructive/5 text-destructive",
      )}
    >
      {tone === "ok" ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {days <= 0 ? "Token expired" : `Token ${days}d`}
    </span>
  );
}
