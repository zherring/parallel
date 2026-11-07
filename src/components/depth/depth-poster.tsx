import { memo, type CSSProperties } from "react";
import { tmdbImage } from "@/lib/images";
import { blurFor, type DepthFilm } from "@/lib/depth-layout";
import { personColor, personGlow } from "@/lib/person-colors";
import { cn } from "@/components/timeline/cn";

/**
 * Room (px) around a poster inside its list item for its glow. The item is `content-visibility: auto`, which clips
 * painting to its padding box, so the glow has to fit in it; the item itself takes no pointer events, so the room
 * never covers a neighbouring poster.
 */
const GLOW_ROOM = 28;

interface DepthPosterProps {
  item: DepthFilm;
  /** "Ann: Director. Bo: Writer", from `describeCombined`. */
  roles: string;
  /** "Shared by Ann & Bo", or empty. */
  note: string;
  /** Not out yet (see `isReleased`): a dashed border and a ribbon. */
  upcoming: boolean;
  /** Whether the page has several people: a poster of one person gets a ring in their colour only then. */
  coloured: boolean;
  /** Whether any film on the page is shared (it decides which layer is sharp, see `blurFor`). */
  hasShared: boolean;
  /** Outside the period a link chose: faint and grey. */
  outside: boolean;
  selected: boolean;
  /** id of the hover card while it is open for this poster. */
  describedBy?: string;
  onSelect: (id: number, trigger: HTMLElement) => void;
}

function accessibleName(title: string, year: number, roles: string, note: string, upcoming: boolean): string {
  return [`${title}, ${year}`, roles, note, upcoming ? "Upcoming release" : "", "Open details"]
    .filter(Boolean)
    .join(". ")
    .concat(".");
}

const round = (value: number) => Math.round(value * 100) / 100;

function DepthPosterImpl({ item, roles, note, upcoming, coloured, hasShared, outside, selected, describedBy, onSelect }: DepthPosterProps) {
  const { film, shared, slots, layer, y, xFrac, dx, w, h } = item;
  // Collaborations are the sharp ones in front: a bigger image. The rest start soft and are sharpened by the focus field.
  const src = tmdbImage(film.posterPath, shared ? "w342" : "w185");
  // One person made it: their colour rings the poster. Several people making a film that is not out yet: neutral.
  const ring = coloured && !shared && slots.length === 1 ? slots[0] : null;
  const ringColor = ring === null ? null : personColor(ring);

  const style = {
    top: round(y - h / 2 - GLOW_ROOM),
    // The x of a poster is a fraction of the width and a pixel offset, so the server and every viewport agree on it.
    left: `calc(${round(xFrac * 100)}% + ${round(dx - w / 2 - GLOW_ROOM)}px)`,
    width: w + GLOW_ROOM * 2,
    height: h + GLOW_ROOM * 2,
    padding: GLOW_ROOM,
    // How much the focus field has sharpened this poster, 0 to 1 (collaborations are always in focus), and the blur it is behind.
    "--focus": shared ? 1 : 0,
    "--layer-blur": `${blurFor(layer, hasShared)}px`,
  } as CSSProperties;

  return (
    <li
      className={cn(
        "pointer-events-none absolute [content-visibility:auto]",
        "transition-[opacity,filter] duration-150 motion-reduce:transition-none",
        outside && !selected && "opacity-25 grayscale",
      )}
      style={style}
    >
      <button
        type="button"
        data-film={film.id}
        data-lane={slots[0] ?? 0}
        data-layer={layer}
        aria-label={accessibleName(film.title, film.year, roles, note, upcoming)}
        aria-describedby={describedBy}
        aria-current={selected ? "true" : undefined}
        onClick={(event) => onSelect(film.id, event.currentTarget)}
        // The focus ring is drawn on the poster inside; the global :focus-visible outline is unlayered CSS and would beat a plain utility.
        className="group pointer-events-auto relative block size-full cursor-pointer text-left focus-visible:outline-none!"
      >
        {ring !== null && ringColor !== null && (
          <span
            aria-hidden
            className="absolute rounded-[6px]"
            style={{
              inset: GLOW_ROOM,
              boxShadow: `0 0 18px 2px ${personGlow(ring)}`,
              opacity: "calc(0.3 + var(--focus) * 0.7)",
            }}
          />
        )}
        <span
          className={cn(
            "relative block size-full overflow-hidden rounded-[4px] bg-surface",
            shared && "shadow-lit",
            selected && "outline outline-2 outline-offset-2 outline-strong",
            "group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-focus",
          )}
          style={ringColor !== null ? { boxShadow: `0 0 0 1.5px ${ringColor}` } : undefined}
        >
          {src ? (
            <img src={src} alt="" width={w} height={h} loading="lazy" decoding="async" draggable={false} className="size-full object-cover" />
          ) : (
            <span aria-hidden className="flex size-full items-center justify-center p-2 text-center text-[11px] font-medium leading-tight text-muted">
              <span className="line-clamp-6 break-words">{film.title}</span>
            </span>
          )}
          <span
            aria-hidden
            className={cn("pointer-events-none absolute inset-0 rounded-[4px] border", upcoming ? "border-dashed border-muted" : "border-strong/20")}
          />
          {upcoming && (
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 bg-canvas/85 py-0.5 text-center text-[9px] font-semibold uppercase tracking-wide text-accent-orange"
            >
              Upcoming
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

export const DepthPoster = memo(DepthPosterImpl);
