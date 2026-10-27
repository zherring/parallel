import { GENRE_ICONS } from "@/components/landing/genre-icons";
import { GenreTabs } from "@/components/landing/genre-tabs";
import { PairingCard } from "@/components/landing/pairing-card";
import type { GenreSection } from "@/lib/example-cards";

export function Pairings({ sections }: { sections: GenreSection[] }) {
  const tabs = sections.map(({ genre, cards }) => {
    const Icon = GENRE_ICONS[genre.id];
    return {
      id: genre.id,
      label: genre.label,
      icon: <Icon size={16} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />,
      panel: (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <li key={card.href}>
              <PairingCard card={card} />
            </li>
          ))}
        </ul>
      ),
    };
  });

  return (
    <section aria-labelledby="pairings-heading" className="mx-auto w-full max-w-6xl px-4 py-12">
      <h2 id="pairings-heading" className="text-2xl font-semibold tracking-tight text-strong">
        Try a pairing
      </h2>
      <p className="mt-1.5 text-body">Pick a genre, start from a famous collaboration and keep going.</p>
      <div className="mt-5">
        <GenreTabs idBase="pairings" label="Genres" tabs={tabs} />
      </div>
    </section>
  );
}
