"use client";

import { useState } from "react";
import { tmdbImage, type ImageSize } from "@/lib/images";
import { initials } from "@/lib/person-labels";

interface Props {
  name: string;
  profilePath: string | null;
  /** Pixel diameter. */
  size?: number;
  imageSize?: ImageSize;
  className?: string;
  /** A CSS colour for a ring round the photo (a dark gap, then the colour); none by default. */
  ringColor?: string;
}

/**
 * Round profile photo with an initials fallback underneath: while the image loads, and if it is
 * missing or fails to load, the initials show. Decorative (aria-hidden): callers always render
 * the name beside it.
 */
export function PersonAvatar({ name, profilePath, size = 40, imageSize = "w92", className, ringColor }: Props) {
  const src = tmdbImage(profilePath, imageSize);
  // The url that failed, not a flag, so a new photo for the same avatar gets its own chance.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-border font-medium text-muted ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        boxShadow: ringColor ? `0 0 0 2px var(--bg), 0 0 0 4px ${ringColor}` : undefined,
      }}
    >
      {initials(name)}
      {src && src !== failedSrc && (
        <img
          // A failure before React attached onError (server-rendered markup, early 404) is missed
          // by the handler, but shows up as a finished load with no pixels. Deferred lazy images
          // are not "complete" yet, so they are not mistaken for failures.
          ref={(img) => {
            if (img?.complete && img.naturalWidth === 0) setFailedSrc(src);
          }}
          src={src}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(src)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </span>
  );
}
