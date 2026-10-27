import { FeaturedPairings } from "@/components/landing/featured-pairings";
import { GENRE_ICONS } from "@/components/landing/genre-icons";
import { GenreTabs, type GenreTab } from "@/components/landing/genre-tabs";
import { PairingCard } from "@/components/landing/pairing-card";
import type { GenreSection } from "@/lib/example-cards";
import { FEATURED_COUNT, FEATURED_TAB, type TabId } from "@/lib/examples";

function tabIcon(id: TabId) {
  const Icon = GENRE_ICONS[id];
  return <Icon size={16} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />;
}

export function Pairings({ sections }: { sections: GenreSection[] }) {
  const featuredTab: GenreTab = {
    id: FEATURED_TAB.id,
    label: FEATURED_TAB.label,
    icon: tabIcon(FEATURED_TAB.id),
    panel: <FeaturedPairings cards={sections.flatMap((section) => section.cards)} count={FEATURED_COUNT} />,
  };

  const genreTabs: GenreTab[] = sections.map(({ genre, cards }) => ({
    id: genre.id,
    label: genre.label,
    icon: tabIcon(genre.id),
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
    <section aria-labelledby="pairings-heading" className="mx-auto w-full max-w-6xl px-4 py-12">
      <h2 id="pairings-heading" className="text-2xl font-semibold tracking-tight text-strong">
        Try a pairing
      </h2>
      <p className="mt-1.5 text-body">Pick a genre, start from a famous collaboration and keep going.</p>
      <div className="mt-5">
        <GenreTabs idBase="pairings" label="Genres" tabs={[featuredTab, ...genreTabs]} />
      </div>
    </section>
  );
}
