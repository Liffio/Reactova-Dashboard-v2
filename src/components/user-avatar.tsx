import { useEffect, useState } from "react";
import { Blobatar } from "@blobatar/react";
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
 * `animate` is for the large profile avatar only; lists stay static.
 */
export type UserAvatarProps = {
  userId: string;
  name?: string | null;
  avatarUrl?: string | null;
  size?: number;
  animate?: boolean;
  className?: string;
};

export function UserAvatar({
  userId,
  name,
  avatarUrl,
  size = 32,
  animate = false,
  className,
}: UserAvatarProps) {
  const src = resolveApiAssetUrl(avatarUrl ?? null);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const label = name?.trim() || "User";

  return (
    <span
      className={cn("inline-flex shrink-0 overflow-hidden rounded-[30%]", className)}
      style={{ width: size, height: size }}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={label}
          width={size}
          height={size}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : animate ? (
        <Blobatar name={userId} size={size} background="squircle" title={label} animate="hover" />
      ) : (
        <Blobatar name={userId} size={size} background="squircle" title={label} />
      )}
    </span>
  );
}
