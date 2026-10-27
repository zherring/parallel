const IMAGE_BASE = "https://image.tmdb.org/t/p";

export type ImageSize = "w92" | "w154" | "w185" | "w342" | "w500" | "w780" | "w1280" | "original";

/** Plain <img src> URL on TMDB's CDN; returns null when TMDB has no image. */
export function tmdbImage(path: string | null | undefined, size: ImageSize): string | null {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}
