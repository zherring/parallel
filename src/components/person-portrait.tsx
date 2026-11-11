"use client";

import { useState } from "react";
import { tmdbImage, type ImageSize } from "@/lib/images";
import { initials } from "@/lib/person-labels";
import { cn } from "@/components/timeline/cn";

interface Props {
  name: string;
  profilePath: string | null;
  imageSize?: ImageSize;
  /** The box's size and anything else it needs: a height and a width (TMDB's profile photos are 2:3). */
  className?: string;
  /** A CSS colour for a ring round the photo (a dark gap, then the colour), as `PersonAvatar`'s. */
  ringColor?: string;
}

/**
 * A person's portrait as a rounded rectangle with the bar's one corner radius, for where a larger picture than the avatar's is wanted (the pair hero):
 * the same ring in the person's colour, and the same initials underneath while the photo loads or when there is none. Decorative (aria-hidden):
 * whatever holds it is named, and the names are beside it.
 */
export function PersonPortrait({ name, profilePath, imageSize = "w185", className, ringColor }: Props) {
  const src = tmdbImage(profilePath, imageSize);
  // The url that failed, not a flag, so a new photo for the same portrait gets its own chance.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-(--bar-radius) bg-border text-2xl font-medium text-muted",
        className,
      )}
      style={{ boxShadow: ringColor ? `0 0 0 2px var(--bg), 0 0 0 4px ${ringColor}` : undefined }}
    >
      {initials(name)}
      {src && src !== failedSrc && (
        <img
          ref={(img) => {
            if (img?.complete && img.naturalWidth === 0) setFailedSrc(src);
          }}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(src)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </span>
  );
}
