import Link from "next/link";
import { CardPortraits } from "@/components/landing/card-portraits";
import { PairingCount } from "@/components/landing/pairing-count";
import type { ExampleCardData } from "@/lib/example-cards";
import { joinNames } from "@/lib/format";
import { CELL_BLEED_PX, CELL_CQW } from "@/lib/pairing-card";
import { portraitPersonHexes } from "@/lib/portrait-cuts";

interface Props {
  card: ExampleCardData;
}

/**
 * A pairing on a genre's tab, one link: the people as a cascade of two portrait cards straight on the card's surface at its left (`CardPortraits`: A at the upper left, B lower
 * and to the right, overlapping A's bottom right and over it, each turned a little the opposite way), a third of the card's width and as tall as the card, and to the right of
 * it the names, the one-line blurb and "N films together" under it, in the text's flow. The card is as tall as its text and its padding, and never under 150px (160 from `sm`
 * up), so the portraits are not tiny; the cards of a row stretch to the tallest. The portraits' box goes 8px into the padding above and below, so the pair runs from the card's top
 * to its bottom, the tilted corners close to its edge. Hovering or focusing the card slides the portraits a little (card-portraits.tsx), on the card's existing hover.
 */
export function PairingCard({ card }: Props) {
  const names = card.people.map((person) => person.name);
  const colors = portraitPersonHexes(card.people.map((person) => person.id)) ?? [];
  return (
    <Link
      href={card.href}
      prefetch={false}
      data-landing-card=""
      className="group flex h-full min-h-[150px] gap-4 overflow-hidden rounded-lg border border-border bg-surface p-4 no-underline transition-colors [container-type:inline-size] hover:border-accent-green/70 sm:min-h-[160px]"
    >
      <div aria-hidden="true" data-card-cell="" className="relative shrink-0 self-stretch" style={{ width: `${CELL_CQW}cqw`, marginBlock: -CELL_BLEED_PX }}>
        <CardPortraits people={card.people} colors={colors} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-lg font-semibold leading-snug text-strong [overflow-wrap:anywhere]">{joinNames(names)}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-body [overflow-wrap:anywhere]">{card.blurb}</p>
        <div className="mt-3">
          <PairingCount count={card.sharedCount} />
        </div>
      </div>
    </Link>
  );
}
