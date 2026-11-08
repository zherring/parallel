import { memo, type CSSProperties } from "react";
import { tmdbImage } from "@/lib/images";
import { blurFor, columnIndex, phoneBlurFor, posterFactor, restOpacityFor, type DepthFilm } from "@/lib/depth-layout";
import { personColor, personGlow } from "@/lib/person-colors";
import { cn } from "@/components/timeline/cn";

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
  /** Outside the period a link chose: faint and grey, whatever its obscurity (the dimming wins). */
  outside: boolean;
  selected: boolean;
  /**
   * Inside the window of posters whose images are fetched (`usePosterImages`) at the scene's opening position: the images
   * have their `src` in the markup, so the first paint has them. The others get theirs as the scene scrolls.
   */
  eager: boolean;
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

/**
 * The highlight behind a label (title above a film made together, year below): the marker technique. The near-black background
 * (`rgb(10 12 14)`, a shade under the page's `--bg` #14181c, at 92%) is on the label's inline text itself, with `box-decoration-break:
 * clone`, so each wrapped line gets its own snug band that hugs that line's words, the padding (6px at the sides, 2px above and below)
 * and the rounding repeated per line; there is no rectangle around the whole label. The line-height of the label (set where
 * the labels are drawn, below) is a pixel or so over the band's height, so the bands of two lines never overlap and leave a hairline between them.
 */
const LABEL_HIGHLIGHT = "box-decoration-clone rounded-[4px] bg-[rgb(10_12_14/0.92)] px-1.5 py-0.5";

/** The title in a box, for a film TMDB has no poster of. */
function TitleFace({ title }: { title: string }) {
  return (
    <span aria-hidden className="flex size-full items-center justify-center p-2 text-center text-[11px] font-medium leading-tight text-muted">
      <span className="line-clamp-6 break-words">{title}</span>
    </span>
  );
}

function DepthPosterImpl({ item, roles, note, upcoming, coloured, outside, selected, eager, describedBy, onSelect }: DepthPosterProps) {
  const { film, shared, slots, layer, y, band, col, jitter, w, h, obscurity, push, background } = item;
  // Collaborations are the sharp ones in front: a bigger image. The posters of the layers behind are two images, a soft
  // one (small and blurred, drawn once) under a sharp one whose opacity the focus field raises (see `useFocusField`).
  const soft = background;
  // Out of the period a link chose, the dimming (the `li`'s `opacity-25`) is the whole opacity: the obscurity's is not stacked under it.
  const dimmed = outside && !selected;
  // The films several people made, and a page of one person's (up front, big and sharp), get the larger image.
  const src = tmdbImage(film.posterPath, shared || !coloured ? "w342" : "w185");
  const softSrc = soft ? tmdbImage(film.posterPath, "w92") : null;
  // One person made it: their colour rings the poster. Several people making a film that is not out yet: neutral.
  const ring = coloured && !shared && slots.length === 1 ? slots[0] : null;
  const ringColor = ring === null ? null : personColor(ring);

  const style = {
    top: round(y - h / 2),
    // Where a poster is across is the same markup for every viewport: its band (a fraction of the stage), its column in steps
    // from the band and its jitter, which the scene's CSS (`depthSceneCss`) turns into `left` with the viewport's spacing and
    // its layer's `--f`. The films several people made sit on the centre line.
    "--q": band === null ? "0.5" : `var(--band-${band})`,
    "--col": columnIndex(col),
    "--jit": round(jitter),
    "--step": layer === 0 ? "var(--step-collab)" : "var(--step-solo)",
    "--w": `${w}px`,
    // The films several people made are drawn smaller on a small screen (the viewport's `--collab-scale`): about the poster's centre.
    // A page of one person has its posters up front and bigger, and scales them down the same way (`--solo-scale`, 1 on a page of several).
    "--ps": layer === 0 ? "var(--collab-scale)" : "var(--solo-scale)",
    // A poster of a layer behind is pushed further back, within its layer, by how obscure its film is (the layer's `ol` is `preserve-3d`
    // for this to take; `--f` is then the poster's own factor, not the layer's, for the `left` rule above).
    transform:
      layer === 0
        ? "scale(var(--collab-scale))"
        : !coloured
          ? "scale(var(--solo-scale))"
          : `translateZ(${-round(push)}px)`,
    "--f": Math.round(posterFactor(item) * 100_000) / 100_000,
    "--lead": `${round(w / 2)}px`,
    width: w,
    height: h,
    // How much the focus field has sharpened this poster, 0 to 1 (the posters it does not drive are always in focus), and the blur it is behind.
    "--focus": soft ? 0 : 1,
    // The more obscure the film, the fainter at rest and the softer (the blur of its soft image): see `restOpacityFor` and `blurFor`.
    // Under `sm` the blur is gentler (`phoneBlurFor`): it is what costs on a phone.
    ...(soft
      ? {
          "--rest-opacity": round(restOpacityFor(obscurity)),
          "--layer-blur": `${round(blurFor(obscurity))}px`,
          "--layer-blur-phone": `${round(phoneBlurFor(obscurity))}px`,
          // Faint at rest, rising to 1 with the focus (the pointer near, the middle band on a phone, a hover or keyboard focus).
          // The whole poster fades as one (the card and the shadows hanging from it), so a shadow never shows through a faint poster.
          opacity: dimmed ? undefined : "calc(var(--rest-opacity) + (1 - var(--rest-opacity)) * var(--focus))",
        }
      : null),
  } as CSSProperties;

  return (
    <li
      data-poster={film.id}
      className={cn(
        "pointer-events-none absolute",
        // A poster the focus field drives has no opacity transition: the field already eases it (a weight per frame), and a transition
        // started on every one of those frames, for every poster in view, added about a tenth to a frame's main-thread time (a page of three, 4x CPU throttle). The dimming of a period fades.
        (!soft || dimmed) && "transition-[opacity,filter] duration-150 motion-reduce:transition-none",
        dimmed && "opacity-25 grayscale",
        // Keyboard focus takes a poster to full opacity, as it sharpens it (the inline opacity needs the `!`). A hover or keyboard focus also
        // marks the `li` `data-pinned` (see `DepthScene`), which pins `--focus` to 1 over the focus field's (globals.css).
        soft && !dimmed && "has-[button:focus-visible]:opacity-100!",
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
        {/* The card the layered shadows hang from (globals.css). It stays where it is as it comes into focus: sharper and brighter, not lifted. */}
        <span data-poster-card data-collab={shared ? "" : undefined} className="relative block size-full">
          {ring !== null && ringColor !== null && (
            <span
              aria-hidden
              className="absolute rounded-[5px]"
              style={{
                inset: 0,
                boxShadow: `0 0 18px 2px ${personGlow(ring)}`,
                opacity: "calc(0.3 + var(--focus) * 0.7)",
              }}
            />
          )}
          <span
            className={cn(
              "relative block size-full overflow-hidden rounded-[5px] bg-surface",
              selected && "outline outline-2 outline-offset-2 outline-strong",
              "group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-focus",
            )}
            // The ring only: the glow and the shadows are under the card (globals.css), so a ring and a shadow never paint over each other.
            style={shared ? { boxShadow: "0 0 0 2px var(--lit)" } : ringColor !== null ? { boxShadow: `0 0 0 1.5px ${ringColor}` } : undefined}
          >
            {soft &&
              (softSrc ? (
                <img
                  // The image is fetched as the scene scrolls (`usePosterImages`), not by the browser's lazy loading.
                  src={eager ? softSrc : undefined}
                  data-src={softSrc}
                  alt=""
                  width={w}
                  height={h}
                  decoding="async"
                  draggable={false}
                  // Blurred once and left alone; scaled up so the blur's soft edge falls outside the clip. A phone blurs the first
                  // layer back lightly and the rest not at all (it is what costs there): the small image blown up is soft enough.
                  className="absolute inset-0 size-full scale-105 object-cover [filter:blur(var(--layer-blur))] max-sm:[filter:blur(var(--layer-blur-phone))]"
                />
              ) : (
                <span className="absolute inset-0 scale-105 [filter:blur(var(--layer-blur))] max-sm:[filter:blur(var(--layer-blur-phone))]">
                  <TitleFace title={film.title} />
                </span>
              ))}
            {src ? (
              <img
                // The sharp image of a soft poster is only wanted when it is close (the hook has it); a poster that is not soft has only this one.
                src={eager && !soft ? src : undefined}
                data-src={src}
                data-window={soft ? "sharp" : "soft"}
                alt=""
                width={w}
                height={h}
                decoding="async"
                draggable={false}
                className={cn(
                  "size-full object-cover",
                  // Keyboard focus sharpens a poster, as the pointer does.
                  soft &&
                    "absolute inset-0 transition-opacity duration-100 [opacity:var(--focus)] group-focus-visible:opacity-100 motion-reduce:transition-none",
                )}
              />
            ) : (
              <span className={cn("block size-full", soft && "absolute inset-0 transition-opacity duration-100 [opacity:var(--focus)] group-focus-visible:opacity-100 motion-reduce:transition-none")}>
                <TitleFace title={film.title} />
              </span>
            )}
            <span
              aria-hidden
              // A light edge inside the poster, so a dark poster has an outline against the dark scene and another dark poster
              // (dashed for a film that is not out yet).
              className={cn(
                "pointer-events-none absolute inset-0 rounded-[5px]",
                upcoming
                  ? "border border-dashed border-muted"
                  : "[box-shadow:inset_0_0_0_1px_rgb(255_255_255/0.14),inset_0_1px_0_rgb(255_255_255/0.12)]",
              )}
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
        </span>
        {shared && (
          <>
            {/* The labels of a film made together, out of the poster's box (the layout and the packing know their room, `DEPTH.collabGap`, but
                they are absolutely positioned and add nothing to the poster's size): the title just above the poster's top edge, three lines at most (a long title is never cut short),
                and the year just below its bottom edge, 6px of air each, each text highlighted line by line (`LABEL_HIGHLIGHT`) in a block no wider than the poster, centred. Always there; a hover or keyboard focus brightens the title
                from 90% to full (a pointer that can hover only: Tailwind's `hover:` variant) and nothing moves. The button's label already says all of it.
                The clamp is on the block (`data-caption-line`) and the highlight on the inline span in it (`data-caption-chip`): a clamped element is a block, which would give the highlight one box. */}
            <span aria-hidden data-poster-caption="title" className="pointer-events-none absolute inset-x-0 bottom-full mb-1.5 text-center">
              <span
                data-caption-line
                className={cn(
                  "line-clamp-3 break-words text-[13px] leading-[21px] text-strong/90 max-sm:text-[14px] max-sm:leading-[22px]",
                  "transition-colors duration-150 group-hover:text-strong group-focus-visible:text-strong motion-reduce:transition-none",
                )}
              >
                <span data-caption-chip className={LABEL_HIGHLIGHT}>
                  {film.title}
                </span>
              </span>
            </span>
            <span aria-hidden data-poster-caption="year" className="pointer-events-none absolute inset-x-0 top-full mt-1.5 text-center">
              <span data-caption-line="year" className="block text-[12px] leading-[19px] tabular-nums text-muted max-sm:text-[13px] max-sm:leading-5">
                <span data-caption-chip className={LABEL_HIGHLIGHT}>
                  {film.year}
                </span>
              </span>
            </span>
          </>
        )}
      </button>
    </li>
  );
}

export const DepthPoster = memo(DepthPosterImpl);
