import type { ChatbotMedia, ChatbotMediaKind, TranscriptEntry } from "@/lib/api/chatbot-api";

/**
 * Step media in the builder: what each kind accepts, a quick check before a file is sent, and the
 * order the phone preview shows a step in. Pure, so it is unit tested; the server's checks (bytes,
 * not names) are the real ones and its message wins whenever they disagree.
 */

/** Decimal, matching the server: the stricter reading of Meta's "25MB" and "8MB". */
const MB = 1_000_000;

export const MEDIA_KINDS: Record<
  ChatbotMediaKind,
  { label: string; maxBytes: number; formats: string; accept: string }
> = {
  image: {
    label: "Image",
    maxBytes: 8 * MB,
    formats: "PNG, JPEG or WebP",
    accept: "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp",
  },
  video: {
    label: "Video",
    maxBytes: 25 * MB,
    formats: "MP4, MOV or WebM",
    accept: "video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm",
  },
  audio: {
    label: "Audio",
    maxBytes: 25 * MB,
    formats: "AAC, M4A, WAV or MP4",
    accept: "audio/aac,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,.aac,.m4a,.wav,.mp4",
  },
};

/**
 * A message for a file that would certainly be refused, before spending the upload on it. Null
 * means "send it and let the server decide". Only the cheap, certain cases: size, and the formats
 * we name as unsupported (MP3, GIF).
 */
export function precheckMediaFile(
  file: { name: string; size: number },
  kind: ChatbotMediaKind,
): string | null {
  const k = MEDIA_KINDS[kind];
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (ext === "mp3")
    return `MP3 isn't supported by Instagram messages. Upload audio as ${MEDIA_KINDS.audio.formats} instead.`;
  if (ext === "gif")
    return `GIFs aren't supported. Upload a still image as ${MEDIA_KINDS.image.formats}, or the animation as an MP4 video.`;
  if (file.size > k.maxBytes)
    return `This ${kind} is ${formatBytes(file.size)}. Instagram's limit for ${kind} is ${formatBytes(k.maxBytes)}.`;
  if (file.size === 0) return "This file is empty.";
  return null;
}

/** Same wording as the server's size messages. */
export function formatBytes(bytes: number): string {
  return bytes >= MB
    ? `${(bytes / MB).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

/** 0:07, 1:05, 1:02:03. */
export function formatDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** What the builder shows for a step's file: the file, or why it can't. */
export type MediaState =
  | { kind: "none" }
  | { kind: "ready"; media: ChatbotMedia }
  /** Gone from storage, or not found at all: the text still sends. */
  | { kind: "missing" };

export function mediaState(
  mediaAssetId: string | null | undefined,
  media: Record<string, ChatbotMedia> | undefined,
): MediaState {
  if (!mediaAssetId) return { kind: "none" };
  const m = media?.[mediaAssetId];
  if (!m || m.missing) return { kind: "missing" };
  return { kind: "ready", media: m };
}

/**
 * One bot entry in the phone preview, in the order Instagram receives it: the file alone, then the
 * text (carrying the quick replies), then the quick replies, then the link card. A link card is
 * its own message, so it shows on every entry; quick replies only on the one awaiting a tap.
 */
export type PreviewPart =
  | { part: "media"; state: Exclude<MediaState, { kind: "none" }> }
  | { part: "text"; text: string }
  | { part: "quickReplies"; buttons: NonNullable<TranscriptEntry["buttons"]> }
  | { part: "linkCard"; text: string; buttons: NonNullable<TranscriptEntry["buttons"]> };

export function previewParts(
  e: Pick<TranscriptEntry, "text" | "buttons" | "mediaAssetId">,
  media: Record<string, ChatbotMedia> | undefined,
  awaitingTap: boolean,
): PreviewPart[] {
  const out: PreviewPart[] = [];
  const m = mediaState(e.mediaAssetId, media);
  if (m.kind !== "none") out.push({ part: "media", state: m });
  const taps = (e.buttons ?? []).filter((b) => b.action !== "LINK");
  const links = (e.buttons ?? []).filter((b) => b.action === "LINK");
  // Instagram refuses quick replies on an empty message; the server sends 👇 in that case.
  const text = e.text || (taps.length ? "👇" : "");
  if (text) out.push({ part: "text", text });
  if (awaitingTap && taps.length) out.push({ part: "quickReplies", buttons: taps });
  if (links.length)
    out.push({
      part: "linkCard",
      text: links.length === 1 ? links[0].label : "Here are the links:",
      buttons: links,
    });
  return out;
}
