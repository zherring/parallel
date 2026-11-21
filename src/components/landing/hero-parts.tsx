"use client";

import { useId, type CSSProperties } from "react";
import { Duotone, TreatedPortrait } from "@/components/treated-portrait";
import { MONTAGE_SIZE, PERSON_SIZE } from "@/components/landing/use-hero-rotation";
import { FIGURE_OVERHANG, POSTER_WIDTHS, figureOverhang, moreCount, posterPlace, type PosterWidth } from "@/lib/hero-layout";
import type { HeroPairing, HeroPerson, HeroPoster } from "@/lib/hero-scenes";
import { tmdbImage } from "@/lib/images";
import { MONTAGE_POSTERS, eyeLine, headSpan, treatmentShape } from "@/lib/portrait-treatment";

/**
 * The drawn pieces of the landing hero's stage (hero-stage.tsx places and animates them). Each moving part carries a `data-part`
 * that hero-motion.ts animates; the pointer parallax is the `translate` of the wrapper above a part, which reads `--px` and `--py`
 * (-1 to 1, set on the stage while the pointer is over it, see `useParallax`).
 *
 * A half of the stage is one person's side and runs out to the screen's edge. The stage's decoration box is inset from the screen by `--core-pad` (hero-stage.tsx),
 * and a half reaches `--core-pad` past it on its outer side. The figure and the montage's first tile are in the "core": the half less that extension on its outer
 * side, where a panel inset from the screen's edges would be.
 */

/** The panel's dark base: what shows where there is no montage, and under the montage's own darkening. */
const BASE = "#0b0d10";

/**
 * A cut's height is 90% of the core's, but never more than 165% of the core's width (`cqw`, the core is a size container): on a phone's narrow
 * cores a full-height figure would be wider than the core, and its face cut by the outer edge. Photos are 2:3, so this is a figure about 1.1 times as wide as the core.
 *
 * How far in from the core's outer edge the figure's centre is, as a share of the core's width. The spec's 42% leaves the heads of these tight
 * portraits (the face fills most of the photo's width) reaching under the headline's first line; this keeps the seam's side clear of them.
 */
const FIGURE_CENTRE = "37%";

/** Darker at the top, so the headline reads over the montage. (The bottom is the foot gradient's, over the figure.) */
const TOP_SHADE =
  "linear-gradient(to bottom, rgb(0 0 0 / 0.58), rgb(0 0 0 / 0.14) 28%, rgb(0 0 0 / 0.1) 56%, rgb(0 0 0 / 0.1))";

/**
 * The foot: the page's canvas colour rising from the half's bottom, over the montage and the figure alike, so that the figure's lower body, the photo's hard
 * bottom edge and the montage all melt into the page. Its stops ease out (no visible start); the timeline, the posters and the names sit above it. Its height
 * is the stage's `--foot-h` (hero-stage.tsx: one value, 84% of the half's height, at every width), and the stops are shares of that, so the easing is the same at any.
 */
const FOOT = `linear-gradient(to top, var(--bg), color-mix(in srgb, var(--bg) 93%, transparent) 14%, color-mix(in srgb, var(--bg) 74%, transparent) 33%, color-mix(in srgb, var(--bg) 42%, transparent) 55%, color-mix(in srgb, var(--bg) 14%, transparent) 78%, transparent)`;

/** How many columns of posters are tiled past the first tile (three columns) on the outer side: enough for a viewport of about 3000px. */
const EXTENSION_COLUMNS = 4;

/**
 * The person's side of the stage: the montage of their films' posters (the look `TreatedPortrait` gives behind a cut: the same `duotoneMatrix` filter
 * and the same posters from `treatmentShape`) filling the half, the cut-out figure standing on its bottom edge and running a little off it, the foot gradient
 * over them both. The montage's 3 x 3 tile is followed outward by more columns of the same posters, repeating the list when it runs out, under the same
 * duotone. The figure has no outline: the cut is its own edge against the montage. A person with no posters is their colour, darkened.
 */
export function PanelParts({ person, color, slot }: { person: HeroPerson; color: string; slot: 0 | 1 }) {
  const filter = `hero-duo-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const shape = treatmentShape(person.id, person.profilePath);
  const posters = shape.posters.slice(0, MONTAGE_POSTERS);
  const montage = posters.length > 0;
  const tear = shape.tear === true;
  // Where the cut's eyes are in its photo (a share of its height): at the tablet widths the figure is stood by it, so that the eyes of every figure are on one line (`--eye-line`).
  const eye = tear ? 0 : eyeLine(shape);
  // On a phone the figure is pushed out so that part of it is off the screen (`--crop`, a share of its width): `FIGURE_OVERHANG`, less where the head would lose more than a quarter of itself (a tear has no head to keep: its strip runs on to the screen's edge).
  const crop = tear ? FIGURE_OVERHANG : figureOverhang(headSpan(shape), slot);
  const figureStyle: Record<string, string> = {
    "--crop": crop.toFixed(4),
    "--fig-out": "calc(-1 * var(--core-pad) - var(--crop) * var(--fig-h) * 2 / 3)",
    ...(tear
      ? // The strip fades out toward the seam, where the headline is (on a larger screen), so it never sits under the copy, and at its outer end too, as the photo ends there and the montage goes on.
        { maskImage: `linear-gradient(to ${slot === 0 ? "right" : "left"}, transparent, #000 9%, #000 58%, transparent 97%)` }
      : { "--fig-in": FIGURE_CENTRE, "--eye": eye.toFixed(4) }),
  };
  // The core: this half less its extension past the decoration box, on its outer side.
  const core: CSSProperties = slot === 0 ? { left: "var(--core-pad)", right: 0 } : { left: 0, right: "var(--core-pad)" };

  return (
    <>
      <div data-part="backdrop" className="absolute inset-0" style={{ background: montage ? BASE : `color-mix(in srgb, ${color} 36%, ${BASE})` }}>
        {montage && (
          <>
            <svg aria-hidden="true" width="0" height="0" className="absolute">
              <Duotone id={filter} tint={color} />
            </svg>
            <div className="absolute inset-y-0" style={core}>
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3" style={{ filter: `url(#${filter})` }}>
                {posters.map((path) => (
                  <img key={path} src={tmdbImage(path, MONTAGE_SIZE) ?? ""} alt="" decoding="async" draggable={false} className="size-full select-none object-cover" />
                ))}
              </div>
              {/* The tile goes on outward: its columns by distance from the first tile, each cell the next poster of the list (the list again when it runs out). */}
              <div
                className="absolute inset-y-0 grid grid-rows-3"
                style={{
                  width: `calc(100% * ${EXTENSION_COLUMNS} / 3)`,
                  gridTemplateColumns: `repeat(${EXTENSION_COLUMNS}, 1fr)`,
                  ...(slot === 0 ? { right: "100%" } : { left: "100%" }),
                  filter: `url(#${filter})`,
                }}
              >
                {Array.from({ length: EXTENSION_COLUMNS * 3 }, (_, index) => {
                  const column = Math.floor(index / 3);
                  const row = index % 3;
                  const path = posters[(MONTAGE_POSTERS + index) % posters.length];
                  return (
                    <img
                      key={index}
                      src={tmdbImage(path, MONTAGE_SIZE) ?? ""}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                      className="size-full select-none object-cover"
                      style={{ gridColumn: slot === 0 ? EXTENSION_COLUMNS - column : column + 1, gridRow: row + 1 }}
                    />
                  );
                })}
              </div>
            </div>
          </>
        )}
        <div className="absolute inset-0" style={{ backgroundImage: TOP_SHADE }} />
      </div>

      {/*
        A cut is anchored to the core's bottom (a little past it, and `--fig-drop` further, half of how far the timeline is dropped, which on a phone is no further: its lower body goes on past the line, behind the timeline and the names, and the foot melts it into the page) and centred `FIGURE_CENTRE` of the core's width in from its outer edge, so the seam's side stays clear.
        On the tablet widths (`sm` up to `lg`) it is stood by its eyes instead: its top is where puts its eyes (`--eye`, a share of its height, from `eyeLine`) on the stage's `--eye-line`, so every face is on one line down the stage, clear above the cluster, whatever the cut's headroom; its lower end is no longer past the stage's bottom, so the last 6px of its box (the photo's own bottom edge) are clipped, and the rest of it, opaque to there, is covered by the taller foot over it. The figure is never faded: only the foot, the page's colour over it, darkens it.
        A tear (a person with no cut) is a strip across the whole photo, so it spans the core's width, as it spans a card's, with its strip at the height of a cut's head.
        On a phone (below `sm`) the figure is the same box as a cut's for a tear too: `--fig-h` high (hero.tsx: 1.5 times what it was, `min(90%, 165cqw)` of the core, and the stage is as tall as the headline above it and the figure need), standing on the core's bottom 18px higher than it was (`--fig-lift`: 3% past the bottom less the lift, so the photo's bottom edge is at the bottom, under the foot), and pushed out toward the screen's edge by `--crop` of its width (`figureOverhang`, from the head's place in its photo): `--fig-out` is where its outer edge is, past the screen's, so that the half's frame cuts the outer part off, and the face (a third of the figure at most is off, a quarter of the head at most) is beside the poster cluster. The headline is over the figure's top, which is a headline's height under the stage's, less the lift (the box has that much gap under the copy, and 2px more): the heads never reach the copy. A tear's strip runs on past the screen's edge the same way.
      */}
      <div className="pointer-events-none absolute inset-y-0 [container-type:inline-size]" style={core}>
        <div
          className={
            tear
              ? `absolute aspect-[2/3] sm:inset-x-0 sm:top-[calc(38%_+_var(--fig-drop))] sm:-translate-y-[42%] max-sm:bottom-[calc(-3%_+_var(--fig-lift))] max-sm:h-(--fig-h) ${slot === 0 ? "max-sm:left-(--fig-out)" : "max-sm:right-(--fig-out)"}`
              : `absolute bottom-[calc(-3%_-_var(--fig-drop))] aspect-[2/3] h-[min(90%,165cqw)] max-sm:bottom-[calc(-3%_+_var(--fig-lift))] max-sm:h-(--fig-h) sm:max-lg:bottom-auto sm:max-lg:top-[calc(var(--eye-line)_-_var(--eye)_*_min(90%,165cqw))] sm:max-lg:[clip-path:inset(-20%_-60%_6px_-60%)] ${slot === 0 ? "left-(--fig-in) -translate-x-1/2 max-sm:left-(--fig-out) max-sm:translate-x-0" : "right-(--fig-in) translate-x-1/2 max-sm:right-(--fig-out) max-sm:translate-x-0"}`
          }
          style={figureStyle as CSSProperties}
        >
          <div className="absolute inset-0" style={{ translate: "calc(var(--px, 0) * -8px) calc(var(--py, 0) * -6px)" }}>
            <div data-part="figure" className="absolute inset-0">
              <TreatedPortrait
                bare
                personId={person.id}
                slot={slot}
                color={color}
                name={person.name}
                profilePath={person.profilePath}
                imageSize={PERSON_SIZE}
                rounded={false}
                outline="none"
                className="absolute! inset-0 size-full"
              />
            </div>
          </div>
        </div>
      </div>

      <div data-part="foot" aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0" style={{ height: "var(--foot-h)", backgroundImage: FOOT }} />
    </>
  );
}

/**
 * One shared film in the cluster over the timeline: its poster, standing on the cluster's baseline a little above the line, turned and offset a little
 * by its place in the row (hero-layout.ts `posterPlace`, hero-cue.css for the fan) so the row reads as a fanned hand of cards, each over the one before it. The anchor is a point
 * on the baseline (hero-stage.tsx sets its `left` and `top`, its `--z`, and the `group/poster` that the hover styles read); the poster's bottom is on it.
 * Hovering the poster lifts it and shows its title and year in a label above it; the poster is not a link of its own (the whole stage is one), so this is
 * decoration, and nothing here is focusable.
 */
export function PosterParts({ poster, src, slot }: { poster: HeroPoster; src: string; slot: number }) {
  const place = posterPlace(slot);
  return (
    <div
      data-part="poster"
      aria-hidden="true"
      className="pointer-events-auto absolute bottom-0 left-0 w-(--pw)"
      style={{ marginLeft: "calc(var(--pw) / -2)", translate: "calc(var(--px, 0) * -4px) calc(var(--py, 0) * -4px)" }}
    >
      <div className="relative motion-safe:transition-[translate] motion-safe:duration-300 motion-safe:ease-out motion-safe:group-hover/poster:-translate-y-2">
        <div
          data-cue-tilt=""
          className="aspect-[2/3] w-full origin-bottom overflow-hidden rounded-[6px] bg-surface shadow-[0_14px_22px_-8px_rgb(0_0_0/0.8),0_0_0_1.25px_#fff] sm:shadow-[0_14px_22px_-8px_rgb(0_0_0/0.8),0_0_0_1.5px_#fff]"
          style={{ "--tilt-jitter": `${place.jitter}deg` } as CSSProperties}
        >
          <img src={src} alt="" width={104} height={156} decoding="async" draggable={false} className="size-full select-none object-cover" />
        </div>
        <span className="pointer-events-none absolute bottom-full left-1/2 mb-3 w-max max-w-[220px] -translate-x-1/2 rounded-md border border-border bg-canvas/95 px-2 py-1 text-center text-xs leading-tight opacity-0 shadow-lg transition-opacity duration-200 group-hover/poster:opacity-100">
          <span className="font-medium text-strong">{poster.title}</span>
          <span className="text-muted">, {poster.year}</span>
        </span>
      </div>
    </div>
  );
}

/** A year cap: the year of the first or the last film of either person, a chip on the line at the outer end of a panel. */
export function YearCap({ year }: { year: number }) {
  return (
    <span className="block rounded-[5px] border border-border bg-canvas px-1.5 py-[3px] text-xs font-medium leading-none tabular-nums text-strong sm:px-2 sm:text-[13px]">
      {year}
    </span>
  );
}

/**
 * "+N more", a quiet pill to the right of the poster cluster, on the posters' middle: the films the posters leave out. It has one pill per width (hero-layout.ts
 * `moreCount`, hidden or shown by the same breakpoints that drop posters), so it is right at every screen from the server's markup on. On the narrowest phones,
 * which have no room beside the cluster for the words, it is the number alone.
 */
export function MoreLabel({ pairing }: { pairing: HeroPairing }) {
  const pill =
    "whitespace-nowrap rounded-full border border-border bg-canvas px-[0.75em] py-[0.3em] text-[12px] font-medium leading-none tracking-[0.02em] text-muted transition-colors duration-300 group-hover:border-white group-hover:text-strong";
  const show: Record<PosterWidth, string> = {
    phone: "inline-block sm:hidden",
    tablet: "hidden sm:inline-block lg:hidden",
    desktop: "hidden lg:inline-block",
  };
  return (
    <>
      {POSTER_WIDTHS.map((width) => {
        const count = moreCount(pairing, width);
        if (count === 0) return null;
        return (
          <span key={width} className={`${pill} ${show[width]}`}>
            +{count}
            <span className={width === "phone" ? "max-[379px]:hidden" : undefined}> more</span>
          </span>
        );
      })}
    </>
  );
}

/**
 * The cue's line under the names, "See all 11 films together →" (hero-cue.css fades it in and slides it up while the cue shows, and nudges the arrow twice; on a touch screen, which has no hover,
 * it is always there, still): where the click on the stage goes. Decorative, like all of the stage (the link's own name says the films); no box behind it, as it is over the page's foot gradient.
 * On a phone it is one line, centred under the names, at `--cue-fs` (hero.tsx): wider than the names' third (it would be under 10px in it), between the two keycaps, which it clears by 18px or more; from `sm` up it is one line of 15px.
 */
export function CueCall({ count }: { count: number }) {
  return (
    <span
      data-cue-cta=""
      className="block text-center text-[length:var(--cue-fs)] font-medium leading-[1.25] tracking-[-0.005em] whitespace-nowrap text-white [text-shadow:0_1px_14px_rgb(0_0_0/0.7)] sm:text-[15px] sm:leading-none"
    >
      See all <span className="tabular-nums">{count}</span> {count === 1 ? "film" : "films"} together{" "}
      <span data-cue-arrow="" className="inline-block">
        →
      </span>
    </span>
  );
}
