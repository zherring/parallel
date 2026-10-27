import { memo } from "react";
import { tmdbImage } from "@/lib/images";
import { CARD_HEIGHT, CARD_WIDTH, POSTER_HEIGHT } from "@/lib/timeline-layout";
import { cn } from "./cn";

/**
 * lit   - shared by every lane (green outline and glow)
 * some  - shared by some lanes only, 3+ lanes (thin outline in that connection's colour)
 * plain - no emphasis
 */
export type CardTone = "lit" | "some" | "plain";

interface FilmCardProps {
  id: number;
  title: string;
  year: number;
  posterPath: string | null;
  /** "Director, Writer" for this person on this film. */
  roles: string;
  /** Left edge and top edge inside the lane's track (or the shared strip). */
  left: number;
  top: number;
  tone: CardTone;
  /** CSS colour of the connection a "some" card belongs to (see `slotColor`); unused for the other tones. */
  accent: string | null;
  /** Read after the roles, so the tone is not carried by colour alone: "Made together", "Shared by Fincher and Pitt". */
  note: string;
  /** Index of the lane the card is in; null for the shared strip. Read by the timeline's delegated hover handlers. */
  laneIndex: number | null;
  upcoming: boolean;
  /**
   * The film's connector line continues below this card. The card is only as tall as its
   * caption (a one-line title is shorter), so it draws the rest of its CARD_HEIGHT as a line
   * that picks up where the timeline's SVG line resumes, with no gap in between.
   */
  tail: boolean;
  /** The same film is hovered or focused (in this or another lane). */
  emphasized: boolean;
  selected: boolean;
  /** id of the hover card while it is open for this card. */
  describedBy: string | undefined;
  onSelect: (id: number, trigger: HTMLElement) => void;
}

function accessibleName({ title, year, roles, note, upcoming }: FilmCardProps): string {
  return [`${title}, ${year}`, roles, note, upcoming ? "Upcoming release" : "", "Open details"]
    .filter(Boolean)
    .join(". ")
    .concat(".");
}

function FilmCardImpl(props: FilmCardProps) {
  const { id, title, year, posterPath, left, top, tone, accent, laneIndex, upcoming, tail, emphasized, selected, describedBy, onSelect } =
    props;
  const src = tmdbImage(posterPath, "w185");

  return (
    <li
      className={cn("absolute z-10", tail && "flex flex-col")}
      style={{ left, top, width: CARD_WIDTH, height: tail ? CARD_HEIGHT : undefined }}
    >
      <button
        type="button"
        data-film={id}
        data-lane={laneIndex ?? undefined}
        aria-label={accessibleName(props)}
        aria-describedby={describedBy}
        aria-current={selected ? "true" : undefined}
        onClick={(event) => onSelect(id, event.currentTarget)}
        // Opaque on purpose: the grid lines of the track must not show through the caption.
        // scroll-mb: keyboard focus scrolls the page far enough to clear the control bar pinned to the viewport's bottom.
        className="group block w-full scroll-mb-20 cursor-pointer rounded-[4px] bg-canvas text-left"
      >
        <span
          className={cn(
            "relative block overflow-hidden rounded-[4px] bg-surface transition-shadow duration-150 motion-reduce:transition-none",
            tone === "lit" && "shadow-lit",
            tone !== "lit" && emphasized && "ring-2 ring-strong/80",
            selected && "outline outline-2 outline-offset-2 outline-strong",
          )}
          style={{
            height: POSTER_HEIGHT,
            boxShadow: tone === "some" && accent && !emphasized ? `0 0 0 1.5px ${accent}` : undefined,
          }}
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
        <span className="mt-1 line-clamp-2 break-words hyphens-auto text-[11px] leading-[13px] text-strong">{title}</span>
        <span className="block text-[11px] leading-[13px] tabular-nums text-muted">{year}</span>
      </button>
      {tail && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none mx-auto min-h-0 flex-1",
            tone === "lit" && "bg-lit shadow-[0_0_3px_var(--lit-glow)]",
            emphasized ? "w-[3px]" : "w-0.5",
          )}
          style={tone === "lit" ? undefined : { backgroundColor: accent ?? "var(--text-muted)" }}
        />
      )}
    </li>
  );
}

export const FilmCard = memo(FilmCardImpl);
