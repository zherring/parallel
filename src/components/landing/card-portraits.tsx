"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { usePanelShown } from "@/components/landing/panel-shown";
import { TreatedPortrait } from "@/components/treated-portrait";
import { PORTRAIT_ASPECT, cascadeLayout } from "@/lib/pairing-card";
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
 * measured, and what is drawn is sized to it). A cascade of two tilted portrait cards: A at the upper left, B lower and to the right over A's bottom right; each is a `TreatedPortrait`
 * (the cut-out over the duotone montage in the pair's colours), with no names (the card's title says them), hovered or focused by the card (the `group` it is in), and not moving at all
 * with reduced motion. Drawn once the panel it is in has been shown (`usePanelShown`: a hidden panel is `display: none`, and each of these is a 3 x 3 montage of posters and an SVG, which
 * 133 cards of would be a megabyte of markup); until then the box is empty and its size held.
 */
export function CardPortraits({ people, colors }: Props) {
  const shown = usePanelShown();
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

  return (
    <div ref={root} data-card-portraits="" className="absolute inset-0">
      {shown && box && <Cascade people={people} colors={colors} box={box} />}
    </div>
  );
}

/** A person's cut-out over their montage in a box that fills its parent (a card), framed on the head for a tile of `aspect` (the whole photo without it); a person with no photo is their colour and their initials. */
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
