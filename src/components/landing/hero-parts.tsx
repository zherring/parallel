"use client";

import { useId } from "react";
import { Duotone, TreatedPortrait } from "@/components/treated-portrait";
import { MONTAGE_SIZE, PERSON_SIZE } from "@/components/landing/use-hero-rotation";
import { moreTexts } from "@/lib/hero-layout";
import type { HeroPairing, HeroPerson, HeroPoster } from "@/lib/hero-scenes";
import { tmdbImage } from "@/lib/images";
import { MONTAGE_POSTERS, treatmentShape } from "@/lib/portrait-treatment";

/**
 * The drawn pieces of the landing hero's stage (hero-stage.tsx places and animates them). Each moving part carries a `data-part`
 * that hero-motion.ts animates; the pointer parallax is the `translate` of the wrapper above a part, which reads `--px` and `--py`
 * (-1 to 1, set on the stage while the pointer is over it, see `useParallax`).
 */

/** The panel's dark base: what shows where there is no montage, and under the montage's own darkening. */
const BASE = "#0b0d10";

/**
 * A cut's height is 90% of the panel's, but never more than 165% of the panel's width (`cqw`, the frame is a size container): on a phone's narrow
 * panels a full-height figure would be wider than the panel, and its face cut by the outer edge. Photos are 2:3, so this is a figure about 1.1 times as wide as the panel.
 *
 * How far in from the panel's outer edge the figure's centre is, as a share of the panel's width. The spec's 42% leaves the heads of these tight
 * portraits (the face fills most of the photo's width) reaching under the headline's first line; this keeps the seam's side clear of them.
 */
const FIGURE_CENTRE = "37%";

/** Darker at the top and bottom, so the name, the headline and the timeline read over the montage. */
const VERTICAL_SHADE =
  "linear-gradient(to bottom, rgb(0 0 0 / 0.58), rgb(0 0 0 / 0.14) 28%, rgb(0 0 0 / 0.1) 56%, rgb(0 0 0 / 0.7))";

/**
 * The person's side of the stage, three parts: the montage of their films' posters (the look `TreatedPortrait` gives behind a cut: the same
 * `duotoneMatrix` filter and the same posters from `treatmentShape`) filling the panel, the cut-out figure standing on the panel's bottom edge
 * and running a little off it, and their name in the panel's outer top corner. A person with no posters is their colour, darkened.
 */
export function PanelParts({ person, color, slot }: { person: HeroPerson; color: string; slot: 0 | 1 }) {
  const filter = `hero-duo-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const shape = treatmentShape(person.id, person.profilePath);
  const posters = shape.posters.slice(0, MONTAGE_POSTERS);
  const montage = posters.length > 0;
  const tear = shape.tear === true;

  return (
    <>
      <div data-part="backdrop" className="absolute inset-0" style={{ background: montage ? BASE : `color-mix(in srgb, ${color} 36%, ${BASE})` }}>
        {montage && (
          <>
            <svg aria-hidden="true" width="0" height="0" className="absolute">
              <Duotone id={filter} tint={color} />
            </svg>
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3" style={{ filter: `url(#${filter})` }}>
              {posters.map((path) => (
                <img key={path} src={tmdbImage(path, MONTAGE_SIZE) ?? ""} alt="" decoding="async" draggable={false} className="size-full select-none object-cover" />
              ))}
            </div>
          </>
        )}
        <div className="absolute inset-0" style={{ backgroundImage: VERTICAL_SHADE }} />
      </div>

      {/*
        A cut is anchored to the panel's bottom (a little past it; on a phone, where the posters would cover the face of one that big, it stands on the line) and centred `FIGURE_CENTRE` of the panel's width in from its outer edge, so the seam's side stays clear.
        A tear (a person with no cut) is a strip across the whole photo, so it spans the panel's width, as it spans a card's, with its strip at the height of a cut's head.
      */}
      <div
        className={tear ? "absolute inset-x-0 top-[38%] aspect-[2/3] -translate-y-[42%]" : `absolute -bottom-[3%] aspect-[2/3] h-[min(90%,165cqw)] max-sm:bottom-[calc(100%_-_var(--line-y))] ${slot === 0 ? "-translate-x-1/2" : "translate-x-1/2"}`}
        style={
          tear
            ? // The strip fades out toward the seam, where the headline is, so it never sits under the copy.
              { maskImage: `linear-gradient(to ${slot === 0 ? "right" : "left"}, #000 58%, transparent 97%)` }
            : slot === 0
              ? { left: FIGURE_CENTRE }
              : { right: FIGURE_CENTRE }
        }
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
              className="absolute! inset-0 size-full"
            />
          </div>
        </div>
      </div>

      <div
        data-part="name"
        className={`absolute top-(--inset) max-w-[calc(100%-var(--inset)*2)] text-balance text-[length:clamp(15px,1.9vw,30px)] max-[359px]:text-[13px] font-semibold leading-[1.1] tracking-[-0.02em] text-white [text-shadow:0_1px_14px_rgb(0_0_0/0.65)] ${
          slot === 0 ? "left-(--inset)" : "right-(--inset) text-right"
        }`}
      >
        {person.name}
      </div>
    </>
  );
}

/**
 * One shared film on the timeline: its poster standing above the line, a stem down to a dot on the line, and its year under the dot. Everything is
 * placed from the anchor, a point on the line (hero-stage.tsx sets its `left` and `top` and the `group/poster` that the hover styles read): the poster's
 * bottom is `STEM` above it. Hovering the poster lifts it, fills the dot and shows its title and year in a label above it; the poster is not a link of its
 * own (the whole stage is one), so this is decoration, and nothing here is focusable.
 */
export function PosterParts({ poster, src }: { poster: HeroPoster; src: string }) {
  return (
    <>
      <span
        data-part="stem"
        aria-hidden="true"
        className="absolute bottom-0 left-0 h-4 w-px origin-bottom -translate-x-1/2 bg-white/45 motion-safe:transition-[height] motion-safe:duration-300 motion-safe:ease-out motion-safe:group-hover/poster:h-[22px]"
      />
      <span
        data-part="dot"
        aria-hidden="true"
        className="absolute left-0 top-0 size-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-white bg-canvas transition-colors duration-200 group-hover/poster:bg-white"
      />
      <span
        data-part="year"
        aria-hidden="true"
        className="absolute left-0 top-[11px] -translate-x-1/2 rounded-[3px] bg-black/55 px-1 py-[2px] text-[11px] font-medium leading-none tabular-nums text-muted [text-shadow:0_1px_6px_rgb(0_0_0/0.85)]"
      >
        {poster.year}
      </span>
      <div
        data-part="poster"
        aria-hidden="true"
        className="pointer-events-auto absolute bottom-4 left-0 w-(--pw)"
        style={{ marginLeft: "calc(var(--pw) / -2)", translate: "calc(var(--px, 0) * -4px) calc(var(--py, 0) * -4px)" }}
      >
        <div className="relative motion-safe:transition-[translate] motion-safe:duration-300 motion-safe:ease-out motion-safe:group-hover/poster:-translate-y-1.5">
          <div className="aspect-[2/3] w-full overflow-hidden rounded-[6px] bg-surface shadow-[0_10px_18px_-6px_rgb(0_0_0/0.7)]">
            <img src={src} alt="" width={104} height={156} decoding="async" draggable={false} className="size-full select-none object-cover" />
          </div>
          <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-max max-w-[220px] -translate-x-1/2 rounded-md border border-border bg-canvas/95 px-2 py-1 text-center text-xs leading-tight opacity-0 shadow-lg transition-opacity duration-200 group-hover/poster:opacity-100">
            <span className="font-medium text-strong">{poster.title}</span>
            <span className="text-muted">, {poster.year}</span>
          </span>
        </div>
      </div>
    </>
  );
}

/** A year cap: the pair's first or last shared film's year, a chip on the line at the outer end of a panel. */
export function YearCap({ year }: { year: number }) {
  return (
    <span className="block rounded-[5px] border border-border bg-canvas px-1.5 py-[3px] text-xs font-medium leading-none tabular-nums text-strong sm:px-2 sm:text-[13px]">
      {year}
    </span>
  );
}

/**
 * "+N more", a quiet pill on the line just past the last dot: the films the posters leave out. It has one pill per width (hero-layout.ts `moreTexts`,
 * hidden or shown by the same breakpoints that drop posters), so it is right at every screen from the server's markup on.
 */
export function MoreLabel({ pairing }: { pairing: HeroPairing }) {
  const texts = moreTexts(pairing);
  const pill =
    "whitespace-nowrap rounded-full border border-border bg-canvas px-[0.75em] py-[0.3em] text-[12px] font-medium leading-none tracking-[0.02em] text-muted transition-colors duration-300 group-hover:border-white group-hover:text-strong";
  return (
    <>
      {texts.phone && <span className={`${pill} inline-block sm:hidden`}>{texts.phone}</span>}
      {texts.tablet && <span className={`${pill} hidden sm:inline-block lg:hidden`}>{texts.tablet}</span>}
      {texts.desktop && <span className={`${pill} hidden lg:inline-block`}>{texts.desktop}</span>}
    </>
  );
}
