import { FeaturedPairings } from "@/components/landing/featured-pairings";
import { GenrePanels, RevealLinkedGenre, type GenrePanel } from "@/components/landing/genre-tabs";
import { PairingCard } from "@/components/landing/pairing-card";
import type { GenreSection } from "@/lib/example-cards";
import { FEATURED_COUNT, FEATURED_TAB } from "@/lib/examples";

/** The grid's section id: what a pill of the top bar brings into view (`GenreTabsProvider`'s `anchorId`). */
export const PAIRINGS_ANCHOR = "pairings";

interface Props {
  sections: GenreSection[];
}

/**
 * The pairings grid, a panel per genre; which one shows is chosen by the pills of the page's top bar (`GenreTablist`), which share its state
 * (`GenreTabsProvider`). The heading says what the pills below the stage's edge are for, now that they are no longer directly above the grid.
 */
export function Pairings({ sections }: Props) {
  const featuredPanel: GenrePanel = {
    id: FEATURED_TAB.id,
    panel: <FeaturedPairings cards={sections.flatMap((section) => section.cards)} count={FEATURED_COUNT} />,
  };

  const genrePanels: GenrePanel[] = sections.map(({ genre, cards }) => ({
    id: genre.id,
    panel: (
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <li key={card.href}>
            <PairingCard card={card} />
          </li>
        ))}
      </ul>
    ),
  }));

  return (
    <section
      id={PAIRINGS_ANCHOR}
      aria-labelledby="pairings-heading"
      className="mx-auto w-full max-w-6xl scroll-mt-28 px-4 pb-12 pt-4 sm:scroll-mt-20"
    >
      <h2 id="pairings-heading" className="text-sm font-medium tracking-[0.01em] text-muted">
        Try a pairing
      </h2>
      <GenrePanels panels={[featuredPanel, ...genrePanels]} />
      <RevealLinkedGenre anchorId={PAIRINGS_ANCHOR} />
    </section>
  );
}
