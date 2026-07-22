import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

export type BioLinkItem = {
  id: string;
  title: string;
  url: string;
  order: number;
};

export type BioLinkSocialItem = {
  id: string;
  label: string;
  url: string;
  icon: string | null;
  emoji: string | null;
  platform?: "custom" | "instagram";
  mode?: "link" | "profile" | "posts" | "reels";
  order: number;
};

export type BioLinkProfile = {
  id: string;
  workspaceId: string;
  slug: string;
  displayName: string;
  bio: string | null;
  theme: string;
  accentColor: string;
  buttonStyle: "filled" | "outlined" | "soft";
  backgroundType: "solid" | "gradient";
  backgroundColor: string;
  backgroundColorTo: string;
  textColor: string;
  cardStyle: "solid" | "glass" | "outline";
  cardColor: string;
  cardOpacity: number;
  fontFamily: "inter" | "poppins" | "space-grotesk" | "playfair";
  avatarUrl: string | null;
  buttonTextColor: string;
  buttonRadius: number;
  buttonBorderWidth: number;
  buttonShadow: boolean;
  sectionOrder: Array<"links" | "socials">;
  socialLayout: "horizontal" | "vertical";
  links: BioLinkItem[];
  socials: BioLinkSocialItem[];
  publicUrl: string;
  totalClicks: number;
};

export type BioLinkAnalytics = {
  totalClicks: number;
  links: Array<{
    id: string;
    title: string;
    url: string;
    order: number;
    clicks: number;
  }>;
};

export type UpdateBioLinkInput = Partial<
  Omit<BioLinkProfile, "id" | "workspaceId" | "links" | "socials" | "publicUrl" | "totalClicks">
> & { displayName: string };

export type PublicBioLinkPayload = {
  id: string;
  slug: string;
  displayName: string;
  bio: string | null;
  accentColor: string;
  buttonStyle: "filled" | "outlined" | "soft";
  backgroundType: "solid" | "gradient";
  backgroundColor: string;
  backgroundColorTo: string;
  textColor: string;
  cardStyle: "solid" | "glass" | "outline";
  cardColor: string;
  cardOpacity: number;
  fontFamily: "inter" | "poppins" | "space-grotesk" | "playfair";
  avatarUrl: string | null;
  buttonTextColor: string;
  buttonRadius: number;
  buttonBorderWidth: number;
  buttonShadow: boolean;
  sectionOrder: Array<"links" | "socials">;
  socialLayout: "horizontal" | "vertical";
  links: Array<{ id: string; title: string; clickUrl: string }>;
  socials: Array<{
    id: string;
    label: string;
    icon: string | null;
    emoji: string | null;
    platform?: "custom" | "instagram";
    mode?: "link" | "profile" | "posts" | "reels";
    mediaItems?: Array<{ id: string; mediaUrl?: string; permalink?: string }>;
    clickUrl: string;
  }>;
};

export function getBioLink(workspaceId: string) {
  return apiRequest<BioLinkProfile>(apiUri.biolink.root, { workspaceId });
}

export function getBioLinkAnalytics(workspaceId: string) {
  return apiRequest<BioLinkAnalytics>(apiUri.biolink.analytics, { workspaceId });
}

export function updateBioLink(workspaceId: string, body: UpdateBioLinkInput) {
  return apiRequest<BioLinkProfile>(apiUri.biolink.root, {
    method: "PUT",
    workspaceId,
    body,
  });
}

export function createBioLinkItem(workspaceId: string, body: { title: string; url: string }) {
  return apiRequest<BioLinkItem>(apiUri.biolink.links, { method: "POST", workspaceId, body });
}

export function updateBioLinkItem(
  workspaceId: string,
  id: string,
  body: { title: string; url: string },
) {
  return apiRequest<BioLinkItem>(apiUri.biolink.linkItem(id), {
    method: "PUT",
    workspaceId,
    body,
  });
}

export function deleteBioLinkItem(workspaceId: string, id: string) {
  return apiRequest<void>(apiUri.biolink.linkItem(id), { method: "DELETE", workspaceId });
}

export function reorderBioLinkItems(workspaceId: string, linkIds: string[]) {
  return apiRequest<BioLinkItem[]>(apiUri.biolink.linksReorder, {
    method: "PUT",
    workspaceId,
    body: { linkIds },
  });
}

export type BioLinkSocialInput = {
  label: string;
  url: string;
  icon?: string;
  emoji?: string;
  platform?: "custom" | "instagram";
  mode?: "link" | "profile" | "posts" | "reels";
};

export function createBioLinkSocial(workspaceId: string, body: BioLinkSocialInput) {
  return apiRequest<BioLinkSocialItem>(apiUri.biolink.socials, {
    method: "POST",
    workspaceId,
    body,
  });
}

export function updateBioLinkSocial(workspaceId: string, id: string, body: BioLinkSocialInput) {
  return apiRequest<BioLinkSocialItem>(apiUri.biolink.socialItem(id), {
    method: "PUT",
    workspaceId,
    body,
  });
}

export function deleteBioLinkSocial(workspaceId: string, id: string) {
  return apiRequest<void>(apiUri.biolink.socialItem(id), { method: "DELETE", workspaceId });
}

export function reorderBioLinkSocials(workspaceId: string, linkIds: string[]) {
  return apiRequest<BioLinkSocialItem[]>(apiUri.biolink.socialsReorder, {
    method: "PUT",
    workspaceId,
    body: { linkIds },
  });
}

export function resetBioLink(workspaceId: string) {
  return apiRequest<void>(apiUri.biolink.reset, { method: "POST", workspaceId });
}

export function getPublicBioLink(slug: string) {
  return apiRequest<PublicBioLinkPayload>(
    `${apiUri.public.biolink}?slug=${encodeURIComponent(slug)}`,
    { token: null },
  );
}
