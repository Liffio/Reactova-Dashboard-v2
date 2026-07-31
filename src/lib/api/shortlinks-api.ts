import { apiUri } from "./apiUri";
import { apiRequest } from "./http";

export type ShortLinkItem = {
  id: string;
  name: string;
  slug: string;
  destination: string;
  clickCount: number;
  createdAt: string;
  shortUrl: string;
};

export function createShortLink(
  workspaceId: string,
  body: { name: string; destination: string; slug?: string },
) {
  return apiRequest<ShortLinkItem>(apiUri.shortlinks.create, {
    method: "POST",
    workspaceId,
    body: { ...body, slug: body.slug?.trim() || undefined },
  });
}

export function deleteShortLink(workspaceId: string, id: string) {
  return apiRequest<void>(apiUri.shortlinks.remove(id), { method: "DELETE", workspaceId });
}

export function resolvePublicShortLink(slug: string) {
  return apiRequest<{ destination: string }>(apiUri.public.shortlink(slug), { token: null });
}
