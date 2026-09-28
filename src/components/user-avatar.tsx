import { useEffect, useState } from "react";
import { Blobatar } from "@blobatar/react";
// Required for `animate` — without it every blobatar renders static.
import "blobatar/motion.css";
import { resolveApiAssetUrl } from "@/lib/api/http";
import { cn } from "@/lib/utils";

/**
 * The ONE way a person's face is drawn (plan/settings-revamp.md, spec §6).
 *
 * Photo when `avatarUrl` is set, otherwise a Blobatar seeded by `userId` — never by email or name,
 * which can change while the default avatar must not. A photo that fails to load (deleted file,
 * offline) falls back to the blob. Rendered by the npm package only; the hosted
 * `blobatar.dev/avatar` endpoint would leak user ids to a third party on every page view.
 *
 * Every blob animates on hover (`motion.css` above). `bare` drops the squircle backdrop and scales
 * the blob up so its body — not the empty backdrop area — fills the box; a photo is unaffected.
 */
export type UserAvatarProps = {
  userId: string;
  name?: string | null;
  avatarUrl?: string | null;
  size?: number;
  /** Hover animation. On by default; pass `false` for dense lists if it ever gets noisy. */
  animate?: boolean;
  /** Blob only, no backdrop, enlarged to fill `size`. */
  bare?: boolean;
  className?: string;
};

/** The blob's body spans ~70% of its viewBox; this scale makes it fill the box when bare. */
const BARE_SCALE = 1.4;

export function UserAvatar({
  userId,
  name,
  avatarUrl,
  size = 32,
  animate = true,
  bare = false,
  className,
}: UserAvatarProps) {
  const src = resolveApiAssetUrl(avatarUrl ?? null);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const label = name?.trim() || "User";
  const showPhoto = Boolean(src) && !failed;
  const blobSize = bare ? Math.round(size * BARE_SCALE) : size;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        showPhoto || !bare ? "overflow-hidden rounded-[30%]" : "overflow-visible",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {showPhoto ? (
        <img
          src={src!}
          alt={label}
          width={size}
          height={size}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Blobatar
          name={userId}
          size={blobSize}
          background={bare ? false : "squircle"}
          title={label}
          className={bare ? "shrink-0" : undefined}
          style={bare ? { margin: -(blobSize - size) / 2 } : undefined}
          {...(animate ? { animate: "hover" as const } : {})}
        />
      )}
    </span>
  );
}
