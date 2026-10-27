import { memo } from "react";
import { tmdbImage } from "@/lib/images";
import { CARD_WIDTH, POSTER_HEIGHT } from "@/lib/timeline-layout";
import { cn } from "./cn";

/**
 * lit   - shared by every lane (green outline and glow)
 * some  - shared by some lanes only, 3+ lanes (thin outline in that connection's colour)
 * plain - a film of this lane only, no emphasis
 *
 * A lit or "some" card is the film's poster in this lane; the same film has one in each lane
 * that shows it, linked by the connector line between their nodes.
 */
export type CardTone = "lit" | "some" | "plain";

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
  /** CSS colour of the connection a "some" card belongs to (see `slotColor`); unused for the other tones. */
  accent: string | null;
  /** Read after the roles, so the tone is not carried by colour alone: "Made together", "Shared by Fincher and Pitt". */
  note: string;
  /** Index of the lane the card is in. Read by the timeline's delegated hover handlers. */
  laneIndex: number;
  upcoming: boolean;
  /** The same film is hovered or focused (in this or another lane). */
  emphasized: boolean;
  /** The legend is pointing at another kind of connection: a lit or "some" card drops its outline and reads as a plain poster. */
  dimmed: boolean;
  selected: boolean;
  /** id of the hover card while it is open for this card. */
  describedBy: string | undefined;
  onSelect: (id: number, trigger: HTMLElement) => void;
}

const CAPTION_OUTLINE = "[text-shadow:0_0_2px_var(--bg),0_0_2px_var(--bg),0_0_4px_var(--bg)]";

function accessibleName({ title, year, roles, note, upcoming }: FilmCardProps): string {
  return [`${title}, ${year}`, roles, note, upcoming ? "Upcoming release" : "", "Open details"]
    .filter(Boolean)
    .join(". ")
    .concat(".");
}

function FilmCardImpl(props: FilmCardProps) {
  const { id, title, year, posterPath, left, top, tone, accent, laneIndex, upcoming, emphasized, dimmed, selected, describedBy, onSelect } =
    props;
  const src = tmdbImage(posterPath, "w185");

  return (
    <li
      // The posters of a film that is in one lane only sit under the timeline's connector lines (z-15, so no z-index) with
      // the captions over them. The posters of shared films sit over the lines: a line passes behind them (its own
      // film's too, so it shows again right below the caption) instead of through them.
      className={cn("absolute", tone !== "plain" && "z-[16]")}
      style={{ left, top, width: CARD_WIDTH }}
    >
      <button
        type="button"
        data-film={id}
        data-lane={laneIndex}
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
            tone === "lit" && !dimmed && (emphasized ? "shadow-[0_0_0_2px_var(--lit),0_0_32px_6px_var(--lit-glow)]" : "shadow-lit"),
            tone !== "lit" && emphasized && "ring-2 ring-strong/80",
            selected && "outline outline-2 outline-offset-2 outline-strong",
          )}
          style={{
            height: POSTER_HEIGHT,
            boxShadow: tone === "some" && accent && !emphasized && !dimmed ? `0 0 0 1.5px ${accent}` : undefined,
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
        {/* Above the connector lines (z-15), with a dark outline, so a line that crosses the caption never hides a letter. */}
        <span className={cn("relative z-[16] mt-1 line-clamp-2 break-words hyphens-auto text-[11px] leading-[13px] text-strong", CAPTION_OUTLINE)}>
          {title}
        </span>
        <span className={cn("relative z-[16] block text-[11px] leading-[13px] tabular-nums text-muted", CAPTION_OUTLINE)}>{year}</span>
      </button>
    </li>
  );
}

export const FilmCard = memo(FilmCardImpl);
