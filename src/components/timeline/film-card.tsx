import { memo } from "react";
import { tmdbImage } from "@/lib/images";
import { CARD_WIDTH, POSTER_HEIGHT } from "@/lib/timeline-layout";
import { cn } from "./cn";

/**
 * lit   - shared by every lane (green outline and glow)
 * some  - shared by some lanes only, 3+ lanes (thin blue outline)
 * dim   - not shared while something else is lit
 * plain - no emphasis either way
 */
export type CardTone = "lit" | "some" | "dim" | "plain";

interface FilmCardProps {
  id: number;
  title: string;
  year: number;
  posterPath: string | null;
  /** "Director, Writer" for this person on this film. */
  roles: string;
  /** Left edge and top edge inside the lane's track. */
  left: number;
  top: number;
  tone: CardTone;
  upcoming: boolean;
  /** The same film is hovered or focused (in this or another lane). */
  emphasized: boolean;
  selected: boolean;
  onSelect: (id: number, trigger: HTMLElement) => void;
  onHover: (id: number | null) => void;
}

function accessibleName({ title, year, roles, tone, upcoming }: FilmCardProps): string {
  return [
    `${title}, ${year}`,
    roles,
    tone === "lit" ? "Made together" : "",
    upcoming ? "Upcoming release" : "",
    "Open details",
  ]
    .filter(Boolean)
    .join(". ")
    .concat(".");
}

function FilmCardImpl(props: FilmCardProps) {
  const { id, title, year, posterPath, left, top, tone, upcoming, emphasized, selected, onSelect, onHover } = props;
  const src = tmdbImage(posterPath, "w185");
  const dimmed = tone === "dim" && !emphasized;

  return (
    <li className="absolute z-10" style={{ left, top, width: CARD_WIDTH }}>
      <button
        type="button"
        title={title}
        aria-label={accessibleName(props)}
        aria-current={selected ? "true" : undefined}
        onClick={(event) => onSelect(id, event.currentTarget)}
        onPointerEnter={() => onHover(id)}
        onPointerLeave={() => onHover(null)}
        onFocus={() => onHover(id)}
        onBlur={() => onHover(null)}
        // Opaque on purpose: connector lines run behind cards and must not show through them.
        className="group block w-full cursor-pointer rounded-[4px] bg-canvas text-left"
      >
        <span
          className={cn(
            "relative block overflow-hidden rounded-[4px] bg-surface transition-shadow duration-150 motion-reduce:transition-none",
            tone === "lit" && "shadow-lit",
            tone === "some" && "ring-1 ring-accent-blue",
            tone !== "lit" && emphasized && "ring-2 ring-strong/80",
            selected && "outline outline-2 outline-offset-2 outline-strong",
          )}
          style={{ height: POSTER_HEIGHT }}
        >
          {src ? (
            <img
              src={src}
              alt=""
              width={CARD_WIDTH}
              height={POSTER_HEIGHT}
              loading="lazy"
              decoding="async"
              draggable={false}
              className="h-full w-full object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="flex h-full w-full items-center justify-center p-1.5 text-center text-[10px] font-medium leading-tight text-muted"
            >
              <span className="line-clamp-5 break-words">{title}</span>
            </span>
          )}
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 bg-canvas/55 transition-opacity duration-150 motion-reduce:transition-none",
              dimmed ? "opacity-100 group-hover:opacity-0 group-focus-visible:opacity-0" : "opacity-0",
            )}
          />
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 rounded-[4px] border",
              upcoming ? "border-dashed border-muted" : "border-strong/20",
            )}
          />
          {upcoming && (
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 bg-canvas/85 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-accent-orange"
            >
              Upcoming
            </span>
          )}
        </span>
        <span
          className={cn(
            "mt-1 line-clamp-2 break-words hyphens-auto text-[11px] leading-[13px] group-hover:text-strong group-focus-visible:text-strong",
            dimmed ? "text-muted" : "text-strong",
          )}
        >
          {title}
        </span>
        <span className="block text-[11px] leading-[13px] tabular-nums text-muted">{year}</span>
      </button>
    </li>
  );
}

export const FilmCard = memo(FilmCardImpl);
