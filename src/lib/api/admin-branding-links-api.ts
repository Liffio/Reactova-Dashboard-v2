import { apiUri } from "./apiUri";
import { API_BASE, apiRequest } from "./http";
import { authStore } from "@/lib/auth/auth-store";

export type BrandingScope = "free" | "creator";

/** Mirrors `GET /admin/branding-links/overview`. Postgres COUNT/SUM arrive as strings — always
 *  coerce with Number() before formatting. */
export type BrandingOverview = {
  scope: BrandingScope;
  from: string;
  to: string;
  activeLinks: string | number;
  humanClicks: string | number;
  botClicks: string | number;
  signups: string | number;
  emailVerified: string | number;
  igConnected: string | number;
  automationsLive: string | number;
  paidConversions: string | number;
};

export type BrandingLinkRow = {
  id: string;
  code: string;
  ownerType: "workspace" | "creator";
  isActive: boolean;
  createdAt: string;
  workspaceName: string | null;
  ownerEmail: string | null;
  creatorEmail: string | null;
  creatorState: string | null;
  humanClicks: string | number;
  botClicks: string | number;
  signups: string | number;
  paidConversions: string | number;
  conversionRate: string | number;
};

export type BrandingLinkDetail = {
  link: BrandingLinkRow;
  series: Array<{
    day: string;
    humanClicks: number;
    botClicks: number;
    signups: number;
    emailVerified: number;
    igConnected: number;
    automationsLive: number;
    paidConversions: number;
  }>;
  clicks: Array<{
    id: string;
    createdAt: string;
    referer: string | null;
    userAgent: string | null;
    isBot: boolean;
    botReason: string | null;
    converted: boolean;
  }>;
  attributions: Array<{
    id: string;
    referredUserId: string;
    email: string | null;
    attributedAt: string;
    trackingSource: string;
    emailVerifiedAt: string | null;
    igConnectedAt: string | null;
    firstAutomationLiveAt: string | null;
    paidConvertedAt: string | null;
    /** True when this user ALSO carries an affiliate referral. Expected, not a bug — the two
     *  programs record independently and branding never pays. */
    affiliateOverlap: boolean;
  }>;
};

/** The sort fields the table exposes, named after the row fields they order by. */
export type BrandingSortField = "humanClicks" | "signups" | "conversionRate" | "paidConversions";

/**
 * The UI's column vocabulary and the API's `sort` enum are deliberately different: the table
 * sorts by the field it renders, while the endpoint validates against its own fixed keys
 * (`server/src/api/routes/adminBrandingLinks.ts`: `z.enum(["clicks", "signups", "paid",
 * "conversion", "created"])`). This is the adapter boundary, so the translation lives here rather
 * than leaking API vocabulary into the components. Typed as a total `Record` so adding a sortable
 * column without teaching the API about it is a compile error, not a 400 at runtime.
 */
const SORT_FIELD_TO_API: Record<BrandingSortField, "clicks" | "signups" | "conversion" | "paid"> = {
  humanClicks: "clicks",
  signups: "signups",
  conversionRate: "conversion",
  paidConversions: "paid",
};

/**
 * `from`/`to` travel through the UI as plain `YYYY-MM-DD` (shareable, human-readable URL —
 * matches `admin.users.index.tsx`'s `created_after`/`created_before` convention), but the
 * endpoint validates them with `z.string().datetime()`, which rejects a bare date. Widened to
 * inclusive UTC day boundaries here, at the same adapter boundary as the sort translation, so
 * every caller (list, overview, CSV export) sends a value the schema actually accepts.
 */
function toIsoDayStart(date: string | undefined): string | undefined {
  return date ? `${date}T00:00:00.000Z` : undefined;
}
function toIsoDayEnd(date: string | undefined): string | undefined {
  return date ? `${date}T23:59:59.999Z` : undefined;
}

type ListParams = {
  scope: BrandingScope;
  from?: string;
  to?: string;
  sort?: BrandingSortField;
  dir?: string;
  page?: number;
  limit?: number;
  q?: string;
};

const toQuery = (p: ListParams): Record<string, string | undefined> => ({
  scope: p.scope,
  from: toIsoDayStart(p.from),
  to: toIsoDayEnd(p.to),
  sort: p.sort ? SORT_FIELD_TO_API[p.sort] : undefined,
  dir: p.dir,
  page: p.page ? String(p.page) : undefined,
  limit: p.limit ? String(p.limit) : undefined,
  q: p.q || undefined,
});

export const fetchBrandingOverview = (p: ListParams) =>
  apiRequest<BrandingOverview>(apiUri.admin.brandingLinks.overview(toQuery(p)));

export const fetchBrandingList = (p: ListParams) =>
  apiRequest<{ rows: BrandingLinkRow[]; page: number; limit: number }>(
    apiUri.admin.brandingLinks.list(toQuery(p)),
  );

export const fetchBrandingLinkDetail = (linkId: string, includeBots = false) =>
  apiRequest<BrandingLinkDetail>(apiUri.admin.brandingLinks.detail(linkId, includeBots));

/** Null when the owner has never rendered branding — links are minted lazily, so this is a
 *  normal state, not an error. */
export const fetchBrandingLinkByOwner = (params: {
  workspaceId?: string;
  creatorProfileId?: string;
}) => apiRequest<BrandingLinkRow | null>(apiUri.admin.brandingLinks.byOwner(params));

/**
 * CSV export, fetched directly rather than through `apiRequest` (which always parses JSON) —
 * same shape as `exportLeadsCsv`. No `x-workspace-id` header: this is a platform-admin surface,
 * not workspace-scoped.
 */
export async function exportBrandingLinksCsv(p: {
  scope: BrandingScope;
  from?: string;
  to?: string;
}): Promise<Blob> {
  const token = authStore.getState().accessToken;
  const res = await fetch(
    `${API_BASE}${apiUri.admin.brandingLinks.exportCsv({
      scope: p.scope,
      from: toIsoDayStart(p.from),
      to: toIsoDayEnd(p.to),
    })}`,
    {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );
  if (!res.ok) {
    throw new Error("Unable to export branding links right now");
  }
  return res.blob();
}
