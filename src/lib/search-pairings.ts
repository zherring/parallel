import { buildGenreSections } from "@/lib/example-cards";
import type { PairingSearchResult, PersonSearchResult } from "@/lib/types";

/** All curated pairings for the matched people, best person's pairings first; no truncation. */
export function searchPairings(
  results: readonly Pick<PersonSearchResult, "id">[],
  pairings: readonly PairingSearchResult[] = buildGenreSections().flatMap((section) => section.cards),
): PairingSearchResult[] {
  const seen = new Set<string>();
  const related: PairingSearchResult[] = [];
  for (const result of results) {
    for (const pairing of pairings) {
      if (seen.has(pairing.href) || !pairing.people.some((person) => person.id === result.id)) continue;
      seen.add(pairing.href);
      const { href, blurb, sharedCount, people } = pairing;
      related.push({ href, blurb, sharedCount, people });
    }
  }
  return related;
}
