"use client";

import { Clapperboard } from "lucide-react";
import { useState } from "react";
import { tmdbImage } from "@/lib/images";
import type { SharedFilm } from "@/lib/types";

/** The poster at TMDB's w92 size, in a box of `width` x `height` px; a titled placeholder when there is no poster. */
export function FilmThumb({
  film,
  width,
  height,
}: {
  film: Pick<SharedFilm, "title" | "posterPath">;
  width: number;
  height: number;
}) {
  const src = tmdbImage(film.posterPath, "w92");
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const box = { width, height };
  return src && src !== failedSrc ? (
    <img
      src={src}
      alt=""
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      onError={() => setFailedSrc(src)}
      className="rounded-[4px] border border-strong/20 object-cover"
      style={box}
    />
  ) : (
    <span
      aria-hidden
      style={box}
      className="flex items-center justify-center rounded-[4px] border border-border bg-canvas text-muted"
    >
      <Clapperboard aria-hidden="true" className="size-4" />
    </span>
  );
}
