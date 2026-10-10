import type { PickerMedia } from "@/lib/api/automations-api";

/** Graph reports a reel as VIDEO; REELS is accepted too in case the product type leaks through. */
export function isVideoMedia(item: Pick<PickerMedia, "mediaType">): boolean {
  return item.mediaType === "VIDEO" || item.mediaType === "REELS";
}
