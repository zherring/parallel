"use client";

import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { usePanelShown } from "@/components/landing/panel-shown";
import { useHeroVariants } from "@/components/landing/use-hero-variants";
import { Duotone, TreatedPortrait } from "@/components/treated-portrait";
import { tmdbImage } from "@/lib/images";
import { MONTAGE_POSTERS, eyeLine, treatmentShape } from "@/lib/portrait-treatment";
import {
  DUO_ASPECT,
  DUO_MELT,
  PORTRAIT_ASPECT,
  SPLIT_SEAM_HOVER_PX,
  SPLIT_SEAM_PX,
  SPLIT_SHIFT_PX,
  cascadeLayout,
  duoLayout,
  splitClips,
  splitLayout,
} from "@/lib/pairing-card";
import { initials } from "@/lib/person-labels";

interface Person {
  id: number;
  name: string;
  profilePath: string;
}

interface Props {
  /** In the pairing's order: A first (the top left, or the left), and each after A over the one before it. */
  people: readonly Person[];
  /** Each person's colour, in the same order (`portraitPersonHexes`). */
  colors: readonly string[];
}

interface Box {
  width: number;
  height: number;
}

/**
 * The people of a genre's pairing card, in the box pairing-card.tsx gives them: a third of the card's width and as tall as the card (the card is as tall as its text, so the box is
 * measured, and what is drawn is sized to it). Three ways of drawing them (the Variants control, `?cards=`, hero-variants.ts), all of `TreatedPortrait`, the duotone and the pair's colours,
 * all with no names (the card's title says them) and all hovered or focused by the card (the `group` it is in), not at all moving with reduced motion:
 *   - "cascade" (the default): two tilted portrait cards, A at the upper left, B lower and to the right over A's bottom right;
 *   - "split": one square tile cut by a diagonal seam, A's cut-out over A's montage in the upper left, B's over B's in the lower right;
 *   - "duo": the two cut-outs standing bare side by side, B in front, on one shared backdrop of their two colours, melting into the card at the bottom.
 * Drawn once the panel it is in has been shown (`usePanelShown`: a hidden panel is `display: none`, and each of these is a 3 x 3 montage of posters and an SVG, which 133 cards of would
 * be a megabyte of markup); until then the box is empty and its size held.
 */
export function CardPortraits({ people, colors }: Props) {
  const shown = usePanelShown();
  const { cards } = useHeroVariants();
  const root = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  useLayoutEffect(() => {
    const element = root.current;
    if (!shown || !element) return;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      setBox(width > 0 && height > 0 ? { width, height } : null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [shown]);

  // The split is a pair's (two halves); a group of three or four has the cascade, or the duo.
  const variant = cards === "split" && people.length !== 2 ? "cascade" : cards;
  return (
    <div ref={root} data-card-portraits="" data-card-variant={variant} className="absolute inset-0">
      {shown && box && (variant === "split" ? <Split people={people} colors={colors} box={box} /> : variant === "duo" ? <Duo people={people} colors={colors} box={box} /> : <Cascade people={people} colors={colors} box={box} />)}
    </div>
  );
}

/** A person's cut-out over their montage in a box that fills its parent (a card, a half of the split), framed on the head for a tile of `aspect` (the whole photo without it); a person with no photo is their colour and their initials. */
function Face({ person, color, slot, aspect }: { person: Person; color: string; slot: number; aspect?: number }) {
  return person.profilePath ? (
    <TreatedPortrait
      personId={person.id}
      slot={slot}
      color={color}
      name={person.name}
      profilePath={person.profilePath}
      imageSize="w342"
      posterSize="w154"
      rounded={false}
      headAspect={aspect}
      className="absolute! inset-0 size-full"
    />
  ) : (
    <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-[length:max(14px,22cqw)] font-medium text-black/75" style={{ background: color }}>
      {initials(person.name)}
    </span>
  );
}

/** The montage behind a person, as the hero's panels draw it: the posters of their own films (`treatmentShape`, a 3 x 3) darkened to the person's colour by the duotone; a person with no posters is their colour, darkened. Fills its parent. */
function Montage({ person, color }: { person: Person; color: string }) {
  const filter = `card-duo-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const posters = person.profilePath ? treatmentShape(person.id, person.profilePath).posters.slice(0, MONTAGE_POSTERS) : [];
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden" style={{ background: posters.length > 0 ? "#0b0d10" : `color-mix(in srgb, ${color} 36%, #0b0d10)` }}>
      {posters.length > 0 && (
        <>
          <svg aria-hidden="true" width="0" height="0" className="absolute">
            <Duotone id={filter} tint={color} />
          </svg>
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3" style={{ filter: `url(#${filter})` }}>
            {posters.map((path) => (
              <img key={path} src={tmdbImage(path, "w154") ?? ""} alt="" loading="lazy" decoding="async" draggable={false} className="size-full select-none object-cover" />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** A person's cut-out standing bare (no montage or colour behind it, `TreatedPortrait`'s `bare`) in a box that fills its parent, which is the photo's 2:3; a person with no photo is their initials on their colour. */
function Cutout({ person, color, slot }: { person: Person; color: string; slot: number }) {
  return person.profilePath ? (
    <TreatedPortrait bare personId={person.id} slot={slot} color={color} name={person.name} profilePath={person.profilePath} imageSize="w342" rounded={false} className="absolute! inset-0 size-full" />
  ) : (
    <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-[length:max(14px,22cqw)] font-medium text-black/75" style={{ background: color }}>
      {initials(person.name)}
    </span>
  );
}

const CARD_SHADOW = "shadow-[0_1px_1px_rgb(0_0_0/0.5),0_6px_12px_-3px_rgb(0_0_0/0.5),0_14px_22px_-8px_rgb(0_0_0/0.6)]";

/** The cascade: portrait cards (3:4, rounded, a soft drop shadow, as the old landing hero's person cards were), turned a little the opposite ways, B over A's bottom right; hover slides B 3px down and to the right and A 2px up and to the left. */
function Cascade({ people, colors, box }: Props & { box: Box }) {
  const layout = cascadeLayout(box.width, box.height, people.length);
  if (!layout) return null;
  return people.map((person, index) => {
    const place = layout.places[index];
    return (
      <figure
        key={person.id}
        data-card-tile={person.id}
        className={`absolute m-0 overflow-hidden rounded-[8px] bg-surface ${CARD_SHADOW} [rotate:var(--tilt)] motion-safe:transition-[translate,rotate] motion-safe:duration-[250ms] motion-safe:ease-out motion-safe:group-hover:[translate:var(--nudge)_var(--nudge)] motion-safe:group-focus-visible:[translate:var(--nudge)_var(--nudge)]`}
        style={{ left: place.x, top: place.y, width: layout.w, height: layout.h, zIndex: index, "--tilt": `${place.tilt}deg`, "--nudge": `${place.nudge}px` } as CSSProperties}
      >
        <Face person={person} color={colors[index]} slot={index} aspect={PORTRAIT_ASPECT} />
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[8px] ring-1 ring-inset ring-white/10" />
      </figure>
    );
  });
}

/**
 * The split: a square tile (rounded, no shadow) cut by a thin seam in the page's own colour, at a slight angle, from the lower left to the upper right, echoing the stage's two panels:
 * A in the part above it, B in the part below. Each half is a `clip-path` of its own layer, with the cut-out shifted toward its half's corner so the face is not under the seam. Hovered or
 * focused, the seam widens a hair and each half moves 1.5px apart along both axes (about 2px along the diagonal).
 */
function Split({ people, colors, box }: Props & { box: Box }) {
  const layout = splitLayout(box.width, box.height);
  if (!layout) return null;
  const { s } = layout;
  const rest = splitClips(s, SPLIT_SEAM_PX);
  const hover = splitClips(s, SPLIT_SEAM_HOVER_PX);
  // Each half is the person's montage over the whole tile (clipped to the half) and their cut-out, 0.78 of a tile wide at the photo's 2:3, stood so that its eyes (`eyeLine`) are at a point
  // in the middle of the half: A's at 0.36 across and 0.36 down the tile, B's at 0.64 and 0.64, so that the face is clear of the seam, whatever the cut's headroom.
  const width = s * 0.78;
  const height = width / DUO_ASPECT;
  const halves = [
    { person: people[0], color: colors[0], clip: rest.a, clipHover: hover.a, shift: -SPLIT_SHIFT_PX, at: [0.36, 0.36] },
    { person: people[1], color: colors[1], clip: rest.b, clipHover: hover.b, shift: SPLIT_SHIFT_PX, at: [0.64, 0.64] },
  ].map((half) => {
    const shape = half.person.profilePath ? treatmentShape(half.person.id, half.person.profilePath) : null;
    const eye = shape && !shape.tear ? eyeLine(shape) : 0.36;
    return { ...half, left: s * half.at[0] - width / 2, top: s * half.at[1] - eye * height };
  });
  return (
    <div className="absolute overflow-hidden rounded-[8px] bg-canvas" style={{ left: layout.x, top: layout.y, width: s, height: s }}>
      {halves.map((half, index) => (
        <div
          key={half.person.id}
          data-card-tile={half.person.id}
          className="absolute inset-0 [clip-path:var(--clip)] motion-safe:transition-[clip-path,translate] motion-safe:duration-[250ms] motion-safe:ease-out motion-safe:group-hover:[clip-path:var(--clip-hover)] motion-safe:group-hover:[translate:var(--shift)_var(--shift)] motion-safe:group-focus-visible:[clip-path:var(--clip-hover)] motion-safe:group-focus-visible:[translate:var(--shift)_var(--shift)]"
          style={{ zIndex: index, "--clip": half.clip, "--clip-hover": half.clipHover, "--shift": `${half.shift}px` } as CSSProperties}
        >
          <Montage person={half.person} color={half.color} />
          <div className="absolute" style={{ left: half.left, top: half.top, width, height }}>
            <Cutout person={half.person} color={half.color} slot={index} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** The page's colour rising from the bottom, over the figures and their backdrop alike, as the hero's foot is (the same stops, here the card's own colour): the bodies melt into the card; nothing on a figure is faded. */
const MELT = "linear-gradient(to top, var(--surface), color-mix(in srgb, var(--surface) 93%, transparent) 14%, color-mix(in srgb, var(--surface) 74%, transparent) 33%, color-mix(in srgb, var(--surface) 42%, transparent) 55%, color-mix(in srgb, var(--surface) 14%, transparent) 78%, transparent)";

/**
 * The duo: the cut-outs stand bare (`TreatedPortrait` with `bare`), side by side (centred on the box's height), B in front of A with their shoulders overlapping, on one shared backdrop (a horizontal gradient from A's
 * colour to B's, darkened), with the card's colour over the bottom of the figures and the backdrop so that the bodies melt into the card. Hovered or focused, they lean 2px apart.
 */
function Duo({ people, colors, box }: Props & { box: Box }) {
  const layout = duoLayout(box.width, box.height, people.length);
  if (!layout) return null;
  const dark = "#0b0d10";
  const stops = colors.slice(0, people.length).map((color) => `color-mix(in srgb, ${color} 42%, ${dark})`);
  return (
    <>
      <div
        aria-hidden="true"
        className="absolute rounded-[12px]"
        style={{ left: 0, width: layout.span, top: layout.top, bottom: layout.inset, backgroundImage: `linear-gradient(to right, ${stops.length > 1 ? stops.join(", ") : `${stops[0]}, ${stops[0]}`})` }}
      />
      {people.map((person, index) => (
        <div
          key={person.id}
          data-card-tile={person.id}
          className="absolute [translate:0_0] motion-safe:transition-[translate] motion-safe:duration-[250ms] motion-safe:ease-out motion-safe:group-hover:[translate:var(--lean)_0] motion-safe:group-focus-visible:[translate:var(--lean)_0]"
          style={{ left: layout.places[index].x, bottom: layout.inset, width: layout.w, height: layout.h, zIndex: index, "--lean": `${layout.places[index].lean}px` } as CSSProperties}
        >
          <Cutout person={person} color={colors[index]} slot={index} />
        </div>
      ))}
      <div aria-hidden="true" className="pointer-events-none absolute left-0" style={{ width: layout.span, bottom: layout.inset, height: `${Math.round(layout.h * DUO_MELT)}px`, zIndex: people.length + 1, backgroundImage: MELT }} />
    </>
  );
}
