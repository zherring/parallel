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
  const box = { width, height };
  return src ? (
    <img
      src={src}
      alt=""
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      className="rounded-[4px] border border-strong/20 object-cover"
      style={box}
    />
  ) : (
    <span
      aria-hidden
      style={box}
      className="flex items-center justify-center rounded-[4px] border border-border bg-canvas p-1 text-center text-[9px] leading-tight text-muted"
    >
      <span className="line-clamp-4 break-words">{film.title}</span>
    </span>
  );
}
