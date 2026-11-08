import { PairingCardFrame } from "@/components/landing/pairing-card";
import { clippingCountLabel, type ClippingCardData } from "@/lib/clipping-cards";
import { joinNames } from "@/lib/format";

/**
 * A pair of the landing page's Clippings tab: the pairing card's look, a short quote from the pair under their
 * names instead of the blurb, and the number of clippings in place of the film count. The link opens the pair's
 * Clippings tab. The quote sits at most two lines high so the cards of a row stay level; "— Surname" stays under
 * it so that a cut quote still says who spoke.
 */
export function ClippingCard({ card }: { card: ClippingCardData }) {
  const { teaser } = card;
  return (
    <PairingCardFrame href={card.href} people={card.people}>
      <div className="flex flex-1 flex-col gap-1.5">
        <h3 className="text-lg font-semibold leading-snug text-strong">{joinNames(card.people.map((p) => p.name))}</h3>
        {teaser && (
          <div className="font-serif text-muted">
            <p className="line-clamp-2 text-[15px] leading-snug">{`“${teaser.quote}”`}</p>
            <p className="mt-1 text-[13px] leading-snug">{`— ${teaser.speaker}`}</p>
          </div>
        )}
      </div>
      <p className="text-sm font-medium text-accent-green">{clippingCountLabel(card.count)}</p>
    </PairingCardFrame>
  );
}
