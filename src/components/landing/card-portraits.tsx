"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { usePanelShown } from "@/components/landing/panel-shown";
import { TreatedPortrait } from "@/components/treated-portrait";
import { PORTRAIT_ASPECT, cascadeLayout, type CascadeLayout } from "@/lib/pairing-card";
import { initials } from "@/lib/person-labels";

interface Props {
  /** In the pairing's order: A is at the top left, and each is over the one before it. */
  people: readonly { id: number; name: string; profilePath: string }[];
  /** Each person's colour, in the same order (`portraitPersonHexes`). */
  colors: readonly string[];
}

/**
 * The people of a genre's pairing card: portrait cards (3:4, rounded, with a soft drop shadow, as the old landing hero's person cards were) in a diagonal cascade straight on the
 * card's surface, in the box pairing-card.tsx gives it (a third of the card's width, and the card's height: the card is as tall as its text, so the box is measured, and the
 * portraits sized to it by `cascadeLayout`): A at the upper left turned a little to the left, B lower and to the right, turned a little the other way and over A's bottom
 * right. Each is a `TreatedPortrait`: their cut over their duotoned montage in the pair's colour for them, framed on the head for a 3:4 card (their own colour edge is the only
 * outline). No names on them: the card's title says them. Hovering or focusing the card (the `group` it is in) slides the last one a few px further down and to the right and the
 * first up and to the left, over 250ms, and not at all with reduced motion. Drawn once the panel it is in has been shown (`usePanelShown`: a hidden panel is `display: none`, and
 * each of these is a 3 x 3 montage of posters and an SVG, which 133 cards of would be a megabyte of markup); until then the box is empty and its size held.
 */
export function CardPortraits({ people, colors }: Props) {
  const shown = usePanelShown();
  const root = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<CascadeLayout | null>(null);
  useLayoutEffect(() => {
    const element = root.current;
    if (!shown || !element) return;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      setLayout(cascadeLayout(width, height, people.length));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [shown, people.length]);

  return (
    <div ref={root} data-card-portraits="" className="absolute inset-0">
      {shown &&
        layout &&
        people.map((person, index) => {
          const place = layout.places[index];
          return (
            <figure
              key={person.id}
              data-card-tile={person.id}
              className="absolute m-0 overflow-hidden rounded-[8px] bg-surface shadow-[0_1px_1px_rgb(0_0_0/0.5),0_6px_12px_-3px_rgb(0_0_0/0.5),0_14px_22px_-8px_rgb(0_0_0/0.6)] [rotate:var(--tilt)] motion-safe:transition-[translate,rotate] motion-safe:duration-[250ms] motion-safe:ease-out motion-safe:group-hover:[translate:var(--nudge)_var(--nudge)] motion-safe:group-focus-visible:[translate:var(--nudge)_var(--nudge)]"
              style={
                {
                  left: place.x,
                  top: place.y,
                  width: layout.w,
                  height: layout.h,
                  zIndex: index,
                  "--tilt": `${place.tilt}deg`,
                  "--nudge": `${place.nudge}px`,
                } as CSSProperties
              }
            >
              {person.profilePath ? (
                <TreatedPortrait
                  personId={person.id}
                  slot={index}
                  color={colors[index]}
                  name={person.name}
                  profilePath={person.profilePath}
                  imageSize="w342"
                  posterSize="w154"
                  rounded={false}
                  headAspect={PORTRAIT_ASPECT}
                  className="absolute! inset-0 size-full"
                />
              ) : (
                <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-[length:max(14px,22cqw)] font-medium text-black/75" style={{ background: colors[index] }}>
                  {initials(person.name)}
                </span>
              )}
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[8px] ring-1 ring-inset ring-white/10" />
            </figure>
          );
        })}
    </div>
  );
}
