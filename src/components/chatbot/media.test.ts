import { describe, expect, it } from "vitest";
import type { ChatbotMedia } from "@/lib/api/chatbot-api";
import { formatBytes, formatDuration, mediaState, precheckMediaFile, previewParts } from "./media";

const MB = 1_000_000;
const media = (over: Partial<ChatbotMedia> = {}): ChatbotMedia => ({
  mediaAssetId: "m1",
  kind: "image",
  url: "https://files.liffio.com/x.jpg?exp=1&sig=a",
  thumbnailUrl: null,
  contentType: "image/jpeg",
  sizeBytes: 1000,
  maxBytes: 8 * MB,
  durationSeconds: null,
  width: 10,
  height: 10,
  originalName: "x.jpg",
  missing: false,
  ...over,
});

describe("checking a file before upload", () => {
  it("refuses MP3 and GIF by name, naming what we take", () => {
    expect(precheckMediaFile({ name: "Song.MP3", size: 10 }, "audio")).toMatch(
      /AAC, M4A, WAV or MP4/,
    );
    expect(precheckMediaFile({ name: "a.gif", size: 10 }, "image")).toMatch(/PNG, JPEG or WebP/);
  });

  it("refuses a file over the kind's limit, saying how big it is", () => {
    expect(precheckMediaFile({ name: "a.png", size: 9 * MB }, "image")).toBe(
      "This image is 9.0 MB. Instagram's limit for image is 8.0 MB.",
    );
    expect(precheckMediaFile({ name: "a.mp4", size: 25 * MB }, "video")).toBeNull();
    expect(precheckMediaFile({ name: "a.mp4", size: 25 * MB + 1 }, "video")).toMatch(/25\.0 MB/);
  });

  it("leaves everything else to the server", () => {
    expect(precheckMediaFile({ name: "voice.m4a", size: 2 * MB }, "audio")).toBeNull();
    expect(precheckMediaFile({ name: "no-extension", size: 2 * MB }, "image")).toBeNull();
  });
});

describe("formatting", () => {
  it("sizes", () => {
    expect(formatBytes(1_500_000)).toBe("1.5 MB");
    expect(formatBytes(300)).toBe("1 KB");
  });
  it("durations", () => {
    expect(formatDuration(7.4)).toBe("0:07");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(3723)).toBe("1:02:03");
    expect(formatDuration(null)).toBeNull();
  });
});

describe("a step's file in the builder", () => {
  it("is missing when the server says so or doesn't know it", () => {
    expect(mediaState(null, {})).toEqual({ kind: "none" });
    expect(mediaState("m1", { m1: media({ missing: true }) })).toEqual({ kind: "missing" });
    expect(mediaState("m2", { m1: media() })).toEqual({ kind: "missing" });
    expect(mediaState("m1", { m1: media() })).toMatchObject({ kind: "ready" });
  });
});

describe("the phone preview follows the real send order", () => {
  const tap = { id: "b1", label: "Next", action: "NEXT_STEP" as const, url: null };
  const link = { id: "b2", label: "Shop", action: "LINK" as const, url: "https://shop.test" };

  it("media, then text, then quick replies, then the link card", () => {
    const parts = previewParts(
      { text: "Look", buttons: [tap, link], mediaAssetId: "m1" },
      { m1: media() },
      true,
    );
    expect(parts.map((p) => p.part)).toEqual(["media", "text", "quickReplies", "linkCard"]);
  });

  it("quick replies only on the step awaiting a tap; the link card always", () => {
    const parts = previewParts(
      { text: "Look", buttons: [tap, link], mediaAssetId: null },
      {},
      false,
    );
    expect(parts.map((p) => p.part)).toEqual(["text", "linkCard"]);
  });

  it("a missing file shows as broken media, and the text still follows", () => {
    const parts = previewParts({ text: "Look", buttons: [], mediaAssetId: "gone" }, {}, false);
    expect(parts).toEqual([
      { part: "media", state: { kind: "missing" } },
      { part: "text", text: "Look" },
    ]);
  });

  it("a handover's buttons show under its closing message although nothing awaits a tap", () => {
    const parts = previewParts(
      { text: "Someone will reply", buttons: [tap], mediaAssetId: null, kind: "HANDOVER" },
      {},
      false,
    );
    expect(parts.map((p) => p.part)).toEqual(["text", "quickReplies"]);
  });

  it("buttons with no text still send something to hang the quick replies on", () => {
    expect(previewParts({ text: "", buttons: [tap], mediaAssetId: null }, {}, true)[0]).toEqual({
      part: "text",
      text: "👇",
    });
  });
});
