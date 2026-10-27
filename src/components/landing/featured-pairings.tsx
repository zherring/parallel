"use client";

import { useMemo, useSyncExternalStore } from "react";
import { PairingCard } from "@/components/landing/pairing-card";
import type { ExampleCardData } from "@/lib/example-cards";
import { defaultFeatured, pickFeatured } from "@/lib/featured";

interface Props {
  /** Every pairing, in display order; the sample is drawn from all of them. */
  cards: ExampleCardData[];
  count: number;
}

const subscribeNever = () => () => {};

/**
 * The Featured tab: `count` pairings picked at random from all of them, once per mount (so a
 * page load, or coming back to the landing page by client navigation, rolls again).
 *
 * The server markup holds a fixed default sample instead (see defaultFeatured), so crawlers and
 * visitors without JavaScript still get real links, and the first client render matches it. Those
 * cards stay transparent, in the same grid so nothing shifts, until the random sample has
 * replaced them; then the list fades in (unless the visitor prefers reduced motion).
 */
export function FeaturedPairings({ cards, count }: Props) {
  const initial = useMemo(() => defaultFeatured(cards, count), [cards, count]);
  // False on the server and for the hydrating render, true from the next one: Math.random must not
  // run before then, or the markup would not match the server's.
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);
  const picked = useMemo(() => (mounted ? pickFeatured(cards, count) : null), [mounted, cards, count]);

  return (
    <>
      {/* Visitors without JavaScript never get a random sample, so show the default one. */}
      <noscript>
        <style>{"[data-featured-pending]{opacity:1!important}"}</style>
      </noscript>
      <ul
        data-featured-pending={picked ? undefined : ""}
        className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${
          picked ? "opacity-100 motion-safe:transition-opacity motion-safe:duration-300" : "opacity-0"
        }`}
      >
        {(picked ?? initial).map((card) => (
          <li key={card.href}>
            <PairingCard card={card} />
          </li>
        ))}
      </ul>
    </>
  );
}
