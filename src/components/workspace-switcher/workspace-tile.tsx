import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * The one tile shape used everywhere in the switcher.
 *
 * 🔴 NEVER A CIRCLE. Not in the switcher, not in its modals, not for the stacked tiles on a group
 * row. The HTML is explicit about this and it is the detail that was wrong before: a connected
 * Instagram photo is shown inside the SAME rounded square as the letter tile, so a row does not
 * change shape depending on whether the account happens to be linked. A circle here would also read
 * as a person's avatar, and a workspace is not a person.
 *
 * Sizes come from the HTML and are deliberately not Tailwind's radius scale:
 *
 *   | where | box | radius |
 *   |---|---|---|
 *   | root list, trigger | 32px | 9px |
 *   | group view rows, stacked tiles | 28px | 8px |
 *
 * `rounded-lg` is 8px, so the 32px tile needs its radius stated explicitly. Using `rounded-lg` for
 * both is what made the large tile a pixel too square.
 */

/** The HTML uses the FIRST letter only, not two-letter initials. */
function firstLetter(name: string): string {
  const trimmed = name.trim();
  return (trimmed[0] ?? "W").toUpperCase();
}

export function WorkspaceTile({
  name,
  src,
  size = "md",
  muted,
  className,
}: {
  name: string;
  /** The connected Instagram profile photo, when there is one. */
  src?: string | null;
  /** `md` is 32px/9px (root list), `sm` is 28px/8px (group view). */
  size?: "md" | "sm";
  /** Expired rows grey their tile, matching the row's own de-emphasis. */
  muted?: boolean;
  className?: string;
}) {
  /**
   * Compared against the current `src` rather than being a boolean, so a different workspace
   * re-attempts its own image instead of inheriting the previous failure. Instagram CDN URLs are
   * signed and expire, so a 403 here is an ordinary path, not an exceptional one.
   */
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const url = src?.trim() || null;
  const showImage = url !== null && failedSrc !== url;

  const box =
    size === "sm"
      ? "size-7 rounded-[8px] text-[12px]"
      : "size-8 rounded-[9px] text-[13px]";

  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden bg-brand-gradient font-semibold text-primary-foreground",
        box,
        muted && "opacity-50 grayscale",
        className,
      )}
    >
      {/*
        The letter stays in the DOM underneath the image rather than being swapped out. A slow or
        failing image then reveals the letter instead of an empty box, with no layout shift and no
        second render.
      */}
      {firstLetter(name)}
      {showImage ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          onError={() => setFailedSrc(url)}
          className="absolute inset-0 size-full rounded-[inherit] object-cover"
        />
      ) : null}
    </span>
  );
}

/**
 * A group as three stacked tiles.
 *
 * Uses the group's first workspaces' own photos, exactly as a row does, so an agency reads as
 * "these particular workspaces" rather than as a generic icon. Falls back to plain gradient tiles
 * when the group has fewer than three members, which is the common case and not an error.
 *
 * Purely decorative: the group row's button carries the accessible name, so this carries none.
 */
export function GroupTileStack({
  name,
  members,
  muted,
}: {
  name: string;
  members: Array<{ name: string; profilePictureUrl?: string | null }>;
  muted?: boolean;
}) {
  const shown = members.slice(0, 3);
  const fillers = Math.max(0, 3 - shown.length);

  // Drawn back to front, so the first workspace ends up on top and fully opaque.
  const layers = [
    ...Array.from({ length: fillers }, () => null),
    ...shown.slice().reverse(),
  ];

  const position = ["left-0 top-0 opacity-45", "left-[5px] top-[3px] opacity-70", "left-[10px] top-[6px]"];

  return (
    <span aria-hidden className="relative h-8 w-9 shrink-0">
      {layers.map((member, index) => (
        <span
          key={index}
          className={cn(
            "absolute grid size-[26px] place-items-center overflow-hidden rounded-[8px] bg-brand-gradient text-[11.5px] font-semibold text-primary-foreground ring-2 ring-popover",
            position[index],
            muted && "opacity-50 grayscale",
          )}
        >
          {member ? (
            <>
              {firstLetter(member.name)}
              {member.profilePictureUrl ? (
                <img
                  src={member.profilePictureUrl}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 size-full rounded-[inherit] object-cover"
                />
              ) : null}
            </>
          ) : null}
        </span>
      ))}
      <span className="sr-only">{name}</span>
    </span>
  );
}
