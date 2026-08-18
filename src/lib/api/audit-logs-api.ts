import { apiUri } from "./apiUri";
import { apiRequest } from "./http";
import type { AdminUserAuditEntry } from "./admin-users-api";

/**
 * The workspace-facing audit feed (`/api/v1/audit-logs`). It returns the SAME row shape as the admin
 * trails MINUS the impersonation on-behalf-of triple — those rows are filtered out server-side, so
 * the fields never apply here. We normalise back to the shared `AdminUserAuditEntry` so the existing
 * `<AuditTimeline>` (and its detail drawer) render this unchanged.
 */
export type WorkspaceAuditItem = Omit<
  AdminUserAuditEntry,
  "onBehalfOfUserId" | "onBehalfOfEmail" | "onBehalfOfName"
>;

type RawAuditLogsResponse = {
  items: WorkspaceAuditItem[];
  nextCursor: string | null;
  archiveAvailable: boolean;
};

export type AuditLogsResponse = {
  items: AdminUserAuditEntry[];
  nextCursor: string | null;
  /** True on the live feed once the 500-entry cap is reached and older entries remain in the archive. */
  archiveAvailable: boolean;
};

export type AuditLogsParams = {
  cursor?: string;
  limit?: number;
  actorId?: string;
  action?: string;
  from?: string;
  to?: string;
};

/** Fills the impersonation fields the tenant payload never carries, so each item satisfies
 *  `AuditTimelineEntry` and the shared timeline component can render it as-is. */
const normalise = (raw: RawAuditLogsResponse): AuditLogsResponse => ({
  items: raw.items.map((item) => ({
    ...item,
    onBehalfOfUserId: null,
    onBehalfOfEmail: null,
    onBehalfOfName: null,
  })),
  nextCursor: raw.nextCursor,
  archiveAvailable: raw.archiveAvailable,
});

/** `GET /api/v1/audit-logs` — the live feed: the most recent 500 entries within the last 7 days. */
export async function getAuditLogs(params: AuditLogsParams = {}, opts?: { signal?: AbortSignal }) {
  return normalise(
    await apiRequest<RawAuditLogsResponse>(apiUri.auditLogs.list(params), { signal: opts?.signal }),
  );
}

/** `GET /api/v1/audit-logs/archive` — entries past the 500-entry live cap (still within 7 days). Opt-in. */
export async function getAuditLogsArchive(
  params: AuditLogsParams = {},
  opts?: { signal?: AbortSignal },
) {
  return normalise(
    await apiRequest<RawAuditLogsResponse>(apiUri.auditLogs.archive(params), {
      signal: opts?.signal,
    }),
  );
}
