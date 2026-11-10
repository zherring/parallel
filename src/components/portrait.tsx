"use client";

import { useState } from "react";

interface PortraitProps {
  /** The photo, or null when TMDB has none. */
  src: string | null;
  /** What the photo is, for assistive technology: "Poster for Volver", "Photo of Penélope Cruz". */
  alt: string;
  /**
   * Initials to show under the photo while it loads, and alone when there is none or it fails. Left out
   * for a film's poster, which has nothing to fall back to.
   */
  fallback?: string;
}

/**
 * The 2:3 picture at the top of a slide-out panel: the film's poster, or a person's portrait with their
 * initials underneath. The url that failed is remembered, not a flag, so a different photo in the same
 * frame gets its own chance.
 */
export function Portrait({ src, alt, fallback }: PortraitProps) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <div className="relative aspect-[2/3] w-28 shrink-0 overflow-hidden rounded-md border border-border bg-surface sm:w-32">
      {fallback && (
        <span
          aria-hidden="true"
          className="absolute inset-0 flex select-none items-center justify-center text-3xl font-medium text-muted"
        >
          {fallback}
        </span>
      )}
      {src && src !== failed && (
        <img
          src={src}
          alt={alt}
          width={342}
          height={513}
          decoding="async"
          onError={() => setFailed(src)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </div>
  );
}
