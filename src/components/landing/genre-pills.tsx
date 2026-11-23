import { GENRE_ICONS } from "@/components/landing/genre-icons";
import type { GenrePill } from "@/components/landing/genre-tabs";
import type { GenreSection } from "@/lib/example-cards";
import { FEATURED_TAB, type TabId } from "@/lib/examples";

function pillIcon(id: TabId) {
  const Icon = GENRE_ICONS[id];
  return <Icon size={16} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />;
}

/** The pills of the landing page's genre tablist: Featured, then every genre that has pairings, in display order (the panels of `Pairings` are the same list). */
export function genrePills(sections: readonly GenreSection[]): GenrePill[] {
  return [
    { id: FEATURED_TAB.id, label: FEATURED_TAB.label, icon: pillIcon(FEATURED_TAB.id) },
    ...sections.map(({ genre }) => ({ id: genre.id, label: genre.label, icon: pillIcon(genre.id) })),
  ];
}
