import { EXAMPLE_PAIRINGS, pairingKey } from "@/lib/examples";
import { buildPeopleSlug } from "@/lib/slug";

const CURATED_ORDER = new Map(
  EXAMPLE_PAIRINGS.map((pairing) => [pairingKey(pairing), pairing.people.map((person) => person.id)]),
);

/**
 * One search-engine URL per set of people: prefer the homepage's curated order,
 * otherwise sort by id. Use only for canonical tags and the sitemap, never to
 * redirect or reorder a visitor's lanes, colours, social cards or share links.
 * Names come from the loaded people, so a TMDB name change still gets its new slug.
 */
export function canonicalPeoplePath(people: readonly { id: number; name: string }[]): string {
  const key = people.map((person) => person.id).sort((a, b) => a - b).join("+");
  const preferred = CURATED_ORDER.get(key);
  const ordered = [...people].sort((a, b) => preferred
    ? preferred.indexOf(a.id) - preferred.indexOf(b.id)
    : a.id - b.id);
  return `/p/${buildPeopleSlug(ordered)}`;
}
