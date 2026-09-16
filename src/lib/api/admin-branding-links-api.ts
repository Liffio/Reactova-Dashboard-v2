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

type ListParams = {
  scope: BrandingScope;
  from?: string;
  to?: string;
  sort?: string;
  dir?: string;
  page?: number;
  limit?: number;
  q?: string;
};

const toQuery = (p: ListParams): Record<string, string | undefined> => ({
  scope: p.scope,
  from: p.from,
  to: p.to,
  sort: p.sort,
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
    `${API_BASE}${apiUri.admin.brandingLinks.exportCsv({ scope: p.scope, from: p.from, to: p.to })}`,
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
