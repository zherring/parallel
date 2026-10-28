import { memo } from "react";
import { tmdbImage } from "@/lib/images";
import { CARD_HEIGHT, POSTER_HEIGHT, QUIET_POSTER_HEIGHT, QUIET_RESTORE_SCALE, cardWidthOf } from "@/lib/timeline-layout";
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

/** Opacity of the poster of a quiet card (see `quiet`); the caption stays opaque, in the muted tone. */
export const QUIET_OPACITY = 0.55;

interface FilmCardProps {
  id: number;
  title: string;
  year: number;
  posterPath: string | null;
  /** "Director, Writer" for this person on this film. */
  roles: string;
  /** Left edge and top edge inside the lane's track. The card is `cardWidthOf(quiet)` wide, centred on its film's x. */
  left: number;
  top: number;
  tone: CardTone;
  /**
   * Another film on screen is connected and this one is not (see `quietFilmIds`): a smaller, fainter poster with a
   * smaller caption in the muted tone, so the connected films stand out. A hovered, focused or open card comes back to
   * full size and brightness, over its neighbours. Only ever a "plain" card; purely visual, nothing a screen reader
   * reads changes.
   */
  quiet: boolean;
  /** CSS colour of the connection a "some" card belongs to (see `slotColor`); unused for the other tones. */
  accent: string | null;
  /** Read after the roles, so the tone is not carried by colour alone: "Made together", "Shared by Fincher and Pitt". */
  note: string;
  /** Index of the lane the card is in. Read by the timeline's delegated hover handlers. */
  laneIndex: number;
  upcoming: boolean;
  /** The same film is hovered or focused (in this or another lane). */
  emphasized: boolean;
  /**
   * The legend is pointing at another kind of connection: a lit or "some" card drops its outline and reads as a plain
   * poster, at full size and brightness. It never applies to a quiet card, which the legend leaves alone.
   */
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
  const {
    id,
    title,
    year,
    posterPath,
    left,
    top,
    tone,
    quiet,
    accent,
    laneIndex,
    upcoming,
    emphasized,
    dimmed,
    selected,
    describedBy,
    onSelect,
  } = props;
  const src = tmdbImage(posterPath, "w185");
  const width = cardWidthOf(quiet);
  const posterHeight = quiet ? QUIET_POSTER_HEIGHT : POSTER_HEIGHT;
  // A quiet card is hovered, focused or open: back to full size and brightness, above its neighbours.
  const restored = quiet && (emphasized || selected);
  const faded = quiet && !restored;
  const textSize = quiet ? "text-[10px] leading-[12px]" : "text-[11px] leading-[13px]";

  return (
    <li
      // The posters of a film that is in one lane only sit under the timeline's connector lines (z-15, so no z-index) with
      // the captions over them. The posters of shared films sit over the lines: a line passes behind them (its own
      // film's too, so it shows again right below the caption) instead of through them. A quiet card that is
      // restored is over the lines and over the shared posters (z-16) too, so that it can be read in full.
      className={cn("absolute", tone !== "plain" && "z-[16]", restored && "z-[18]")}
      style={{ left, top, width }}
    >
      <button
        type="button"
        data-film={id}
        data-lane={laneIndex}
        data-quiet={quiet ? "" : undefined}
        aria-label={accessibleName(props)}
        aria-describedby={describedBy}
        aria-current={selected ? "true" : undefined}
        onClick={(event) => onSelect(id, event.currentTarget)}
        // The focus ring is drawn on the card inside (it grows with a restored quiet card), so the button has none.
        // Important: the global :focus-visible outline is unlayered CSS and would beat a plain utility.
        // scroll-mb: keyboard focus scrolls the page far enough to clear the control bar pinned to the viewport's bottom.
        // Every card has a box as tall as a full card (a quiet one keeps that height and grows into it) and stands on its
        // bottom edge, on the lane's line: a flex column pushed to the end (a button centres plain content). So every
        // caption ends the same distance from the line, and a restored quiet card grows upward, away from the line.
        // The hover card opens below this box.
        className="group flex w-full scroll-mb-20 cursor-pointer flex-col text-left focus-visible:outline-none! justify-end"
        style={{ height: CARD_HEIGHT }}
      >
        <span
          // Opaque on purpose: the grid lines of the track must not show through the caption.
          // Bottom centre is the origin, so a restored card stays centred on its x and keeps standing on the same bottom.
          className="block rounded-[4px] bg-canvas transition-transform duration-150 ease-out group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-focus motion-reduce:transition-none origin-bottom"
          style={restored ? { transform: `scale(${QUIET_RESTORE_SCALE})` } : undefined}
        >
          <span
            className={cn(
              "relative block overflow-hidden rounded-[4px] transition-shadow duration-150 motion-reduce:transition-none",
              quiet ? "bg-canvas" : "bg-surface",
              tone === "lit" && !dimmed && (emphasized ? "shadow-[0_0_0_2px_var(--lit),0_0_32px_6px_var(--lit-glow)]" : "shadow-lit"),
              tone !== "lit" && emphasized && "ring-2 ring-strong/80",
              selected && "outline outline-2 outline-offset-2 outline-strong",
            )}
            style={{
              height: posterHeight,
              boxShadow: tone === "some" && accent && !emphasized && !dimmed ? `0 0 0 1.5px ${accent}` : undefined,
            }}
          >
            <span
              className="block size-full transition-opacity duration-150 motion-reduce:transition-none"
              style={{ opacity: faded ? QUIET_OPACITY : 1 }}
            >
              {src ? (
                <img
                  src={src}
                  alt=""
                  width={width}
                  height={posterHeight}
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
            </span>
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
                className={cn(
                  "absolute inset-x-0 bottom-0 bg-canvas/85 py-0.5 text-center font-semibold uppercase tracking-wide text-accent-orange",
                  quiet ? "text-[8px]" : "text-[10px]",
                )}
              >
                Upcoming
              </span>
            )}
          </span>
          {/* Above the connector lines (z-15), with a dark outline, so a line that crosses the caption never hides a letter. */}
          <span
            className={cn(
              "relative z-[16] mt-1 line-clamp-2 break-words hyphens-auto transition-colors duration-150 motion-reduce:transition-none",
              textSize,
              faded ? "text-muted" : "text-strong",
              CAPTION_OUTLINE,
            )}
          >
            {title}
          </span>
          <span className={cn("relative z-[16] block tabular-nums text-muted", textSize, CAPTION_OUTLINE)}>{year}</span>
        </span>
      </button>
    </li>
  );
}

export const FilmCard = memo(FilmCardImpl);
